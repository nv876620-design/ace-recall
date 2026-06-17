# ⚡ Quick Config Guide - Augment BYOK + CodeRecall

## 🚀 Method 1: Auto-generate (Recommended - 1 phút)

```bash
cd D:\MCP\CodeRecall

# Interactive (will prompt for API key)
node scripts/generate-augment-config.cjs

# Or with key directly
node scripts/generate-augment-config.cjs --anthropic-key sk-ant-YOUR_KEY
```

Script tự động:
- ✅ Tạo `~/.augment/byok-config.json`
- ✅ Set CodeRecall path
- ✅ Add API key
- ✅ Config providers

**Then**: Reload VS Code → `BYOK: Enable`

---

## 📝 Method 2: Manual (2 phút)

1. **Install VSIX**
   ```
   Ctrl+Shift+P → Extensions: Install from VSIX
   → Select: augment.vscode-augment.0.876.0-byok.20260614120301.vsix
   → Reload VS Code
   ```

2. **Create Config**
   ```
   Ctrl+Shift+P → BYOK: Open Config Panel
   → Create Config File → User Settings
   ```

3. **Paste Config**
   ```json
   {
     "version": 1,
     "coderecall": {
       "enabled": true,
       "mcpServerPath": "node",
       "mcpServerArgs": ["D:\\MCP\\CodeRecall\\dist\\index.js", "mcp"],
       "autoIndex": false,
       "injectContext": true
     },
     "providers": [{
       "id": "anthropic",
       "apiKey": "sk-ant-YOUR_KEY",
       "models": ["claude-3-5-sonnet-20241022"]
     }]
   }
   ```
   
   **⚠️ Thay đổi**:
   - `apiKey`: Your Anthropic API key
   - `mcpServerArgs[0]`: Absolute path to `CodeRecall/dist/index.js`

4. **Enable**
   ```
   Ctrl+Shift+P → BYOK: Enable
   ```

## ✅ Test (30 giây)

```
1. Open folder with code
2. No Augment indexing spinner (good!)
3. Open Augment chat
4. Ask: "How does authentication work?"
5. Check Output → Augment for logs:
   [INFO] CodeRecall: Searching...
   [INFO] CodeRecall: Injecting context { chunks: 3 }
```

## 🔧 Config Locations

| Type | Path |
|------|------|
| **User** (global) | `~/.augment/byok-config.json` |
| **Workspace** (project) | `.vscode/augment-byok-config.json` |
| **CodeRecall env** | `~/.coderecall/.env` |

## 📝 Common Config Options

### Windows Path
```json
{
  "mcpServerArgs": ["D:\\MCP\\CodeRecall\\dist\\index.js", "mcp"]
}
```

### Linux/Mac Path
```json
{
  "mcpServerArgs": ["/home/user/CodeRecall/dist/index.js", "mcp"]
}
```

### Using Global Command
```json
{
  "mcpServerPath": "coderecall",
  "mcpServerArgs": ["mcp"]
}
```
*Requires: `pnpm link --global` in CodeRecall repo*

### Multiple Providers
```json
{
  "providers": [
    {"id": "anthropic", "apiKey": "sk-ant-...", "models": ["claude-3-5-sonnet-20241022"]},
    {"id": "openai", "apiKey": "sk-...", "models": ["gpt-4-turbo"]}
  ]
}
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Config not found | `Ctrl+Shift+P → BYOK: Open Config Panel` |
| MCP server won't start | Test: `node D:\MCP\CodeRecall\dist\index.js mcp` |
| Indexing still runs | Reinstall VSIX, reload VS Code |
| No CodeRecall context | Check Output → Augment for errors |
| Wrong workspace | Open folder (not file), or set `workspacePath` in config |

## 📖 Full Guide

See: `docs/AUGMENT_BYOK_CONFIG_GUIDE.md`

---

**VSIX**: `augment.vscode-augment.0.876.0-byok.20260614120301.vsix`  
**Location**: `D:\MCP\Augment_BYOK_gagmeng\dist\`
