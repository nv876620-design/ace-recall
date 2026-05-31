# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ContextWeaver 是一个为 AI 代码助手设计的语义检索引擎，采用混合搜索（向量 + 词法）、智能上下文扩展和 Token 感知打包策略。

## Development Commands

```bash
# Build
pnpm build                    # 编译 TypeScript (tsup)
pnpm build:release            # 正式发布编译（无 sourcemap）

# Development
pnpm dev                      # Watch 模式开发
pnpm fmt                      # Biome 格式化/检查

# Test
pnpm test                     # 语言支持解析器回归测试
pnpm test:e2e:mcp             # MCP 端到端冒烟测试

# CLI usage
contextweaver init            # 初始化配置文件 (~/.contextweaver/.env)
contextweaver index [path]    # 索引代码库
contextweaver search          # 本地搜索
contextweaver mcp             # 启动 MCP 服务端
```

## Critical Architecture

### Core Pipeline

```
索引: Crawler → Processor → SemanticSplitter → Indexer → VectorStore/SQLite
搜索: Query → Vector+FTS Recall → RRF Fusion → Rerank → GraphExpander → ContextPacker
```

### SearchService Three-Phase Evolution

`src/search/SearchService.ts` 按 Phase 演进设计，通过 tsup `define` 编译开关控制：

| Phase | 特性 | 编译开关 |
|-------|------|---------|
| Phase 0 | 仅向量召回 + Rerank | `PHASE0` |
| Phase 1 | 添加词法召回 + RRF 融合 | `PHASE1` |
| Phase 2 | 上下文扩展（E1/E2/E3） | `PHASE2`（默认） |

### GraphExpander — E1/E2/E3 扩展

`src/search/GraphExpander.ts` 对 rerank 后的 seed chunks 做三级上下文扩展：

- **E1 邻居扩展**：同文件前后相邻 chunks，`neighborHops` 控制跳数
- **E2 面包屑补全**：同 breadcrumb 前缀的其他 chunks，`breadcrumbExpandLimit` 限制数量
- **E3 Import 解析**：通过 resolvers 解析依赖关系，`importFilesPerSeed` 控制跨文件抓取

每种扩展类型有独立 score 衰减系数（`decayNeighbor`/`decayBreadcrumb`/`decayImport`），叠加层数受 `decayDepth` 控制。

### Smart TopK 截断策略

`src/search/config.ts` 定义的多重保护机制，防止低分结果刷屏：

- **Anchor & Floor**：动态阈值 = `max(floor, min(ratioThreshold, deltaThreshold))`，双重下限保护
- **Delta Guard**：`topScore - smartTopScoreDeltaAbs`，防止 Top1 outlier 场景误判
- **Safe Harbor**：前 `smartMinK` 个只检查 floor，保证基本召回
- **Hard Cap**：`smartMaxK` 硬限制，防止 Token 溢出

### Config Loading Order

`src/config.ts` 必须在任何模块之前加载（`src/index.ts` 第 3 行 `import './config.js'`），因为它调用 `dotenv` 加载 `~/.contextweaver/.env`。所有环境变量依赖方都应通过 config 模块读取，不直接读 `process.env`。

## Key Modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| **SearchService** | `src/search/SearchService.ts` | 流水线编排：召回 → 融合 → Rerank → 扩展 → 打包 |
| **GraphExpander** | `src/search/GraphExpander.ts` | E1/E2/E3 三阶段扩展，衰减系数控制上下文相关性 |
| **ContextPacker** | `src/search/ContextPacker.ts` | 同文件段落合并 + Token 预算控制 |
| **SemanticSplitter** | `src/chunking/SemanticSplitter.ts` | AST 语义分片，Dual-Text、Gap-Aware 合并 |
| **VectorStore** | `src/vectorStore/index.ts` | LanceDB 适配层，表按 `projectId` 隔离 |
| **Database** | `src/db/index.ts` | SQLite + FTS5 元数据和全文索引 |
| **MCP Server** | `src/mcp/server.ts` | 单工具 `codebase-retrieval`，首次查询自动触发索引 |

### Import Resolvers

`src/search/resolvers/` — 各语言独立解析器，通过 `createResolvers()` 工厂创建。支持 TS/JS、Python、Go、Java、Rust、Kotlin、PHP、Ruby、Swift、Dart、C#、C/C++。解析器返回 `ImportRecord[]`，GraphExpander 用 SQLite FTS 反向查找定义位置。

## Configuration

- 环境变量: `~/.contextweaver/.env` — EMBEDDINGS_API_KEY, RERANK_API_KEY 等
- 搜索参数: `src/search/config.ts` — 召回量、融合权重、扩展控制等默认值
- 日志: `~/.contextweaver/logs/app.YYYY-MM-DD.log`，`LOG_LEVEL=debug` 开启调试

## Code Conventions

- TypeScript ESM (`"type": "module"`)，所有导入带 `.js` 后缀
- tsup 打包，Node.js >= 20，pnpm 包管理
- 核心流程必须有中文注释
- 环境变量通过 `src/config.ts` 统一读取，不直接读 `process.env`
