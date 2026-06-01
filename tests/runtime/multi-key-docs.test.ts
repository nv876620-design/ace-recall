import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_ENV_TEMPLATE } from '../../src/config.js';

const readme = fs.readFileSync('README.md', 'utf8');
const cliTemplateSource = fs.readFileSync('src/index.ts', 'utf8');
const mcpTemplateSource = fs.readFileSync('src/mcp/tools/codebaseRetrieval.ts', 'utf8');

// README: KEYS 变量作为推荐默认项（非注释）
assert.match(readme, /^EMBEDDINGS_API_KEYS=your-api-key-here$/m);
assert.match(readme, /^RERANK_API_KEYS=your-api-key-here$/m);
// README: 面向新用户只展示多 key 示例，避免继续引导单 key 配置。
assert.doesNotMatch(readme, /^#?\s*EMBEDDINGS_API_KEY=your-api-key-here$/m);
assert.doesNotMatch(readme, /^#?\s*RERANK_API_KEY=your-api-key-here$/m);
// README: 环境变量表格包含 KEYS 变量
assert.match(readme, /\| `EMBEDDINGS_API_KEYS` \|/);
assert.match(readme, /\| `RERANK_API_KEYS` \|/);
// README: 只说明旧变量兼容，不提供单 key 示例值。
assert.match(readme, /EMBEDDINGS_API_KEY[\s\S]*旧变量[\s\S]*兼容/);
assert.match(readme, /RERANK_API_KEY[\s\S]*旧变量[\s\S]*兼容/);
assert.match(readme, /推荐使用 `_KEYS`/);

// 统一模板: KEYS 作为默认项，单 key 为注释
assert.match(DEFAULT_ENV_TEMPLATE, /^EMBEDDINGS_API_KEYS=your-api-key-here$/m);
assert.match(DEFAULT_ENV_TEMPLATE, /^#\s*EMBEDDINGS_API_KEY=your-api-key-here$/m);
assert.match(DEFAULT_ENV_TEMPLATE, /^RERANK_API_KEYS=your-api-key-here$/m);
assert.match(DEFAULT_ENV_TEMPLATE, /^#\s*RERANK_API_KEY=your-api-key-here$/m);

// CLI/MCP 不应再维护第二份可漂移的 env 模板。
assert.match(cliTemplateSource, /DEFAULT_ENV_TEMPLATE/);
assert.match(mcpTemplateSource, /DEFAULT_ENV_TEMPLATE/);
