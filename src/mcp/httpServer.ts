/**
 * ACE (Awesome Context Engineering) MCP HTTP Server
 *
 * Cung cấp MCP server qua HTTP/SSE thay vì stdio
 */

import fs from 'node:fs';
import path from 'node:path';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express, { type Express, type Request, type Response } from 'express';
import { logger } from '../utils/logger.js';
import { codebaseRetrievalSchema, handleCodebaseRetrieval } from './tools/index.js';

const SERVER_NAME = 'ace-recall';

// Định nghĩa tools giống như stdio server
const TOOLS = [
  {
    name: 'codebase-retrieval',
    description: `
IMPORTANT: This is the PRIMARY tool for searching the codebase.
It uses a hybrid engine (Semantic + Exact Match) to find relevant code.
Think of it as the "Google Search" for this repository.

Capabilities:
1. Semantic Search: Understands "what code does" (e.g., "auth logic") via high-dimensional embeddings.
2. Exact Match: Filters by precise symbols (e.g., class names) via FTS (Full Text Search).
3. Zen Context: Returns code with localized context (breadcrumbs) to avoid token overflow.

<RULES>
# 1. Tool Selection (When to use)
- ALWAYS use this tool FIRST for any code exploration or understanding task.
- DO NOT try to guess file paths. If you don't have the exact path, use this tool.
- DO NOT use 'grep' or 'find' for semantic understanding. Only use them for exhaustive text matching (e.g. "Find ALL occurrences of string 'foo'").

# 2. Before Editing (Critical)
- Before creating a plan or editing any file, YOU MUST call this tool to gather context.
- Ask for ALL symbols involved in the edit (classes, functions, types, constants).
- Do not assume you remember the code structure. Verify it with this tool.

# 3. Query Strategy (How to use)
- Split your intent:
  - Put the "Goal/Context" in 'information_request'.
  - Put "Known Class/Func Names" in 'technical_terms'.
- If the first search is too broad, add more specific 'technical_terms'.
</RULES>
`,
    inputSchema: {
      type: 'object',
      properties: {
        repo_path: {
          type: 'string',
          description: 'The absolute file system path to the repository root.',
        },
        information_request: {
          type: 'string',
          description:
            'The SEMANTIC GOAL. Describe the functionality, logic, or behavior you are looking for in full natural language sentences.',
        },
        technical_terms: {
          type: 'array',
          items: { type: 'string' },
          description:
            'HARD FILTERS. An optional list of EXACT, KNOWN identifiers (class/function names, constants) that MUST appear in the code.',
        },
      },
      required: ['repo_path', 'information_request'],
    },
  },
];

/**
 * Tạo và cấu hình MCP server instance
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Đăng ký tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('HTTP: Nhận list_tools request');
    return { tools: TOOLS };
  });

  // Đăng ký tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    logger.info({ tool: name }, 'HTTP: Nhận call_tool request');

    // Tạo progress callback nếu có progressToken
    const rawToken = extra._meta?.progressToken;
    const progressToken =
      typeof rawToken === 'string' || typeof rawToken === 'number' ? rawToken : undefined;

    const onProgress = progressToken
      ? async (current: number, total?: number, message?: string) => {
          try {
            await extra.sendNotification({
              method: 'notifications/progress',
              params: {
                progressToken,
                progress: current,
                total,
                message,
              },
            });
          } catch (err) {
            logger.debug({ error: (err as Error).message }, 'Gửi progress notification thất bại');
          }
        }
      : undefined;

    try {
      switch (name) {
        case 'codebase-retrieval': {
          const parsed = codebaseRetrievalSchema.parse(args);
          return await handleCodebaseRetrieval(parsed, undefined, onProgress);
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      const error = err as { message?: string; stack?: string };
      logger.error({ error: error.message, stack: error.stack, tool: name }, 'Tool call thất bại');
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

function getPreferredHomeEnvFilePath() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return path.join(home, '.coderecall', '.env');
}

function getDefaultEnvFilePath() {
  return path.join(process.cwd(), '.env');
}

function getActiveEnvFilePath(): string {
  const preferredHomeEnvPath = getPreferredHomeEnvFilePath();
  const fallbackEnvPath = getDefaultEnvFilePath();
  const localEnvPath = path.join(process.cwd(), '.env');

  // Find the first existing candidate
  if (fs.existsSync(localEnvPath)) return localEnvPath;
  if (fs.existsSync(preferredHomeEnvPath)) return preferredHomeEnvPath;
  if (fs.existsSync(fallbackEnvPath)) return fallbackEnvPath;

  // Default to write path
  const preferredDir = path.dirname(preferredHomeEnvPath);
  try {
    fs.mkdirSync(preferredDir, { recursive: true });
    return preferredHomeEnvPath;
  } catch {
    return fallbackEnvPath;
  }
}

function updateEnvFile(updates: Record<string, string>): void {
  const filePath = getActiveEnvFilePath();
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  const lines = content.split('\n');
  const keysToUpdate = new Set(Object.keys(updates));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#')) {
      const parts = line.split('=');
      const key = parts[0].trim();
      if (keysToUpdate.has(key)) {
        lines[i] = `${key}=${updates[key]}`;
        keysToUpdate.delete(key);
      }
    }
  }

  // Append new keys
  for (const key of keysToUpdate) {
    lines.push(`${key}=${updates[key]}`);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ADMIN_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Awesome Context Engineering - Admin Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0b0f19;
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --input-bg: rgba(0, 0, 0, 0.3);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    
    .container {
      width: 100%;
      max-width: 800px;
    }
    
    header {
      margin-bottom: 40px;
      text-align: center;
    }
    
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    
    .tagline {
      color: var(--text-muted);
      font-size: 1rem;
    }
    
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 30px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      margin-bottom: 30px;
    }
    
    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .status-badge {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .status-badge.configured {
      background-color: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    .status-badge.missing {
      background-color: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    
    .status-badge.active {
      background-color: rgba(59, 130, 246, 0.15);
      color: var(--primary);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    
    .form-group {
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
    }
    
    input {
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px 16px;
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }
    
    input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    
    .alert {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 25px;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .alert-success {
      background-color: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
    }
    
    .btn {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 14px 28px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s ease, filter 0.2s ease;
      display: block;
      width: 100%;
      text-align: center;
    }
    
    .btn:hover {
      filter: brightness(1.1);
    }
    
    .btn:active {
      transform: scale(0.98);
    }
    
    .status-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 0.95rem;
    }
    
    .status-row:last-child {
      margin-bottom: 0;
    }
    
    .status-label {
      color: var(--text-muted);
    }
    
    .status-value {
      color: var(--text-main);
      font-weight: 500;
    }
    
    .code-block {
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      overflow-x: auto;
      margin-top: 12px;
    }
    
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 20px;
      gap: 10px;
    }
    
    .tab {
      padding: 12px 24px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      transition: all 0.2s ease;
      font-weight: 500;
    }
    
    .tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    
    .tab:hover {
      color: var(--text-main);
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .endpoint-item {
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .endpoint-label {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    
    .endpoint-url {
      font-family: 'Courier New', monospace;
      color: var(--primary);
      font-size: 0.95rem;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Awesome Context Engineering</h1>
      <p class="tagline">Making AI agents smarter with better code context 🚀</p>
    </header>
    
    {{#if success}}
    <div class="alert alert-success">
      <span>✓</span>
      <span>Configuration saved successfully!</span>
    </div>
    {{/if}}
    
    <div class="card">
      <div class="card-title">
        <span>🔧 Configuration Status</span>
        <div style="display: flex; gap: 8px;">
          {{#if hasEmbeddingKey}}
          <span class="status-badge configured">Embeddings OK</span>
          {{else}}
          <span class="status-badge missing">Embeddings Missing</span>
          {{/if}}
          {{#if hasRerankKey}}
          <span class="status-badge configured">Reranker OK</span>
          {{else}}
          <span class="status-badge missing">Reranker Missing</span>
          {{/if}}
        </div>
      </div>
      
      <form action="/admin/configure" method="POST">
        <div class="form-group">
          <label>Jina Embeddings API Key</label>
          <input type="text" name="embeddings_api_keys" value="{{embeddingsApiKeys}}" placeholder="jina_xxxxxxxxxxxxx" />
        </div>
        
        <div class="grid">
          <div class="form-group">
            <label>Embeddings Base URL</label>
            <input type="text" name="embeddings_base_url" value="{{embeddingsBaseUrl}}" placeholder="https://api.jina.ai/v1" />
          </div>
          
          <div class="form-group">
            <label>Embeddings Model</label>
            <input type="text" name="embeddings_model" value="{{embeddingsModel}}" placeholder="jina-embeddings-v3" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Jina Reranker API Key</label>
          <input type="text" name="rerank_api_keys" value="{{rerankApiKeys}}" placeholder="jina_xxxxxxxxxxxxx" />
        </div>
        
        <div class="grid">
          <div class="form-group">
            <label>Reranker Base URL</label>
            <input type="text" name="rerank_base_url" value="{{rerankBaseUrl}}" placeholder="https://api.jina.ai/v1" />
          </div>
          
          <div class="form-group">
            <label>Reranker Model</label>
            <input type="text" name="rerank_model" value="{{rerankModel}}" placeholder="jina-reranker-v2-base-multilingual" />
          </div>
        </div>
        
        <button type="submit" class="btn">Save Configuration</button>
      </form>
    </div>
    
    <div class="card">
      <div class="tabs">
        <div class="tab active" data-tab="mcp">MCP Integration</div>
        <div class="tab" data-tab="system">System Info</div>
      </div>
      
      <div class="tab-content active" data-content="mcp">
        <div class="endpoint-item">
          <div class="endpoint-label">📱 Claude Desktop</div>
          <div class="code-block">{
  "mcpServers": {
    "ace-recall": {
      "command": "node",
      "args": ["{{workspacePath}}/dist/index.js", "mcp"]
    }
  }
}</div>
        </div>
        
        <div class="endpoint-item">
          <div class="endpoint-label">🚀 Augment (Local)</div>
          <div class="code-block">{
  "context_providers": [{
    "name": "ace-recall",
    "type": "mcp",
    "url": "http://127.0.0.1:{{PORT}}"
  }]
}</div>
        </div>
        
        <div class="endpoint-item">
          <div class="endpoint-label">☁️ Augment (Fly.io)</div>
          <div class="code-block">{
  "context_providers": [{
    "name": "ace-recall",
    "type": "mcp",
    "url": "https://ace-recall.fly.dev"
  }]
}</div>
        </div>
      </div>
      
      <div class="tab-content" data-content="system">
        <div class="status-row">
          <span class="status-label">Server Version:</span>
          <span class="status-value">v0.2.0</span>
        </div>
        <div class="status-row">
          <span class="status-label">Workspace Path:</span>
          <span class="status-value">{{workspacePath}}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Env File Path:</span>
          <span class="status-value">{{envFilePath}}</span>
        </div>
        <div class="status-row">
          <span class="status-label">Server Status:</span>
          <span class="status-badge active">Running</span>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
          if (content.getAttribute('data-content') === tabName) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
    
    // Replace PORT placeholder with actual port
    const port = window.location.port || '8080';
    document.querySelectorAll('.code-block').forEach(block => {
      block.textContent = block.textContent.replace('{{PORT}}', port);
    });
  </script>
</body>
</html>`;

/**
 * Tạo và cấu hình HTTP server app
 */
export function createHttpServerApp(host = '127.0.0.1'): Express {
  const app = express();
  const server = createMcpServer();

  // Admin dashboard
  app.get('/', (req: Request, res: Response) => {
    const success = req.query.success === 'true';
    const workspacePath = process.cwd();
    const envFilePath = getActiveEnvFilePath();

    const hasEmbeddingKey = !!process.env.EMBEDDINGS_API_KEYS;
    const hasRerankKey = !!process.env.RERANK_API_KEYS;

    let html = ADMIN_HTML_TEMPLATE;

    // Replace success alert block
    if (success) {
      html = html.replace('{{#if success}}', '').replace('{{/if}}', '');
    } else {
      html = html.replace(/\{\{#if success\}\}[\s\S]*?\{\{\/if\}\}/, '');
    }

    // Replace HasEmbeddingKey badge block
    if (hasEmbeddingKey) {
      html = html.replace(
        /\{\{#if hasEmbeddingKey\}\}([\s\S]*?)\{\{else\}\}[\s\S]*?\{\{\/if\}\}/,
        '$1',
      );
    } else {
      html = html.replace(
        /\{\{#if hasEmbeddingKey\}\}[\s\S]*?\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/,
        '$1',
      );
    }

    // Replace HasRerankKey badge block
    if (hasRerankKey) {
      html = html.replace(
        /\{\{#if hasRerankKey\}\}([\s\S]*?)\{\{else\}\}[\s\S]*?\{\{\/if\}\}/,
        '$1',
      );
    } else {
      html = html.replace(
        /\{\{#if hasRerankKey\}\}[\s\S]*?\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/,
        '$1',
      );
    }

    // Replace escaped config values
    html = html
      .replace(/\{\{embeddingsApiKeys\}\}/g, escapeHtml(process.env.EMBEDDINGS_API_KEYS || ''))
      .replace(/\{\{embeddingsBaseUrl\}\}/g, escapeHtml(process.env.EMBEDDINGS_BASE_URL || ''))
      .replace(/\{\{embeddingsModel\}\}/g, escapeHtml(process.env.EMBEDDINGS_MODEL || ''))
      .replace(/\{\{rerankApiKeys\}\}/g, escapeHtml(process.env.RERANK_API_KEYS || ''))
      .replace(/\{\{rerankBaseUrl\}\}/g, escapeHtml(process.env.RERANK_BASE_URL || ''))
      .replace(/\{\{rerankModel\}\}/g, escapeHtml(process.env.RERANK_MODEL || ''))
      .replace(/\{\{workspacePath\}\}/g, escapeHtml(workspacePath))
      .replace(/\{\{envFilePath\}\}/g, escapeHtml(envFilePath));

    res.send(html);
  });

  // Admin Configuration Save Action
  app.post('/admin/configure', (req: Request, res: Response) => {
    const {
      embeddings_api_keys,
      embeddings_base_url,
      embeddings_model,
      rerank_api_keys,
      rerank_base_url,
      rerank_model,
    } = req.body;

    const updates: Record<string, string> = {};
    if (embeddings_api_keys) updates.EMBEDDINGS_API_KEYS = embeddings_api_keys;
    if (embeddings_base_url) updates.EMBEDDINGS_BASE_URL = embeddings_base_url;
    if (embeddings_model) updates.EMBEDDINGS_MODEL = embeddings_model;
    if (rerank_api_keys) updates.RERANK_API_KEYS = rerank_api_keys;
    if (rerank_base_url) updates.RERANK_BASE_URL = rerank_base_url;
    if (rerank_model) updates.RERANK_MODEL = rerank_model;

    updateEnvFile(updates);

    // Update current process env as well
    Object.assign(process.env, updates);

    res.redirect('/?success=true');
  });

  // Body parser cho POST requests
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Mount MCP endpoints directly (no /mcp prefix)
  const transport = new StreamableHTTPServerTransport('/', server);
  const mcpApp = createMcpExpressApp(server);
  app.use('/', mcpApp);

  return app;
}

/**
 * Khởi động HTTP server
 */
export async function startHttpServer(port = 3000, host = '127.0.0.1'): Promise<void> {
  const app = createHttpServerApp(host);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      logger.info(
        { port, host, endpoint: `http://${host}:${port}` },
        'ACE HTTP server đã khởi động',
      );
      resolve();
    });

    server.on('error', (err) => {
      logger.error({ error: err.message }, 'HTTP server error');
      reject(err);
    });
  });
}
