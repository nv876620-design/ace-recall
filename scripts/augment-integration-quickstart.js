#!/usr/bin/env node
/**
 * Quick Start Script: Augment BYOK + CodeRecall Integration
 *
 * Hướng dẫn tích hợp nhanh
 */

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Augment BYOK + CodeRecall Integration Setup             ║
╚═══════════════════════════════════════════════════════════╝

## Bước 1: Chuẩn bị CodeRecall

cd D:\\MCP\\CodeRecall
pnpm build
pnpm link --global

Test MCP server:
  coderecall mcp

## Bước 2: Thêm dependencies vào BYOK

cd D:\\MCP\\Augment_BYOK_gagmeng
npm install @modelcontextprotocol/sdk@^1.25.1

## Bước 3: Tạo integration modules

Tạo thư mục:
  mkdir -p payload/extension/out/byok/integrations/coderecall

Copy các file từ docs/AUGMENT_BYOK_CODERECALL_INTEGRATION.md:
  1. mcp-client.js
  2. context-injector.js
  3. workspace-watcher.js

## Bước 4: Modify BYOK code

File cần sửa:
  1. payload/extension/out/byok/runtime/shim/byok-chat/index.js
     → Import context-injector
     → Hook vào byokChat function

  2. payload/extension/out/byok/config/default-config.js
     → Thêm coderecall config section

## Bước 5: Build và test

npm run build:vsix
→ Install VSIX vào VS Code
→ Mở folder
→ Test chat với code questions

## Bước 6: Verify

Check logs trong VS Code Output panel:
  - "CodeRecall: Workspace opened"
  - "CodeRecall: Searching codebase"
  - "CodeRecall: Injected context"

## Troubleshooting

Problem: MCP connection failed
→ Check: coderecall mcp command works
→ Check: PATH includes coderecall

Problem: No context injected
→ Check: coderecall.enabled = true
→ Check: workspacePath is set
→ Check: CodeRecall indexing completed

Problem: Search returns nothing
→ Check: EMBEDDINGS_API_KEY configured
→ Run: coderecall index <path>

## Support

Docs: D:\\MCP\\CodeRecall\\docs\\AUGMENT_BYOK_CODERECALL_INTEGRATION.md
Issues: Check logs in VS Code Output → Augment

`);
