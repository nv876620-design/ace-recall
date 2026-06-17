/**
 * CodeRecall MCP HTTP Server
 *
 * Cung cấp MCP server qua HTTP/SSE thay vì stdio
 */

import type { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
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
            "The SEMANTIC GOAL. Describe the functionality, logic, or behavior you are looking for in full natural language sentences.",
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

/**
 * Tạo Express app với MCP endpoints
 */
export function createHttpServerApp(host = '127.0.0.1'): Express {
  const app = createMcpExpressApp({
    host,
    allowedHosts: [host, 'localhost', '[::1]'],
  });

  const server = createMcpServer();

  // Log ALL requests for debugging
  app.use((req: Request, res: Response, next: any) => {
    logger.info({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.method === 'POST' ? req.body : undefined
    }, 'HTTP: Incoming request');
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
      checkpoint_id: 'local-' + Date.now(),
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
        }
      ],
      indexing_complete: true,
    });
  });

  // Augment search external sources endpoint - redirect to codebase-retrieval
  app.post('/search-external-sources', async (req: Request, res: Response) => {
    try {
      const { query, workspace_path, repo_path } = req.body;
      logger.info({ query, workspace_path, repo_path }, 'HTTP: /search-external-sources called');

      const repoPath = repo_path || workspace_path || process.env.CODERECALL_WORKSPACE || process.cwd();

      // Check if API keys are configured
      const hasEmbeddingKey = process.env.EMBEDDINGS_API_KEYS && process.env.EMBEDDINGS_API_KEYS !== 'your-api-key-here';
      const hasRerankKey = process.env.RERANK_API_KEYS && process.env.RERANK_API_KEYS !== 'your-api-key-here';

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
          }
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
      checkpoint_id: 'local-' + Date.now(),
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
      message: 'CodeRecall MCP local mode - chat-stream not supported. Use BYOK model provider instead.',
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
              if (node && node.ide_state_node && Array.isArray(node.ide_state_node.workspace_folders)) {
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
            const path = require('path');
            const fullPath = String(firstBlob.path);
            // Extract directory from file path
            const parts = fullPath.split(/[\/\\]/);
            // Remove filename and go up to likely workspace root
            repoPath = parts.slice(0, -2).join(path.sep);
          }
        }
      }

      // Final fallback
      if (!repoPath) {
        repoPath = process.cwd();
      }

      logger.info({
        information_request,
        repoPath,
        source: repo_path ? 'request.repo_path' :
                workspace_path ? 'request.workspace_path' :
                nodes ? 'nodes.ide_state' :
                dialog ? 'dialog.ide_state' :
                process.env.CODERECALL_WORKSPACE ? 'env.CODERECALL_WORKSPACE' :
                blobs ? 'blobs.path_heuristic' : 'cwd'
      }, 'HTTP: agents/codebase-retrieval called');

      // Check if API keys are configured
      const hasEmbeddingKey = process.env.EMBEDDINGS_API_KEYS && process.env.EMBEDDINGS_API_KEYS !== 'your-api-key-here';
      const hasRerankKey = process.env.RERANK_API_KEYS && process.env.RERANK_API_KEYS !== 'your-api-key-here';

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
