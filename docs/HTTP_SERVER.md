# HTTP Server Mode

CodeRecall giờ đây hỗ trợ chạy MCP server qua HTTP thay vì stdio, cho phép tích hợp dễ dàng hơn với các service khác.

## Khởi động HTTP Server

```bash
# Chạy với port và host mặc định (3000, 127.0.0.1)
coderecall mcp-http

# Chỉ định port và host tùy chỉnh
coderecall mcp-http --port 8080 --host 0.0.0.0
```

## Endpoints

### 1. Health Check
```bash
GET http://localhost:3000/health

Response:
{
  "status": "ok",
  "service": "coderecall-mcp-http",
  "version": "1.0.0"
}
```

### 2. Get Models
```bash
GET/POST http://localhost:3000/get-models

Response: (giống /health)
{
  "status": "ok",
  "service": "coderecall-mcp-http",
  "version": "1.0.0"
}

# Example với GET
curl http://localhost:3000/get-models

# Example với POST (Augment BYOK sử dụng POST)
curl -X POST http://localhost:3000/get-models \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3. Augment Get Models
```bash
GET/POST http://localhost:3000/augment/get-models

Response: (giống /health)
{
  "status": "ok",
  "service": "coderecall-mcp-http",
  "version": "1.0.0"
}
```

### 4. MCP Protocol
```bash
POST http://localhost:3000/mcp

# Sử dụng MCP client để giao tiếp
# Example với curl:
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

## Sử dụng với MCP Clients

### Claude Desktop

Cấu hình trong `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coderecall-http": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

### Programmatic Usage (TypeScript/JavaScript)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HTTPClientTransport } from '@modelcontextprotocol/sdk/client/http.js';

const transport = new HTTPClientTransport({
  url: 'http://localhost:3000/mcp'
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// Gọi tools
const result = await client.callTool({
  name: 'codebase-retrieval',
  arguments: {
    repo_path: '/path/to/repo',
    information_request: 'How does authentication work?'
  }
});
```

## Architecture

HTTP server sử dụng:
- **Express.js** cho HTTP routing
- **StreamableHTTPServerTransport** từ MCP SDK cho protocol handling
- Hỗ trợ DNS rebinding protection cho localhost
- Logging qua Pino (tương tự stdio mode)

## So sánh với Stdio Mode

| Feature | Stdio Mode | HTTP Mode |
|---------|-----------|-----------|
| **Transport** | stdin/stdout | HTTP POST + SSE |
| **Use case** | Claude Desktop local | Web services, remote clients |
| **Command** | `coderecall mcp` | `coderecall mcp-http` |
| **Port** | N/A | Configurable (default 3000) |
| **Health check** | ❌ | ✅ `/health` endpoint |
| **Multiple clients** | ❌ (single process) | ✅ (concurrent requests) |

## Testing

```bash
# Run test suite
pnpm test

# Run HTTP server test only
pnpm exec tsx tests/runtime/http-server.test.ts

# Manual test with demo script
bash demo-http-server.sh
```

## Security Notes

- Mặc định bind đến `127.0.0.1` (localhost only)
- Có DNS rebinding protection khi bind đến localhost
- Để expose ra ngoài, dùng `--host 0.0.0.0` và thêm reverse proxy (nginx/caddy) với TLS

## Environment Variables

Tất cả environment variables trong `.coderecall/.env` vẫn áp dụng:
- `EMBEDDINGS_API_KEY` / `EMBEDDINGS_API_KEYS`
- `RERANK_API_KEY` / `RERANK_API_KEYS`
- `LOG_LEVEL=debug` để bật debug logs
- Xem thêm trong `CLAUDE.md`
