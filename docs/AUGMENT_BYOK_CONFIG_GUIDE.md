# Hướng dẫn Cấu hình Augment BYOK với CodeRecall

## Bước 1: Cài đặt Extension

### 1.1. Mở VS Code

### 1.2. Install VSIX
- Nhấn `Ctrl+Shift+P` (hoặc `Cmd+Shift+P` trên Mac)
- Gõ: `Extensions: Install from VSIX`
- Chọn file: `D:\MCP\Augment_BYOK_gagmeng\dist\augment.vscode-augment.0.876.0-byok.20260614120301.vsix`
- Chờ VS Code install (khoảng 10-20 giây)
- Reload VS Code khi được yêu cầu

### 1.3. Verify Installation
- Check trong Extensions list có "Augment" với tag "(BYOK)"
- Output panel sẽ có channel "Augment"

---

## Bước 2: Cấu hình BYOK

### Cách 1: Qua Config Panel UI (Khuyến nghị)

#### 2.1. Mở Config Panel
- Nhấn `Ctrl+Shift+P`
- Gõ: `BYOK: Open Config Panel`
- Enter

#### 2.2. Tạo Config File
Nếu lần đầu sử dụng, panel sẽ hiện:
```
BYOK not configured yet
[ Create Config File ]
```
Click "Create Config File"

#### 2.3. Chọn Config Location
VS Code sẽ hỏi:
```
Where should the config be stored?
• User Settings (global)
• Workspace Settings (project-specific)
```

**Khuyến nghị**: Chọn **User Settings** (áp dụng cho tất cả workspaces)

#### 2.4. Nhập Config JSON

Config panel sẽ mở một editor. Copy-paste config sau:

```json
{
  "version": 1,
  "coderecall": {
    "enabled": true,
    "mcpServerPath": "node",
    "mcpServerArgs": [
      "D:\\MCP\\CodeRecall\\dist\\index.js",
      "mcp"
    ],
    "autoIndex": false,
    "injectContext": true
  },
  "providers": [
    {
      "id": "anthropic",
      "name": "Claude (Anthropic)",
      "apiKey": "sk-ant-YOUR_API_KEY_HERE",
      "models": [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229"
      ]
    }
  ]
}
```

**Thay đổi cần thiết**:
1. `"apiKey"`: Thay bằng Anthropic API key của bạn (hoặc OpenAI nếu dùng OpenAI)
2. `mcpServerArgs[0]`: Đường dẫn tuyệt đối đến `CodeRecall/dist/index.js`
   - Windows: `"D:\\MCP\\CodeRecall\\dist\\index.js"`
   - Linux/Mac: `"/path/to/CodeRecall/dist/index.js"`

#### 2.5. Lưu Config
- Nhấn `Ctrl+S` để save
- Panel sẽ hiện: `Config saved successfully`

---

### Cách 2: Qua File JSON (Manual)

#### 2.1. Tạo Config File

**User Settings** (global):
```bash
# Windows
C:\Users\<YourUsername>\.augment\byok-config.json

# Linux/Mac
~/.augment/byok-config.json
```

**Workspace Settings** (project-specific):
```bash
<ProjectRoot>/.vscode/augment-byok-config.json
```

#### 2.2. Tạo File và Paste Config

```json
{
  "version": 1,
  "coderecall": {
    "enabled": true,
    "mcpServerPath": "node",
    "mcpServerArgs": [
      "D:\\MCP\\CodeRecall\\dist\\index.js",
      "mcp"
    ],
    "autoIndex": false,
    "injectContext": true
  },
  "providers": [
    {
      "id": "anthropic",
      "apiKey": "sk-ant-YOUR_API_KEY_HERE",
      "models": ["claude-3-5-sonnet-20241022"]
    }
  ]
}
```

#### 2.3. Reload VS Code
- `Ctrl+Shift+P` → `Developer: Reload Window`

---

## Bước 3: Enable BYOK

### 3.1. Enable Command
- `Ctrl+Shift+P`
- Gõ: `BYOK: Enable`
- Enter

### 3.2. Verify Enabled
Status bar (bottom) sẽ hiện:
```
🔧 BYOK: Enabled
```

---

## Bước 4: Test Integration

### 4.1. Mở một Code Folder
- `File` → `Open Folder`
- Chọn một project có code (ví dụ: CodeRecall project)

### 4.2. Verify Augment Indexing KHÔNG chạy
- **Quan trọng**: Không thấy "Augment is indexing..." spinner
- Nếu vẫn thấy spinner → patch chưa hoạt động

### 4.3. Mở Augment Chat
- Click icon Augment trong sidebar (hoặc `Ctrl+Shift+A`)
- Chat panel mở

### 4.4. Test CodeRecall Context
Gõ một câu hỏi về code:
```
How does the MCP server work?
```

### 4.5. Check Logs
- `View` → `Output`
- Select channel: **Augment**
- Tìm logs:
```
[INFO] CodeRecall: Searching for relevant code { query: '...', workspace: '...' }
[INFO] CodeRecall: Injecting context { chunks: 3, contextSize: 1234 }
```

### 4.6. Verify Response
Response từ LLM nên reference code cụ thể từ project của bạn (không phải generic answer).

---

## Cấu hình Chi tiết

### CodeRecall Section

```json
{
  "coderecall": {
    "enabled": true,           // Bật/tắt CodeRecall
    "mcpServerPath": "node",   // Command để chạy MCP server
    "mcpServerArgs": [         // Arguments cho command
      "D:\\MCP\\CodeRecall\\dist\\index.js",
      "mcp"
    ],
    "autoIndex": false,        // KHÔNG dùng (Augment indexing disabled)
    "injectContext": true,     // Inject CodeRecall results vào chat
    "workspacePath": null      // Optional: override workspace path
  }
}
```

#### Tùy chọn `mcpServerPath` và `mcpServerArgs`

**Option 1: Dùng Node trực tiếp** (Khuyến nghị)
```json
{
  "mcpServerPath": "node",
  "mcpServerArgs": [
    "D:\\MCP\\CodeRecall\\dist\\index.js",
    "mcp"
  ]
}
```

**Option 2: Dùng npm global package** (Nếu đã link)
```json
{
  "mcpServerPath": "coderecall",
  "mcpServerArgs": ["mcp"]
}
```
⚠️ Yêu cầu: `pnpm link --global` hoặc `npm link` trong CodeRecall repo

**Option 3: Absolute path đến executable**
```json
{
  "mcpServerPath": "D:\\MCP\\CodeRecall\\node_modules\\.bin\\tsx",
  "mcpServerArgs": [
    "D:\\MCP\\CodeRecall\\src\\index.ts",
    "mcp"
  ]
}
```

### Providers Section

#### Anthropic (Claude)
```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Claude",
      "apiKey": "sk-ant-...",
      "baseUrl": "https://api.anthropic.com",  // Optional
      "models": [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-haiku-20240307"
      ]
    }
  ]
}
```

#### OpenAI
```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "apiKey": "sk-...",
      "models": [
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo"
      ]
    }
  ]
}
```

#### Multiple Providers
```json
{
  "providers": [
    {
      "id": "anthropic",
      "apiKey": "sk-ant-...",
      "models": ["claude-3-5-sonnet-20241022"]
    },
    {
      "id": "openai",
      "apiKey": "sk-...",
      "models": ["gpt-4-turbo"]
    }
  ]
}
```

---

## Troubleshooting

### Issue 1: "BYOK config not found"

**Cause**: Config file không tồn tại hoặc sai path

**Fix**:
1. Check file tồn tại:
   - User: `~/.augment/byok-config.json`
   - Workspace: `.vscode/augment-byok-config.json`
2. Tạo lại qua Config Panel
3. Check permissions (file phải readable)

### Issue 2: "CodeRecall MCP server failed to start"

**Cause**: `mcpServerPath` hoặc `mcpServerArgs` không đúng

**Fix**:
1. Test command manually:
   ```bash
   node D:\MCP\CodeRecall\dist\index.js mcp
   ```
2. Nếu lỗi → check CodeRecall có build chưa:
   ```bash
   cd D:\MCP\CodeRecall
   pnpm build
   ```
3. Update `mcpServerArgs` với đường dẫn tuyệt đối

### Issue 3: "No workspace path found"

**Cause**: VS Code không open folder, hoặc config thiếu

**Fix**:
1. `File` → `Open Folder` (KHÔNG phải Open File)
2. Hoặc thêm vào config:
   ```json
   {
     "coderecall": {
       "workspacePath": "D:\\MyProject"
     }
   }
   ```

### Issue 4: Augment indexing vẫn chạy

**Cause**: Patch chưa apply hoặc VSIX cũ

**Fix**:
1. Uninstall Augment extension cũ
2. Install lại VSIX mới nhất
3. Reload VS Code
4. Check log có dòng:
   ```
   [BYOK] Augment indexing disabled, use CodeRecall instead
   ```

### Issue 5: No CodeRecall context in response

**Cause**: 
- CodeRecall chưa index repo
- Query không match code
- Config `injectContext: false`

**Fix**:
1. Check logs trong Output → Augment:
   ```
   [INFO] CodeRecall: Searching...
   [INFO] CodeRecall: Injecting context { chunks: N }
   ```
2. Nếu không thấy log → check config:
   ```json
   {"coderecall": {"enabled": true, "injectContext": true}}
   ```
3. Index manually:
   ```bash
   cd /path/to/project
   coderecall index .
   ```

---

## Advanced Configuration

### Custom Search Options

Modify `context-injector.js` để tune search:

```javascript
// File: payload/extension/out/byok/integrations/coderecall/context-injector.js

const searchResult = await client.searchCodebase(query, finalWorkspacePath, {
  source_code_only: true,          // Chỉ search code
  technical_terms: technicalTerms, // Boost keywords
  top_k: 10,                       // Số lượng chunks
  score_threshold: 0.5,            // Minimum score
});
```

### CodeRecall Environment Variables

Tạo `~/.coderecall/.env`:
```env
# Embedding API
EMBEDDINGS_API_KEY=your-key-here
EMBEDDINGS_BASE_URL=https://api.openai.com/v1
EMBEDDINGS_MODEL=text-embedding-3-small
EMBEDDINGS_DIMENSIONS=1536

# Reranker API
RERANK_API_KEY=your-cohere-key
RERANK_MODEL=rerank-multilingual-v3.0
RERANK_TOP_N=20

# Search tuning
IGNORE_PATTERNS=node_modules,dist,build
LOG_LEVEL=info
```

Sau đó init:
```bash
coderecall init
```

---

## Verification Checklist

- [ ] VSIX installed thành công
- [ ] Config file tồn tại và valid JSON
- [ ] BYOK enabled (status bar hiện "BYOK: Enabled")
- [ ] Augment indexing KHÔNG chạy (no spinner)
- [ ] CodeRecall MCP server có thể spawn
- [ ] Logs hiện "CodeRecall: Searching..."
- [ ] Logs hiện "CodeRecall: Injecting context"
- [ ] Chat response reference code từ project

---

## Next Steps

1. **Test với nhiều projects**: Mở các folders khác nhau
2. **Tune search quality**: Adjust CodeRecall config trong `~/.coderecall/.env`
3. **Monitor performance**: Check response time và context size
4. **Report issues**: Nếu có bugs, check logs trong Output → Augment

---

**Generated**: 2026-06-14  
**VSIX Version**: 0.876.0-byok.20260614120301  
**CodeRecall Integration**: v1.0
