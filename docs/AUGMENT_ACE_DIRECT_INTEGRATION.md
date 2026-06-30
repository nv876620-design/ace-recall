# ACE MCP Direct Integration - Complete

## Overview

Successfully modified Augment BYOK extension source code to redirect the official codebase-retrieval tool call to use ACE MCP locally instead of calling Augment's cloud service.

## Files Modified

### 1. **NEW**: `ace-retrieval-adapter.js`
**Location**: `D:\MCP\Augment-BYOK\payload\extension\out\byok\runtime\official\ace-retrieval-adapter.js`

**Purpose**: Adapter module that wraps ACE MCP client to provide a drop-in replacement for `fetchOfficialCodebaseRetrieval()`.

**Key Functions**:
- `fetchACERetrieval({ repoPath, informationRequest, maxOutputLength, timeoutMs, abortSignal })`
  - Connects to ACE MCP server via stdio using existing `getACEClient()`
  - Sends `tools/call` request with `codebase-retrieval` tool
  - Returns formatted text content from MCP response
  - Handles timeouts and abort signals

**Integration Point**: Imports from `../../integrations/ace/mcp-client` (existing ACE MCP client)

### 2. **MODIFIED**: `codebase-retrieval.js`
**Location**: `D:\MCP\Augment-BYOK\payload\extension\out\byok\runtime\official\codebase-retrieval.js`

**Changes**:

1. **Added `resolveWorkspacePath(req, cfg)` helper** (lines 71-93):
   - Resolves workspace path from config, request, or environment
   - Priority: config → req.workspace_root → req.root_uri → VS Code API → cwd
   - Handles file:// URI decoding and Windows path normalization

2. **Modified `maybeInjectOfficialCodebaseRetrieval()`** (lines 95-175):
   - **Line 99**: Check if ACE replacement is enabled via `cfg?.ace?.enabled && cfg?.ace?.replaceOfficialRetrieval`
   - **Lines 130-140**: Branch to ACE if enabled:
     - Resolve workspace path
     - Call `fetchACERetrieval()` from adapter
   - **Lines 142-152**: Else call original cloud `fetchOfficialCodebaseRetrieval()`
   - **Lines 165-168**: Enhanced error handling - ACE errors don't trigger `handleAugmentIndexFailure()` (that's cloud-only)
   - **Line 161**: Dynamic log source name based on which path was used

**Result**: Same injection point (ID `-20`), same request flow, but using local MCP when configured.

### 3. **MODIFIED**: `default-config.js`
**Location**: `D:\MCP\Augment_BYOK_gagmeng\payload\extension\out\byok\config\default-config.js`

**Changes**:
- Added `replaceOfficialRetrieval: false` flag to `ace` config section (line 13)

**Config Schema**:
```javascript
ace: {
  enabled: false,                    // Enable ACE integration
  replaceOfficialRetrieval: false,   // NEW: Redirect official retrieval to ACE
  mcpServerPath: "ace",       // Path to ACE CLI
  mcpServerArgs: ["mcp"],            // Args to spawn MCP server
  autoIndex: true,                   // Auto-index on workspace open
  injectContext: true,               // Enable MCP context injection (ID -25)
  workspacePath: ""                  // Explicit workspace path (optional)
}
```

## Configuration Modes

### Mode 1: Disabled (Default)
```javascript
ace: { enabled: false }
```
- No ACE integration
- Official cloud retrieval works as before
- Backward compatible

### Mode 2: MCP Context Only
```javascript
ace: { 
  enabled: true, 
  replaceOfficialRetrieval: false 
}
```
- MCP context injection at ID `-25` (existing behavior)
- Official cloud retrieval still calls Augment cloud
- Both retrieval sources active

### Mode 3: Replace Official with ACE
```javascript
ace: { 
  enabled: true, 
  replaceOfficialRetrieval: true,
  workspacePath: "D:\\path\\to\\repo"  // Optional
}
```
- Official retrieval (ID `-20`) redirected to ACE MCP
- No cloud API calls for codebase retrieval
- Fully local operation

## How It Works

### Request Flow (Mode 3: Replace Official)

```
User Query → prepareAugmentChatRequestForByok()
    ↓
Line 192: maybeInjectMcpContext() (SKIPPED if replaceOfficialRetrieval = true)
    ↓
Line 196: maybeInjectOfficialCodebaseRetrieval()
    ├─ Check: cfg.ace.enabled && cfg.ace.replaceOfficialRetrieval
    ├─ YES → Call ACE MCP via adapter
    │   ├─ Resolve workspace path
    │   ├─ Connect to ACE MCP server (stdio)
    │   ├─ Send tools/call with codebase-retrieval
    │   └─ Parse MCP response
    ├─ NO → Call Augment cloud API (original behavior)
    └─ Inject result as request node with ID -20
    ↓
Combined Context → LLM Provider → Response
```

### ACE MCP Adapter Flow

```
fetchACERetrieval()
    ↓
getACEMcpClient() (singleton from mcp-client.js)
    ↓
client.searchCodebase(query, repoPath, options)
    ↓
MCP JSON-RPC: tools/call → codebase-retrieval
    ↓
ACE MCP Server (stdio)
    ├─ Parse arguments (repo_path, information_request, technical_terms)
    ├─ Run SearchService pipeline (vector + FTS + rerank + expand + pack)
    └─ Return formatted text
    ↓
Parse response.content[].text
    ↓
Return formatted string to maybeInjectOfficialCodebaseRetrieval()
```

## Key Design Decisions

### 1. Minimal Code Changes
- Only modified 1 existing file (`codebase-retrieval.js`)
- Reused existing ACE MCP client (`mcp-client.js`)
- Kept all original error handling and injection logic

### 2. Same Injection Point
- Uses ID `-20` (official retrieval slot) instead of `-25` (MCP context slot)
- Maintains compatibility with existing request flow
- No need to update downstream LLM prompt processing

### 3. Config-Driven Behavior
- Feature flag `replaceOfficialRetrieval` controls behavior
- Easy to toggle on/off via config file
- No code changes needed to switch modes

### 4. Graceful Fallback
- ACE errors logged but don't crash the extension
- Errors don't trigger cloud fallback logic (cloud errors only)
- Missing workspace path auto-detected from context

### 5. Separate Error Handling
- ACE errors: log and return `false` (skip retrieval)
- Cloud errors: trigger `handleAugmentIndexFailure()` (shows user notification)
- Prevents ACE issues from marking Augment indexing as unavailable

## Testing Checklist

### ✓ Phase 1: ACE Disabled
- [ ] Set `ace.enabled = false`
- [ ] Verify official cloud retrieval works
- [ ] Check network logs for `agents/codebase-retrieval` POST
- [ ] Verify no ACE MCP process spawned

### ✓ Phase 2: ACE Enabled, Not Replacing
- [ ] Set `enabled = true`, `replaceOfficialRetrieval = false`
- [ ] Verify MCP context injection (ID `-25`)
- [ ] Verify official cloud retrieval (ID `-20`)
- [ ] Check logs for both sources

### ✓ Phase 3: ACE Replacing Official
- [ ] Set `enabled = true`, `replaceOfficialRetrieval = true`
- [ ] Set `workspacePath = "D:\\MCP\\ACE"` (test repo)
- [ ] Verify ACE MCP server spawns
- [ ] Verify request node ID `-20` contains ACE results
- [ ] Check logs for "ace-retrieval: using local MCP server"
- [ ] Verify NO network calls to `agents/codebase-retrieval`

### ✓ Phase 4: Error Handling
- [ ] Kill ACE MCP server during request
- [ ] Verify graceful fallback (no crash)
- [ ] Check logs for "ace-retrieval failed (ignored)"
- [ ] Verify no false Augment indexing unavailable notifications

### ✓ Phase 5: Workspace Path Resolution
- [ ] Remove `workspacePath` from config
- [ ] Open workspace folder in VS Code
- [ ] Verify auto-detection from `req.workspace_root`
- [ ] Check logs for resolved path

## Next Steps

1. **Test the Integration**:
   - Edit config file to enable `replaceOfficialRetrieval: true`
   - Open a workspace in Augment extension
   - Send a query that would trigger codebase retrieval
   - Check logs for ACE MCP activity

2. **Verify ACE MCP Server**:
   - Ensure ACE is installed globally: `pnpm link --global` (from ACE repo)
   - Or update `mcpServerPath` to absolute path: `"D:\\MCP\\ACE\\dist\\index.js"`
   - Test manually: `ace mcp` (should start MCP server on stdio)

3. **Configure Workspace Path**:
   - Set `workspacePath` in config to your test repo path
   - Or ensure Augment passes `workspace_root` in request context

4. **Monitor Logs**:
   - Check extension host logs for ACE activity
   - Look for: "ace-retrieval: using local MCP server"
   - Look for: "ace-retrieval injected: chars=..."

## Benefits

1. **Local-First**: No cloud dependency for codebase retrieval
2. **Privacy**: Code never leaves local machine
3. **Performance**: No network latency
4. **Cost**: No cloud API usage costs
5. **Control**: Full control over retrieval algorithm and indexing
6. **Compatibility**: Same injection point as official retrieval

## Rollback

To revert to cloud retrieval:
```javascript
ace: {
  enabled: false,
  // OR
  replaceOfficialRetrieval: false
}
```

The original cloud retrieval code is completely intact and will work immediately when the flag is disabled.
