# Augment BYOK Configuration for CodeRecall

Để sử dụng CodeRecall HTTP server với Augment BYOK:

## 1. Khởi động CodeRecall HTTP Server

```bash
cd D:\MCP\CodeRecall
pnpm build
coderecall mcp-http --port 3000 --host 127.0.0.1
```

## 2. Cấu hình trong Augment BYOK Config Panel

Thêm provider sau vào `providers[]`:

```json
{
  "id": "coderecall",
  "type": "openai_compatible",
  "baseUrl": "http://127.0.0.1:3000",
  "apiKey": "dummy-key-not-required",
  "models": [
    "coderecall-search"
  ],
  "defaultModel": "coderecall-search",
  "headers": {},
  "requestDefaults": {
    "temperature": 0.0
  }
}
```

**Lưu ý:**
- `baseUrl` KHÔNG cần `/v1` vì CodeRecall có endpoint riêng
- `apiKey` có thể để bất kỳ giá trị nào vì CodeRecall không verify
- `/get-models` endpoint sẽ trả về info thay vì danh sách models thực sự

## 3. Test Endpoints

### Test trực tiếp với curl:
```bash
# Health check
curl http://127.0.0.1:3000/health

# Get models (cho Augment BYOK)
curl http://127.0.0.1:3000/get-models

# Augment get models
curl http://127.0.0.1:3000/augment/get-models
```

## 4. Augment BYOK Commands

Trong VS Code:
1. `BYOK: Open Config Panel` - Mở panel cấu hình
2. Thêm provider CodeRecall như trên
3. `Save` config
4. `BYOK: Enable` - Bật BYOK runtime
5. `BYOK: Self Test` - Test tất cả endpoints

## 5. Troubleshooting

### Lỗi 404 HTML Response
Nguyên nhân: Augment BYOK đang gọi sai URL hoặc thiếu endpoint

**Giải pháp:**
- Kiểm tra `baseUrl` trong config: `http://127.0.0.1:3000` (không có `/v1`)
- Đảm bảo CodeRecall server đang chạy: `curl http://127.0.0.1:3000/health`
- Xem logs của CodeRecall server

### Endpoint Mapping

Augment BYOK expects:
- `/get-models` → Returns model list (CodeRecall trả về status info)
- `/chat/completions` → OpenAI-compatible chat endpoint (CodeRecall chưa có)
- `/augment/get-models` → Alternative endpoint (CodeRecall đã có)

**Lưu ý quan trọng:** 
CodeRecall HTTP server hiện tại chỉ có:
- `/health`
- `/get-models` 
- `/augment/get-models`
- `/mcp` (MCP protocol, không phải OpenAI compatible)

Nếu bạn muốn CodeRecall hoạt động như một OpenAI-compatible provider cho Augment BYOK, cần thêm endpoint `/chat/completions` hoặc `/v1/chat/completions`.

## 6. Kiến nghị

CodeRecall server hiện tại chủ yếu là MCP server, không phải OpenAI-compatible API server. Để tích hợp với Augment BYOK, cần:

1. **Thêm OpenAI-compatible endpoints:**
   - `POST /v1/chat/completions`
   - `POST /v1/completions`
   - Format response theo OpenAI API spec

2. **Hoặc sử dụng Augment BYOK với MCP transport** (nếu Augment hỗ trợ)

3. **Hoặc tạo adapter/proxy** chuyển đổi giữa MCP và OpenAI format
