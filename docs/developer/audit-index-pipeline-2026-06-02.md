# 代码审计报告：CodeRecall 索引管线

## 1. 元信息

- **项目/模块**：CodeRecall 索引管线（API Client / Indexer / VectorStore / Scanner）
- **审计日期**：2026-06-02
- **审计范围**：`src/api/`, `src/indexer/`, `src/vectorStore/`, `src/scanner/`, `src/db/`, `src/utils/`, `src/mcp/`, `src/search/SearchService.ts`
- **审计语言/技术栈**：TypeScript / Node.js 22 / LanceDB / better-sqlite3
- **审计文件数**：14
- **复核说明**：本版已按 2026-06-02 当前仓库事实重写；原文中关于“全量回滚”“无坏 Key 跳过”“全量内存驻留”的结论已被现有实现和测试推翻，已移入“已核销观察项”

## 2. 执行摘要

索引管线当前的**分批断点续传**、**坏 Key 冷却跳过**和**分批内存收敛**能力已经落地，且有针对性运行时测试覆盖，不应继续作为缺陷上报。当前仍值得关注的问题主要集中在**长驻进程资源释放**与**模块级单例状态残留**：Embedding 客户端配置热更新不生效、VectorStore.close() 未显式释放 LanceDB 资源、日志与正则缓存缺少生命周期治理。

| 指标 | 数值 |
|------|------|
| 总发现数 | 7 |
| P0 (阻塞) | 0 |
| P1 (严重) | 2 |
| P2 (一般) | 3 |
| P3 (建议) | 2 |
| 审计维度覆盖 | 可靠性 / 资源释放 / 内存增长 / 运行时状态 |

## 3. 严重级别定义

| 级别 | 标签 | 定义 | 响应时限 |
|------|------|------|----------|
| P0 | 🔴 阻塞 | 生产隐患、数据丢失风险 | 立即修复 |
| P1 | 🟠 严重 | 明显 bug、资源泄漏、长驻进程稳定性问题 | 1-3 天 |
| P2 | 🟡 一般 | 代码异味、可维护性问题、中低风险运行时问题 | 1-2 周 |
| P3 | 🔵 建议 | 实现形态优化、观测项、非强制改进 | 酌情处理 |

## 4. 详细发现列表

| ID | 文件位置 | 行号 | 严重级 | 维度 | 描述 |
|----|----------|------|--------|------|------|
| #1 | src/api/embedding.ts | 349-352, 763-769 | P1 | 可靠性 / 配置热更新 | EmbeddingClient 为模块级单例，首次构造后不再读取最新 Key 配置 |
| #2 | src/vectorStore/index.ts | 362-365 | P1 | 资源释放 | VectorStore.close() 仅置空引用，未见显式释放 LanceDB 资源 |
| #3 | src/utils/logger.ts | 85, 171-185 | P2 | 资源释放 | 文件日志 WriteStream 创建后缺少显式关闭路径 |
| #4 | src/search/SearchService.ts | 92-105 | P2 | 内存增长 | tokenBoundaryRegexCache 为无上限模块级缓存 |
| #5 | src/vectorStore/index.ts | 216-223, 241-243 | P3 | 性能 / 可扩展性 | 批量 DELETE 通过 OR 条件拼接，存在语句膨胀风险，但已有批次上限缓解 |
| #6 | src/api/embedding.ts | 565-597 | P3 | 可靠性 / 实现形态 | 413 自动拆分采用递归，当前风险较低但可改为迭代以降低栈依赖 |
| #7 | src/api/embedding.ts | 323-333 | P2 | 运行时状态 | RateLimitController 为全局单例，多轮 scan / query 间共享退避与并发状态 |

---

## 5. 发现详情

### [#1] EmbeddingClient 单例缓存配置，换 Key 后不会自动生效

- **位置**：`src/api/embedding.ts:349-352`, `src/api/embedding.ts:763-769`
- **严重级别**：P1
- **维度**：可靠性 / 配置热更新

**问题描述**：
`EmbeddingClient` 在构造函数中读取 `getEmbeddingConfig()`，并通过 `getEmbeddingClient()` 以模块级单例形式缓存。进程启动后，如果用户修改 `.env` 中的 `EMBEDDINGS_API_KEYS` 或其他 Embedding 配置，现有单例不会自动刷新。

```typescript
constructor(config?: EmbeddingConfig) {
  this.config = config || getEmbeddingConfig();
  this.rateLimiter = getRateLimitController(this.config.maxConcurrency);
  this.apiKeyPool = this.buildApiKeyPool();
}

let defaultClient: EmbeddingClient | null = null;

export function getEmbeddingClient(): EmbeddingClient {
  if (!defaultClient) {
    defaultClient = new EmbeddingClient();
  }
  return defaultClient;
}
```

**影响评估**：
- CLI 单次进程影响有限
- MCP 长驻进程和同一进程内多次索引场景下，用户换 Key 后仍可能持续使用旧 Key
- 故障恢复依赖“重启进程”而不是“更新配置”

**建议修复方案**：
- 提供 `resetEmbeddingClient()`，在新一轮 scan / mcp request 前按需重建
- 或将配置快照纳入 cache key，配置变化时自动失效重建

---

### [#2] VectorStore.close() 未显式释放 LanceDB 资源

- **位置**：`src/vectorStore/index.ts:362-365`
- **严重级别**：P1
- **维度**：资源释放

**问题描述**：
`close()` 当前只做引用置空，没有调用任何 LanceDB 关闭接口。若底层 SDK 或 native 层持有文件句柄、内存映射或连接对象，这里并未主动释放。

```typescript
async close(): Promise<void> {
  this.db = null;
  this.table = null;
}
```

**影响评估**：
- 在 `SearchService.close()` 与 MCP 查询结束后，逻辑上已“关闭”，但底层资源是否释放并不明确
- 长驻进程反复查询/切换项目时，存在 native 资源累积风险

**建议修复方案**：
- 核对当前 `@lancedb/lancedb` SDK 是否提供显式 `close()` / `disconnect()` / `dispose()` 能力
- 若 SDK 无显式关闭接口，至少在代码注释中写明“仅依赖 GC”，并补一条长期运行压测或句柄观测

---

### [#3] 文件日志流创建后缺少显式关闭路径

- **位置**：`src/utils/logger.ts:85`, `src/utils/logger.ts:171-185`
- **严重级别**：P2
- **维度**：资源释放

**问题描述**：
`createFormattedStream()` 内部创建 `fs.createWriteStream()`，但当前文件内未见 `end()` / `close()` / `destroy()` 关闭逻辑。对于 CLI 短进程问题较小，但 MCP 长驻进程会长期持有该文件描述符。

```typescript
function createFormattedStream(filePath: string): Writable {
  const writeStream = fs.createWriteStream(filePath, { flags: 'a' });
  return new Writable({
    write(chunk, _encoding, callback) {
      writeStream.write(`${line}\n`, callback);
    },
  });
}
```

**影响评估**：
- 长驻进程下文件句柄生命周期不受控
- 若未来引入日志按日切换或动态重建 logger，会放大句柄遗留风险

**建议修复方案**：
- 在进程退出信号中统一关闭日志流
- 若后续支持跨日切换，切换时先关闭旧流再打开新流

---

### [#4] tokenBoundaryRegexCache 无上限增长

- **位置**：`src/search/SearchService.ts:92-105`
- **严重级别**：P2
- **维度**：内存增长

**问题描述**：
`tokenBoundaryRegexCache` 是模块级 `Map<string, RegExp>`。每次遇到新 token 都会新增缓存项，但没有最大容量、TTL 或淘汰策略。

```typescript
const tokenBoundaryRegexCache = new Map<string, RegExp>();

function getTokenBoundaryRegex(token: string): RegExp {
  let regex = tokenBoundaryRegexCache.get(token);
  if (!regex) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(`\\b${escaped}\\b`);
    tokenBoundaryRegexCache.set(token, regex);
  }
  return regex;
}
```

**影响评估**：
- 单个对象不大，但在高频 MCP 查询场景下会随查询词汇持续增长
- 属于慢性问题，短时间难以暴露，长期运行更值得治理

**建议修复方案**：
- 改为有上限的 LRU/TTL cache
- 或在查询结束后只缓存热点 token，而不是永久缓存所有 token

---

### [#5] 批量 DELETE 使用 OR 条件拼接，存在语句膨胀风险

- **位置**：`src/vectorStore/index.ts:216-223`, `src/vectorStore/index.ts:241-243`
- **严重级别**：P3
- **维度**：性能 / 可扩展性

**问题描述**：
`batchUpsertFiles()` 和 `deleteFiles()` 都通过拼接 `OR` 条件生成删除语句。当前已存在 `BATCH_FILES = 50` 与 `BATCH_RECORDS = 5000` 的上限控制，因此问题不会立即爆发，但在路径较长或后续调大批次参数时，SQL/表达式长度会随之膨胀。

```typescript
const deleteConditions = batch
  .map(
    (f) =>
      `(file_path = '${this.escapeString(f.path)}' AND file_hash != '${this.escapeString(f.hash)}')`,
  )
  .join(' OR ');
await this.table.delete(deleteConditions);
```

**影响评估**：
- 当前更像扩展性观察项，而不是已经证实的性能瓶颈
- 若批次数量上涨，可能增加解析成本并影响错误定位可读性

**建议修复方案**：
- 优先确认 LanceDB 查询 API 是否支持更紧凑的表达方式
- 若不支持，保持当前批次上限并在注释中明确该约束的目的

---

### [#6] 413 自动拆分采用递归实现，可改为迭代降低栈依赖

- **位置**：`src/api/embedding.ts:565-597`
- **严重级别**：P3
- **维度**：可靠性 / 实现形态

**问题描述**：
当 Embedding 请求体过大时，`processWithRateLimit()` 会将批次二分后递归调用自身。当前递归深度受 `texts.length` 控制，实际较浅，不构成现实 blocker，但实现上仍依赖调用栈。

```typescript
const leftResults = await this.processWithRateLimit(leftTexts, startIndex, progress, signal);
const rightResults = await this.processWithRateLimit(
  rightTexts,
  startIndex + leftTexts.length,
  progress,
  signal,
);
return [...leftResults, ...rightResults];
```

**影响评估**：
- 目前风险低，且已有测试覆盖自动拆分行为
- 更适合作为实现整洁性优化，而不是高优先级缺陷

**建议修复方案**：
- 若后续继续增强批次自适应逻辑，可顺手改为队列式迭代处理

---

### [#7] 全局 RateLimitController 会跨轮次残留运行时状态

- **位置**：`src/api/embedding.ts:323-333`
- **严重级别**：P2
- **维度**：运行时状态

**问题描述**：
`RateLimitController` 通过模块级单例复用。这样可以复用退避策略，但也意味着上一轮请求的 `backoffMs`、当前并发窗口等状态可能影响下一轮全新请求。

```typescript
let globalRateLimitController: RateLimitController | null = null;

function getRateLimitController(maxConcurrency: number): RateLimitController {
  if (!globalRateLimitController) {
    globalRateLimitController = new RateLimitController(maxConcurrency);
  }
  return globalRateLimitController;
}
```

**影响评估**：
- 同一进程内多轮 scan / search 之间没有明确“冷启动”边界
- 若上一轮因 429 进入较强退避，下一轮可能带着旧状态起跑

**建议修复方案**：
- 明确该单例是“进程级共享调度器”还是“单次任务级调度器”
- 若应隔离，补 `resetRateLimitController()`；若应共享，补注释说明共享语义与预期收益

---

## 6. 统计汇总

### 按严重级别分布

| 级别 | 数量 | 占比 |
|------|------|------|
| P0 | 0 | 0% |
| P1 | 2 | 28.6% |
| P2 | 3 | 42.9% |
| P3 | 2 | 28.6% |

### 按维度分布

| 维度 | 数量 | 占比 |
|------|------|------|
| 可靠性 / 配置热更新 | 1 | 14.3% |
| 资源释放 | 2 | 28.6% |
| 内存增长 | 1 | 14.3% |
| 性能 / 可扩展性 | 1 | 14.3% |
| 运行时状态 | 1 | 14.3% |
| 可靠性 / 实现形态 | 1 | 14.3% |

## 7. 改进建议

### 短期（1 周内）
1. **修复 #1**：为 EmbeddingClient 增加显式重置/失效机制，确保换 Key 后无需重启整个进程
2. **修复 #2**：核对 LanceDB SDK 的显式关闭能力，并在 `VectorStore.close()` 中补真实释放逻辑或明确注释
3. **修复 #3 / #4**：为日志流与 token regex cache 补生命周期治理，避免长驻进程慢性资源增长

### 中期（1-4 周）
4. **修复 #7**：明确 RateLimitController 的共享边界；若不应跨任务共享，则补 reset 能力
5. **优化 #5 / #6**：保留当前行为不动，但补注释、边界说明和必要测试，防止未来演进时重新踩坑

### 长期（1-3 月）
6. 增加长驻进程资源观测：文件句柄数、内存增长、LanceDB 句柄/连接行为
7. 增加“配置热更新 / 多轮 scan / 多项目切换”回归测试，覆盖当前文档中的长驻进程问题

## 8. 已核销观察项

以下结论在本次复核中已被**当前实现和测试**推翻，不应继续作为缺陷保留：

1. **“Embedding 失败会全量回滚、无法断点续传”**：不成立  
   当前 `batchIndex()` 已按 `BATCH_CHUNKS` 分批处理，单批失败仅清理当前批次 hash，并继续处理后续批次。  
   证据：`src/indexer/index.ts:314-363`、`tests/runtime/batch-index-resilience.test.ts:190-275`

2. **“API Key 轮询无坏 Key 跳过机制”**：不成立  
   当前已有 `badKeys` 冷却表，401/403 后会标记坏 Key 并切换到下一个健康 Key。  
   证据：`src/api/embedding.ts:344-407`, `src/api/embedding.ts:545-563`

3. **“batchIndex 全量 texts + embeddings 同时驻留内存”**：不成立  
   当前只对当前 batch 构造 `batchTexts` 和 `embeddings`，不再全量聚合。  
   证据：`src/indexer/index.ts:323-429`

## 9. 验证记录

本次复核使用了以下命令与事实校验：

```bash
git status --short
rg -n "batchIndex|clearVectorIndexHash|getEmbeddingClient|tokenBoundaryRegexCache|createWriteStream|close\\(" src tests
pnpm test -- --runInBand tests/runtime/batch-index-resilience.test.ts
```

说明：

1. `pnpm test -- --runInBand tests/runtime/batch-index-resilience.test.ts` 仍会执行 `package.json` 中预定义的整条 `test` 脚本链，而不是只跑目标文件；因此它可作为“全量 test 脚本仍可执行”的证据，但**不能**作为“单文件定向执行”证据。
2. 当前仓库文档若要给出“运行单个运行时测试”的命令，建议写成 `pnpm exec tsx tests/runtime/<name>.test.ts`，而不是裸 `tsx ...`，避免 shell PATH 依赖。

## 10. 核心结论

当前索引管线最关键的事实变化是：**断点续传、坏 Key 跳过、分批内存收敛已经存在**。因此后续工作的主轴不再是“补齐基础分批索引能力”，而是治理**长驻进程资源生命周期**与**模块级单例状态边界**。

修复优先级建议：

1. **#1 EmbeddingClient 热更新**
2. **#2 VectorStore 真实释放**
3. **#3/#4 长驻进程慢性资源增长**
4. **#7 全局速率控制器状态边界**
