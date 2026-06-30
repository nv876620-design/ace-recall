# ACE + Augment BYOK - Quick Start Guide

## Tổng quan

Tích hợp ACE MCP với Augment BYOK để:
- **Privacy**: Code search 100% local, không gửi lên cloud
- **Accuracy**: Semantic search tốt hơn context mặc định
- **Speed**: Instant response, không network latency
- **Cost**: Không tốn API calls cho context retrieval

## Prerequisites

1. **ACE** đã build:
   ```bash
   cd D:\MCP\ACE
   pnpm build
   ```

2. **ACE config** đã setup:
   ```bash
   ace init
   # Nhập API keys cho embedding và reranker
   ```

## Installation

### Bước 1: Install VSIX

1. Mở VS Code
2. **Extensions** → **Install from VSIX**
3. Chọn file: `D:\MCP\Augment_BYOK_gagmeng\dist\augment.vscode-augment.*-byok.*.vsix`
4. Reload VS Code

### Bước 2: Configure BYOK

1. Command Palette: `BYOK: Open Config Panel`

2. Enable ACE integration:
   ```json
   {
     "version": 1,
     "ace": {
       "enabled": true,
       "mcpServerPath": "node",
       "mcpServerArgs": [
         "D:\\MCP\\ACE\\dist\\index.js",
         "mcp"
       ],
       "autoIndex": true,
       "injectContext": true
     },
     "providers": [
       {
         "id": "anthropic",
         "apiKey": "sk-ant-...",
         "models": ["claude-3-5-sonnet-20241022"]
       }
     ]
   }
   ```

3. Save config

4. Command: `BYOK: Enable`

### Bước 3: Test Integration

1. Mở một folder code trong VS Code
2. Đợi vài giây để auto-indexing chạy
3. Mở Augment chat
4. Hỏi về codebase: _"Explain how the MCP server works"_
5. Verify response includes relevant code context

## How It Works

```
User opens folder
     ↓
Augment triggers workspace watcher
     ↓
ACE MCP indexes codebase
     ↓
User chats with Augment
     ↓
Context injector extracts query
     ↓
ACE MCP searches semantically
     ↓
Results injected into LLM context
     ↓
LLM responds with code insights
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `false` | Enable/disable ACE integration |
| `mcpServerPath` | `"ace"` | Path to ACE binary/command |
| `mcpServerArgs` | `["mcp"]` | Arguments for MCP server |
| `autoIndex` | `true` | Auto-index on folder open |
| `injectContext` | `true` | Inject search results into context |

## Troubleshooting

### 1. MCP Server Not Found

**Error**: `spawn ace ENOENT`

**Fix**: Use absolute path trong config:
```json
{
  "mcpServerPath": "node",
  "mcpServerArgs": [
    "D:\\MCP\\ACE\\dist\\index.js",
    "mcp"
  ]
}
```

### 2. No Search Results

**Causes**:
- Repo chưa được index (đợi vài giây)
- Query không match với code
- Embedding API key không valid

**Debug**: Check Output panel → "Augment" channel:
```
[INFO] ACE: Searching codebase { query: '...', path: '...' }
[INFO] ACE: Injected context { chunks: N, contextSize: ... }
```

### 3. Slow Indexing

**Large repos** (>10k files) mất vài phút để index lần đầu.

**Workaround**: Pre-index manually:
```bash
cd /path/to/repo
ace index .
```

## Verification

### Check Logs

VS Code Output Panel → "Augment":
```
[INFO] ACE: Connecting to MCP server
[INFO] ACE: Connected successfully
[INFO] ACE: Searching codebase
[INFO] ACE: Injected context { chunks: 3, contextSize: 1234 }
```

### Test Script

```bash
cd D:\MCP\ACE
node scripts/test-augment-mcp-client.cjs
```

Expected output:
```
✅ Test 1: Create client instance
   Client created: true
✅ Test 2: Connect to MCP server
   Connected: true
✅ Test 3: Search codebase
   Result chunks: N
✅ Test 4: Close connection
   Closed: true
✅ All tests passed!
```

## Advanced Usage

### Multiple Workspaces

ACE tự động phát hiện workspace path. Mỗi workspace được index riêng.

### Custom Search Options

Modify `context-injector.js` để tune search behavior:
```javascript
const result = await client.searchCodebase(query, repoPath, {
  source_code_only: true,          // Chỉ search code, bỏ docs
  technical_terms: ['API', 'auth'], // Boost specific terms
});
```

### Performance Tuning

Edit `~/.ace/.env`:
```env
EMBEDDINGS_MAX_CONCURRENCY=10  # Parallel embedding requests
RERANK_TOP_N=20               # Number of results to rerank
```

## Next Steps

- [ ] Test với large repos (>10k files)
- [ ] Tune search parameters cho accuracy
- [ ] Add caching cho repeated queries
- [ ] Monitor performance impact

## References

- [Technical Design](./AUGMENT_BYOK_ACE_INTEGRATION.md)
- [Integration Summary](./AUGMENT_INTEGRATION_SUMMARY.md)
- [ACE README](../README.md)
