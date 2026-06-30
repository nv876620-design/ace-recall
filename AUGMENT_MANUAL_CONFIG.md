# 🔧 Cấu hình Manual - Augment BYOK + ACE

## Bước 1: Tạo Config File

### Windows:
```powershell
# Tạo thư mục .augment trong user home
mkdir C:\Users\%USERNAME%\.augment

# Tạo file config
notepad C:\Users\%USERNAME%\.augment\byok-config.json
```

### Linux/Mac:
```bash
# Tạo thư mục
mkdir -p ~/.augment

# Tạo file config
nano ~/.augment/byok-config.json
# hoặc
code ~/.augment/byok-config.json
```

---

## Bước 2: Copy Config JSON

Paste nội dung sau vào file `byok-config.json`:

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
    "autoIndex": false,
    "injectContext": true
  },
  "providers": [
    {
      "id": "anthropic",
      "name": "Claude",
      "apiKey": "sk-ant-YOUR_API_KEY_HERE",
      "models": [
        "claude-3-5-sonnet-20241022"
      ]
    }
  ]
}
```

### ⚠️ Thay đổi bắt buộc:

1. **API Key**: Thay `sk-ant-YOUR_API_KEY_HERE` bằng key thật
   - Lấy từ: https://console.anthropic.com/settings/keys

2. **ACE Path**: Update `mcpServerArgs[0]`
   
   **Windows** (escape backslashes):
   ```json
   "D:\\MCP\\ACE\\dist\\index.js"
   ```
   
   **Linux/Mac**:
   ```json
   "/home/username/ACE/dist/index.js"
   ```

---

## Bước 3: Verify File Location

Check file tồn tại:

### Windows:
```powershell
dir C:\Users\%USERNAME%\.augment\byok-config.json
```

### Linux/Mac:
```bash
ls -la ~/.augment/byok-config.json
```

Output phải hiện file với size > 0 bytes.

---

## Bước 4: Reload VS Code

```
Ctrl+Shift+P (hoặc Cmd+Shift+P)
→ Gõ: Developer: Reload Window
→ Enter
```

---

## Bước 5: Enable BYOK

```
Ctrl+Shift+P
→ Gõ: BYOK: Enable
→ Enter
```

Check status bar (bottom) hiện:
```
🔧 BYOK: Enabled
```

---

## 📁 Config File Paths

| Location | Path |
|----------|------|
| **User (Global)** | `~/.augment/byok-config.json` |
| **Workspace (Project)** | `<ProjectRoot>/.vscode/augment-byok-config.json` |

**Khuyến nghị**: Dùng User (Global) để áp dụng cho tất cả projects

---

## ✅ Verify Config Loaded

### Check trong VS Code:

1. Mở Output panel: `View` → `Output`
2. Select channel: **Augment**
3. Tìm log:
   ```
   [INFO] BYOK config loaded from: ~/.augment/byok-config.json
   ```

### Hoặc check bằng command:

**Windows**:
```powershell
type C:\Users\%USERNAME%\.augment\byok-config.json
```

**Linux/Mac**:
```bash
cat ~/.augment/byok-config.json
```

---

## 🎯 Full Example Config

### Minimal (Chỉ Anthropic):
```json
{
  "version": 1,
  "ace": {
    "enabled": true,
    "mcpServerPath": "node",
    "mcpServerArgs": ["D:\\MCP\\ACE\\dist\\index.js", "mcp"],
    "autoIndex": false,
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

### With OpenAI:
```json
{
  "version": 1,
  "ace": {
    "enabled": true,
    "mcpServerPath": "node",
    "mcpServerArgs": ["D:\\MCP\\ACE\\dist\\index.js", "mcp"],
    "autoIndex": false,
    "injectContext": true
  },
  "providers": [
    {
      "id": "openai",
      "apiKey": "sk-...",
      "models": ["gpt-4-turbo", "gpt-3.5-turbo"]
    }
  ]
}
```

### Multiple Providers:
```json
{
  "version": 1,
  "ace": {
    "enabled": true,
    "mcpServerPath": "node",
    "mcpServerArgs": ["D:\\MCP\\ACE\\dist\\index.js", "mcp"],
    "autoIndex": false,
    "injectContext": true
  },
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

## 🔍 Config Options Explained

### ACE Section:

```json
{
  "ace": {
    "enabled": true,              // Bật ACE integration
    "mcpServerPath": "node",      // Command để spawn MCP server
    "mcpServerArgs": [            // Arguments cho command
      "D:\\MCP\\ACE\\dist\\index.js",
      "mcp"
    ],
    "autoIndex": false,           // Không dùng (Augment indexing disabled)
    "injectContext": true,        // Inject search results vào chat
    "workspacePath": null         // Optional: override workspace path
  }
}
```

### MCP Server Options:

#### Option 1: Node + dist/index.js (Khuyến nghị)
```json
{
  "mcpServerPath": "node",
  "mcpServerArgs": ["D:\\MCP\\ACE\\dist\\index.js", "mcp"]
}
```

#### Option 2: Global command (cần link trước)
```json
{
  "mcpServerPath": "ace",
  "mcpServerArgs": ["mcp"]
}
```
Requires: `cd D:\MCP\ACE && pnpm link --global`

#### Option 3: tsx + TypeScript source
```json
{
  "mcpServerPath": "tsx",
  "mcpServerArgs": ["D:\\MCP\\ACE\\src\\index.ts", "mcp"]
}
```
Requires: `npm install -g tsx`

---

## 🐛 Common Issues

### Issue 1: File không tồn tại sau khi tạo

**Check**:
```bash
ls -la ~/.augment/
```

**Fix**:
```bash
mkdir -p ~/.augment
touch ~/.augment/byok-config.json
# paste config vào file
```

### Issue 2: JSON syntax error

**Symptom**: BYOK không load, log hiện "invalid JSON"

**Fix**: Validate JSON tại https://jsonlint.com/
- Common errors:
  - Thiếu comma giữa các fields
  - Trailing comma cuối object
  - Single quotes thay vì double quotes
  - Escape backslashes: `D:\\path` (Windows)

### Issue 3: Config không load sau khi reload

**Fix**:
1. Check file path chính xác:
   ```bash
   cat ~/.augment/byok-config.json
   ```
2. Check permissions:
   ```bash
   chmod 644 ~/.augment/byok-config.json
   ```
3. Restart VS Code hoàn toàn (tắt và mở lại)

### Issue 4: MCP server path không đúng

**Symptom**: Log hiện "spawn ... ENOENT"

**Fix**: Get absolute path:
```bash
# Windows
cd D:\MCP\ACE
echo %cd%\dist\index.js

# Linux/Mac
cd ~/ACE
echo $(pwd)/dist/index.js
```

Copy path vào config với proper escaping.

---

## ✅ Test Config

### Step 1: Test MCP Server Manually

**Windows**:
```powershell
node D:\MCP\ACE\dist\index.js mcp
```

**Linux/Mac**:
```bash
node ~/ACE/dist/index.js mcp
```

Nếu chạy OK, sẽ thấy:
```
MCP server started on stdio...
```

Press `Ctrl+C` để thoát.

### Step 2: Test trong VS Code

1. Open folder với code
2. Open Augment chat
3. Ask: "What files are in this project?"
4. Check Output → Augment:
   ```
   [INFO] ACE: Connecting to MCP server
   [INFO] ACE: Connected successfully
   [INFO] ACE: Searching...
   [INFO] ACE: Injecting context { chunks: 3 }
   ```

---

## 📝 Quick Commands

```bash
# Tạo config file
mkdir -p ~/.augment && cat > ~/.augment/byok-config.json << 'EOF'
{
  "version": 1,
  "ace": {
    "enabled": true,
    "mcpServerPath": "node",
    "mcpServerArgs": ["/path/to/ACE/dist/index.js", "mcp"],
    "autoIndex": false,
    "injectContext": true
  },
  "providers": [{
    "id": "anthropic",
    "apiKey": "sk-ant-YOUR_KEY",
    "models": ["claude-3-5-sonnet-20241022"]
  }]
}
EOF

# Verify
cat ~/.augment/byok-config.json

# Edit
code ~/.augment/byok-config.json
```

**⚠️ Remember**: Thay `YOUR_KEY` và `/path/to/ACE`

---

## 🎯 Next Steps

1. ✅ Config file created
2. ✅ API key added
3. ✅ MCP server path correct
4. ✅ VS Code reloaded
5. ✅ BYOK enabled
6. 📝 Test: Open folder → Chat → Check logs

**If everything works**: Augment sẽ dùng ACE để search code thay vì native indexing

---

**Generated**: 2026-06-14  
**VSIX**: augment.vscode-augment.0.876.0-byok.20260614120301.vsix
