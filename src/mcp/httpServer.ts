/**
 * CodeRecall MCP HTTP Server
 *
 * Cung cấp MCP server qua HTTP/SSE thay vì stdio
 */

import fs from 'node:fs';
import path from 'node:path';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Express, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { codebaseRetrievalSchema, handleCodebaseRetrieval } from './tools/index.js';

const SERVER_NAME = 'coderecall';

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
      version: '1.0.0',
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
  <title>CodeRecall Admin Dashboard</title>
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
    
    .status-val {
      font-weight: 500;
      font-family: monospace;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>CodeRecall Configuration</h1>
      <p class="tagline">Manage Vector Database, Embedding, and Reranker Credentials</p>
    </header>
    
    {{#if success}}
    <div class="alert alert-success">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>
      Configuration successfully updated and loaded in-memory!
    </div>
    {{/if}}
    
    <div class="card">
      <div class="card-title">
        <span>System Status</span>
        <span class="status-badge active">Online</span>
      </div>
      <div class="status-row">
        <span class="status-label">Embedding Engine</span>
        <span class="status-val">
          {{#if hasEmbeddingKey}}
          <span class="status-badge configured">Configured</span>
          {{else}}
          <span class="status-badge missing">Missing</span>
          {{/if}}
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Reranker Engine</span>
        <span class="status-val">
          {{#if hasRerankKey}}
          <span class="status-badge configured">Configured</span>
          {{else}}
          <span class="status-badge missing">Missing</span>
          {{/if}}
        </span>
      </div>
      <div class="status-row">
        <span class="status-label">Workspace Path</span>
        <span class="status-val">{{workspacePath}}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Active Config File</span>
        <span class="status-val">{{envFilePath}}</span>
      </div>
    </div>
    
    <form method="POST" action="/admin/configure" class="card">
      <div class="card-title">API Credentials</div>
      
      <div class="grid">
        <div class="form-group">
          <label for="embeddings_api_keys">Embedding API Key(s)</label>
          <input type="password" id="embeddings_api_keys" name="embeddings_api_keys" value="{{embeddingsApiKeys}}" placeholder="sk-..." />
        </div>
        <div class="form-group">
          <label for="embeddings_base_url">Embedding Base URL</label>
          <input type="text" id="embeddings_base_url" name="embeddings_base_url" value="{{embeddingsBaseUrl}}" placeholder="https://api.siliconflow.cn/v1/embeddings" />
        </div>
      </div>
      
      <div class="form-group">
        <label for="embeddings_model">Embedding Model</label>
        <input type="text" id="embeddings_model" name="embeddings_model" value="{{embeddingsModel}}" placeholder="BAAI/bge-m3" />
      </div>
      
      <div style="margin: 30px 0 10px 0; border-top: 1px solid var(--card-border);"></div>
      
      <div class="grid">
        <div class="form-group">
          <label for="rerank_api_keys">Rerank API Key(s)</label>
          <input type="password" id="rerank_api_keys" name="rerank_api_keys" value="{{rerankApiKeys}}" placeholder="sk-..." />
        </div>
        <div class="form-group">
          <label for="rerank_base_url">Rerank Base URL</label>
          <input type="text" id="rerank_base_url" name="rerank_base_url" value="{{rerankBaseUrl}}" placeholder="https://api.siliconflow.cn/v1/rerank" />
        </div>
      </div>
      
      <div class="form-group">
        <label for="rerank_model">Rerank Model</label>
        <input type="text" id="rerank_model" name="rerank_model" value="{{rerankModel}}" placeholder="BAAI/bge-reranker-v2-m3" />
      </div>
      
      <button type="submit" class="btn" style="margin-top: 20px;">Save Configuration</button>
    </form>
  </div>
</body>
</html>`;

/**
 * Tạo Express app với MCP endpoints
 */
export function createHttpServerApp(host = '127.0.0.1'): Express {
  const app = createMcpExpressApp({
    host,
    allowedHosts: [host, 'localhost', '[::1]'],
  });

  const server = createMcpServer();

  // Enable URL-encoded form parsing for admin config submissions
  app.use(express.urlencoded({ extended: true }));

  // Admin Configuration Dashboard UI
  app.get('/admin', (req: Request, res: Response) => {
    const success = req.query.success === 'true';
    const hasEmbeddingKey = !!(
      process.env.EMBEDDINGS_API_KEYS && process.env.EMBEDDINGS_API_KEYS !== 'your-api-key-here'
    );
    const hasRerankKey = !!(
      process.env.RERANK_API_KEYS && process.env.RERANK_API_KEYS !== 'your-api-key-here'
    );
    const workspacePath = process.env.CODERECALL_WORKSPACE || process.cwd();
    const envFilePath = getActiveEnvFilePath();

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

    const updates: Record<string, string> = {
      EMBEDDINGS_API_KEYS: (embeddings_api_keys || '').trim(),
      EMBEDDINGS_BASE_URL: (embeddings_base_url || '').trim(),
      EMBEDDINGS_MODEL: (embeddings_model || '').trim(),
      RERANK_API_KEYS: (rerank_api_keys || '').trim(),
      RERANK_BASE_URL: (rerank_base_url || '').trim(),
      RERANK_MODEL: (rerank_model || '').trim(),
    };

    // Update in-memory configurations instantly
    for (const [key, value] of Object.entries(updates)) {
      process.env[key] = value;
    }

    // Save configurations back to the active environment config file
    try {
      updateEnvFile(updates);
      logger.info('HTTP: Configurations updated via Admin Panel dashboard');
      res.redirect('/admin?success=true');
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'HTTP: Saving config to file failed');
      res.status(500).send(`Configuration Save Error: ${(err as Error).message}`);
    }
  });

  // Log ALL requests for debugging
  app.use((req: Request, res: Response, next: any) => {
    logger.info(
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.method === 'POST' ? req.body : undefined,
      },
      'HTTP: Incoming request',
    );
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'coderecall-mcp-http',
      version: '1.0.0',
    });
  });

  // Get models endpoint - hỗ trợ cả GET và POST (Augment BYOK dùng POST)
  // Augment polls this to check index status - return indexing_status: "available"
  const getModelsHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      indexing_status: 'available',
      service: 'coderecall-mcp-http',
      version: '1.0.0',
    });
  };
  app.get('/get-models', getModelsHandler);
  app.post('/get-models', getModelsHandler);

  // Augment get models endpoint - hỗ trợ cả GET và POST
  // Return indexing_status: "available" to stop spinner
  const augmentGetModelsHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      indexing_status: 'available',
      service: 'coderecall-mcp-http',
      version: '1.0.0',
    });
  };
  app.get('/augment/get-models', augmentGetModelsHandler);
  app.post('/augment/get-models', augmentGetModelsHandler);

  // Augment index status endpoint
  app.post('/augment/index-status', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /augment/index-status called');
    res.json({
      status: 'available',
      indexed: true,
      totalFiles: 173,
      lastIndexed: new Date().toISOString(),
    });
  });

  // Augment codebase checkpoint endpoint
  app.post('/augment/codebase-checkpoint', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /augment/codebase-checkpoint called');
    res.json({
      checkpoint_id: `local-${Date.now()}`,
      status: 'ok',
    });
  });

  // Augment implicit external sources endpoint - signal indexing complete
  app.post('/get-implicit-external-sources', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /get-implicit-external-sources called');
    res.json({
      sources: [
        {
          type: 'codebase',
          status: 'ready',
          name: 'CodeRecall Local Index',
        },
      ],
      indexing_complete: true,
    });
  });

  // Augment search external sources endpoint - redirect to codebase-retrieval
  app.post('/search-external-sources', async (req: Request, res: Response) => {
    try {
      const { query, workspace_path, repo_path } = req.body;
      logger.info({ query, workspace_path, repo_path }, 'HTTP: /search-external-sources called');

      const repoPath =
        repo_path || workspace_path || process.env.CODERECALL_WORKSPACE || process.cwd();

      // Check if API keys are configured
      const hasEmbeddingKey =
        process.env.EMBEDDINGS_API_KEYS && process.env.EMBEDDINGS_API_KEYS !== 'your-api-key-here';
      const hasRerankKey =
        process.env.RERANK_API_KEYS && process.env.RERANK_API_KEYS !== 'your-api-key-here';

      if (!hasEmbeddingKey || !hasRerankKey) {
        res.json({ results: [], status: 'ok' });
        return;
      }

      // Call MCP tool
      const { handleCodebaseRetrieval, codebaseRetrievalSchema } = await import('./tools/index.js');
      const args = codebaseRetrievalSchema.parse({
        repo_path: repoPath,
        information_request: query || '',
        technical_terms: [],
      });

      const result = await handleCodebaseRetrieval(args);

      // Extract text content
      const formatted_retrieval = result.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n\n');

      res.json({
        results: [
          {
            type: 'codebase',
            content: formatted_retrieval,
          },
        ],
        status: 'ok',
      });
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'HTTP: /search-external-sources failed');
      res.json({ results: [], status: 'error', error: (err as Error).message });
    }
  });

  // Augment checkpoint blobs endpoint
  app.post('/checkpoint-blobs', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /checkpoint-blobs called');
    res.json({
      checkpoint_id: `local-${Date.now()}`,
      status: 'ok',
      blobs_count: 0,
    });
  });

  // Augment find missing endpoint (no-op)
  app.post('/find-missing', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /find-missing called');
    res.json({
      missing: [],
      status: 'ok',
    });
  });

  // Augment save chat endpoint (no-op)
  app.post('/save-chat', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /save-chat called');
    res.json({
      status: 'ok',
      saved: true,
    });
  });

  // Augment context canvas list endpoint (no-op)
  app.post('/context-canvas/list', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /context-canvas/list called');
    res.json({
      items: [],
      status: 'ok',
    });
  });

  app.get('/context-canvas/list', (req: Request, res: Response) => {
    logger.info({ query: req.query }, 'HTTP: GET /context-canvas/list called');
    res.json({
      items: [],
      status: 'ok',
    });
  });

  // Augment chat-stream endpoint (stub - bypass cloud)
  app.post('/chat-stream', (req: Request, res: Response) => {
    logger.info({ body: req.body }, 'HTTP: /chat-stream called');
    res.status(200).json({
      status: 'ok',
      message:
        'CodeRecall MCP local mode - chat-stream not supported. Use BYOK model provider instead.',
    });
  });

  // Augment record-request-events endpoint (telemetry no-op)
  app.post('/record-request-events', (req: Request, res: Response) => {
    logger.debug({ body: req.body }, 'HTTP: /record-request-events called');
    res.json({ status: 'ok' });
  });

  // Augment report-error endpoint (telemetry no-op)
  app.post('/report-error', (req: Request, res: Response) => {
    logger.debug({ body: req.body }, 'HTTP: /report-error called');
    res.json({ status: 'ok' });
  });

  // Augment codebase-retrieval endpoint - direct integration
  app.post('/agents/codebase-retrieval', async (req: Request, res: Response) => {
    try {
      const { information_request, blobs, workspace_path, repo_path, nodes, dialog } = req.body;

      // Resolve repo path with priority order:
      // 1. Explicit repo_path/workspace_path in request body
      // 2. Extract from nodes[].ide_state_node.workspace_folders[0].folder_root
      // 3. Extract from dialog[].request_nodes[].ide_state_node.workspace_folders[0].folder_root
      // 4. CODERECALL_WORKSPACE env var (for fixed workspace)
      // 5. Extract from blobs.added_blobs[0].path
      // 6. Fall back to process.cwd()

      let repoPath = repo_path || workspace_path || process.env.CODERECALL_WORKSPACE;

      // Try to extract from nodes (current request)
      if (!repoPath && Array.isArray(nodes)) {
        for (const node of nodes) {
          if (node && node.ide_state_node && Array.isArray(node.ide_state_node.workspace_folders)) {
            const folder = node.ide_state_node.workspace_folders[0];
            if (folder && folder.folder_root) {
              repoPath = String(folder.folder_root);
              break;
            }
          }
        }
      }

      // Try to extract from dialog history
      if (!repoPath && Array.isArray(dialog)) {
        for (const turn of dialog) {
          if (Array.isArray(turn.request_nodes)) {
            for (const node of turn.request_nodes) {
              if (
                node &&
                node.ide_state_node &&
                Array.isArray(node.ide_state_node.workspace_folders)
              ) {
                const folder = node.ide_state_node.workspace_folders[0];
                if (folder && folder.folder_root) {
                  repoPath = String(folder.folder_root);
                  break;
                }
              }
            }
            if (repoPath) break;
          }
        }
      }

      // Try to extract from blobs if not provided directly
      if (!repoPath && blobs && typeof blobs === 'object') {
        if (Array.isArray(blobs.added_blobs) && blobs.added_blobs.length > 0) {
          const firstBlob = blobs.added_blobs[0];
          if (typeof firstBlob === 'object' && firstBlob.path) {
            const fullPath = String(firstBlob.path);
            // Extract directory from file path
            const parts = fullPath.split(/[/\\]/);
            // Remove filename and go up to likely workspace root
            repoPath = parts.slice(0, -2).join(path.sep);
          }
        }
      }

      // Final fallback
      if (!repoPath) {
        repoPath = process.cwd();
      }

      logger.info(
        {
          information_request,
          repoPath,
          source: repo_path
            ? 'request.repo_path'
            : workspace_path
              ? 'request.workspace_path'
              : nodes
                ? 'nodes.ide_state'
                : dialog
                  ? 'dialog.ide_state'
                  : process.env.CODERECALL_WORKSPACE
                    ? 'env.CODERECALL_WORKSPACE'
                    : blobs
                      ? 'blobs.path_heuristic'
                      : 'cwd',
        },
        'HTTP: agents/codebase-retrieval called',
      );

      // Check if API keys are configured
      const hasEmbeddingKey =
        process.env.EMBEDDINGS_API_KEYS && process.env.EMBEDDINGS_API_KEYS !== 'your-api-key-here';
      const hasRerankKey =
        process.env.RERANK_API_KEYS && process.env.RERANK_API_KEYS !== 'your-api-key-here';

      if (!hasEmbeddingKey || !hasRerankKey) {
        // Mock response when API keys not configured
        const mockResponse = `## CodeRecall Mock Response

Query: "${information_request}"
Repo: ${repoPath}

**Note**: This is a mock response because API keys are not configured.
To get real search results, please configure:
- EMBEDDINGS_API_KEYS in ~/.coderecall/.env
- RERANK_API_KEYS in ~/.coderecall/.env

Mock search results would appear here with relevant code snippets.`;

        res.json({ formatted_retrieval: mockResponse });
        return;
      }

      // Call MCP tool directly (real search)
      const { handleCodebaseRetrieval, codebaseRetrievalSchema } = await import('./tools/index.js');
      const args = codebaseRetrievalSchema.parse({
        repo_path: repoPath,
        information_request: information_request || '',
        technical_terms: [],
      });

      const result = await handleCodebaseRetrieval(args);

      // Extract text content
      const formatted_retrieval = result.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n\n');

      res.json({ formatted_retrieval });
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'HTTP: agents/codebase-retrieval failed');
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // MCP endpoint - sử dụng StreamableHTTP transport
  app.use('/mcp', async (req: Request, res: Response) => {
    logger.debug({ method: req.method, path: req.path }, 'HTTP: MCP request nhận được');
    try {
      const transport = new StreamableHTTPServerTransport(req, res);
      await server.connect(transport);
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'HTTP: Kết nối MCP transport thất bại');
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // 404 handler - MUST be last
  app.use((req: Request, res: Response) => {
    logger.warn({ method: req.method, url: req.url }, 'HTTP: Unknown endpoint');
    res.status(404).json({ error: 'Not found', path: req.url });
  });

  return app;
}

/**
 * Khởi động HTTP MCP server
 */
export async function startHttpServer(port = 3000, host = '127.0.0.1'): Promise<void> {
  const app = createHttpServerApp(host);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      logger.info(
        { port, host, endpoint: `http://${host}:${port}/mcp` },
        'MCP HTTP server đã khởi động',
      );
      resolve();
    });

    server.on('error', (err) => {
      logger.error({ error: err.message }, 'HTTP server error');
      reject(err);
    });
  });
}
