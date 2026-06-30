# Tích hợp ACE với Augment BYOK

## Mục tiêu

Khi Augment mở folder và user trigger chat/completion, thay vì dùng context từ Augment cloud, sẽ sử dụng ACE MCP để:
1. Index codebase locally
2. Search relevant code
3. Inject vào LLM context

## Kiến trúc

```
User mở folder trong VS Code
        ↓
Augment Extension activate
        ↓
[NEW] Trigger ACE indexing
        ↓
User chat/completion
        ↓
Augment BYOK intercept request
        ↓
[NEW] Query ACE MCP for relevant code
        ↓
[NEW] Inject ACE results vào context
        ↓
Forward request đến LLM (OpenAI/Anthropic/etc)
        ↓
Return response
```

## Implementation Plan

### Phase 1: MCP Client Module

Tạo file: `D:\MCP\Augment_BYOK_gagmeng\payload\extension\out\byok\integrations\ace\mcp-client.js`

```javascript
"use strict";

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { spawn } = require("child_process");

class ACEMCPClient {
  constructor(mcpServerPath = "ace", mcpServerArgs = ["mcp"]) {
    this.serverPath = mcpServerPath;
    this.serverArgs = mcpServerArgs;
    this.client = null;
    this.transport = null;
  }

  async connect() {
    if (this.client) return;

    // Spawn ACE MCP server
    const serverProcess = spawn(this.serverPath, this.serverArgs, {
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Create transport
    this.transport = new StdioClientTransport({
      stdin: serverProcess.stdin,
      stdout: serverProcess.stdout,
    });

    // Create client
    this.client = new Client(
      {
        name: "augment-byok-ace",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
  }

  async indexRepository(repoPath) {
    if (!this.client) await this.connect();

    // Trigger indexing via MCP
    // Note: ACE auto-indexes on first query
    return { indexed: true, path: repoPath };
  }

  async searchCodebase(query, repoPath, options = {}) {
    if (!this.client) await this.connect();

    const result = await this.client.callTool({
      name: "codebase-retrieval",
      arguments: {
        repo_path: repoPath,
        information_request: query,
        technical_terms: options.technical_terms || [],
        source_code_only: options.source_code_only !== false,
      },
    });

    return this.parseToolResult(result);
  }

  parseToolResult(result) {
    if (!result || !result.content) return { chunks: [], error: null };

    const textContent = result.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    return {
      chunks: [{ content: textContent }],
      error: result.isError ? textContent : null,
    };
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }
}

// Singleton instance
let globalClient = null;

function getACEClient() {
  if (!globalClient) {
    globalClient = new ACEMCPClient();
  }
  return globalClient;
}

module.exports = {
  ACEMCPClient,
  getACEClient,
};
```

### Phase 2: Context Injection

Tạo file: `D:\MCP\Augment_BYOK_gagmeng\payload\extension\out\byok\integrations\ace\context-injector.js`

```javascript
"use strict";

const { getACEClient } = require("./mcp-client");
const { normalizeString } = require("../../infra/util");
const { info, warn } = require("../../infra/log");

async function injectACEContext(augmentRequest, workspacePath) {
  // Extract query from message
  const query = normalizeString(augmentRequest.message);
  if (!query || !workspacePath) {
    return augmentRequest; // No modification
  }

  try {
    const client = getACEClient();
    
    info("ACE: Searching codebase", { query: query.slice(0, 100), workspacePath });

    const searchResult = await client.searchCodebase(query, workspacePath, {
      source_code_only: true,
      technical_terms: [], // Could extract from query
    });

    if (searchResult.error) {
      warn("ACE search failed", { error: searchResult.error });
      return augmentRequest;
    }

    if (!searchResult.chunks || searchResult.chunks.length === 0) {
      info("ACE: No relevant code found");
      return augmentRequest;
    }

    // Inject search results into context
    const codeRecallContext = searchResult.chunks
      .map((chunk, idx) => `\n\n--- ACE Result ${idx + 1} ---\n${chunk.content}`)
      .join("\n");

    // Inject vào selected_code hoặc prefix
    const injectedRequest = {
      ...augmentRequest,
      selected_code: augmentRequest.selected_code
        ? `${augmentRequest.selected_code}\n\n=== Relevant Codebase Context ===\n${codeRecallContext}`
        : `=== Relevant Codebase Context ===\n${codeRecallContext}`,
    };

    info("ACE: Injected context", { 
      chunks: searchResult.chunks.length,
      contextSize: codeRecallContext.length 
    });

    return injectedRequest;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    warn("ACE injection failed", { error });
    return augmentRequest; // Fallback to original
  }
}

module.exports = {
  injectACEContext,
};
```

### Phase 3: Hook vào BYOK Chat Handler

Modify file: `D:\MCP\Augment_BYOK_gagmeng\payload\extension\out\byok\runtime\shim\byok-chat\index.js`

Thêm vào đầu file:
```javascript
const { injectACEContext } = require("../../../integrations/ace/context-injector");
```

Trong function `byokChat`, trước khi gọi `normalizeAugmentChatRequest`, thêm:
```javascript
async function byokChat({ cfg, provider, model, requestedModel, body, timeoutMs, abortSignal, upstreamCompletionURL, upstreamApiToken, requestId }) {
  // [NEW] Inject ACE context
  const workspacePath = process.env.VSCODE_WORKSPACE_PATH; // Need to pass from extension
  if (workspacePath) {
    body = await injectACEContext(body, workspacePath);
  }

  // Original code continues...
  const req = normalizeAugmentChatRequest(body);
  // ...
}
```

### Phase 4: Folder Open Hook

Tạo file: `D:\MCP\Augment_BYOK_gagmeng\payload\extension\out\byok\integrations\ace\workspace-watcher.js`

```javascript
"use strict";

const { getACEClient } = require("./mcp-client");
const { info } = require("../../infra/log");

async function onWorkspaceOpened(workspacePath) {
  if (!workspacePath) return;

  info("ACE: Workspace opened, triggering index", { path: workspacePath });

  try {
    const client = getACEClient();
    await client.indexRepository(workspacePath);
    info("ACE: Index triggered successfully");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("ACE index failed:", error);
  }
}

module.exports = {
  onWorkspaceOpened,
};
```

### Phase 5: Configuration

Thêm vào config schema: `D:\MCP\Augment_BYOK_gagmeng\payload\extension\out\byok\config\default-config.js`

```javascript
// Add new section
ace: {
  enabled: false, // Must be explicitly enabled
  mcpServerPath: "ace", // or absolute path
  mcpServerArgs: ["mcp"],
  autoIndex: true, // Auto-index on folder open
  injectContext: true, // Inject search results into LLM context
}
```

## Testing

### 1. Test MCP Client
```bash
cd D:\MCP\Augment_BYOK_gagmeng
node -e "
const { getACEClient } = require('./payload/extension/out/byok/integrations/ace/mcp-client');
(async () => {
  const client = getACEClient();
  const result = await client.searchCodebase('authentication', 'D:/path/to/repo');
  console.log(result);
})();
"
```

### 2. Test trong VS Code
1. Build BYOK với changes: `npm run build:vsix`
2. Install VSIX
3. Enable BYOK + ACE integration
4. Mở một folder
5. Check logs: ACE indexing triggered
6. Chat/ask về code → Verify ACE context được inject

### 3. Verify Context Injection
Check trong LLM request logs xem có thấy:
```
=== Relevant Codebase Context ===
--- ACE Result 1 ---
[code snippets from ACE]
```

## Dependencies cần thêm

Add vào `package.json`:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.1"
  }
}
```

## Configuration Example

Trong VS Code Settings hoặc BYOK Config Panel:
```json
{
  "version": 1,
  "ace": {
    "enabled": true,
    "mcpServerPath": "D:/MCP/ACE/dist/index.js",
    "mcpServerArgs": ["mcp"],
    "autoIndex": true,
    "injectContext": true
  },
  "providers": [
    // Your existing BYOK providers
  ]
}
```

## Benefits

1. ✅ **Privacy**: Code stays local, không gửi lên cloud
2. ✅ **Speed**: Local search nhanh hơn cloud
3. ✅ **Control**: Kiểm soát indexing và search behavior
4. ✅ **Cost**: Không tốn API calls cho context retrieval
5. ✅ **Accuracy**: ACE semantic search tốt hơn simple grep

## Limitations

1. ACE MCP phải đang chạy hoặc có thể spawn
2. Cần disk space cho indexes (LanceDB + SQLite)
3. Initial indexing mất thời gian với large repos
4. Cần config ACE API keys (embedding/reranker)

## Next Steps

1. Implement MCP client module
2. Add context injection logic
3. Hook vào chat/completion handlers
4. Test end-to-end
5. Add configuration UI trong BYOK Config Panel
6. Document usage và troubleshooting
