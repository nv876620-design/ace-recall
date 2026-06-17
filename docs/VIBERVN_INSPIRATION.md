# vibervn-context-engine Inspiration for CodeRecall

Các ý tưởng từ [vibervn-context-engine](https://github.com/nullmastermind/vibervn-context-engine) - một Rust-based context engine với performance cao và features tiên tiến.

## 🎯 So sánh Tech Stack

| Aspect | CodeRecall | vibervn-context-engine |
|--------|------------|------------------------|
| Language | TypeScript/Node.js | **Rust** |
| Vector DB | LanceDB | **In-memory vector index** |
| Relational DB | SQLite (better-sqlite3) | **SurrealDB (embedded)** |
| Embedding | BAAI/bge-m3 (API) | **Voyage AI** (API + on-disk cache) |
| Reranking | BAAI/bge-reranker-v2-m3 | **LLM reranking** (OpenAI/Google) |
| Languages | 12+ (core plugins) | **22 languages** |
| Web UI | ❌ None | ✅ **Settings + Explorer + Query Console** |
| Progress | Callback-based | ✅ **SSE stream** |
| MCP Transport | stdio + HTTP | **HTTP with SSE** |

---

## ⭐ TOP Features Worth Implementing

### 1. **Call-Graph Expansion** 🔥 HIGHEST PRIORITY

**What it does:**
- Resolves caller/callee edges via AST analysis
- BFS-expands matched symbols at query time
- Shows enriched output: `[callers: fn_a, fn_b +N more]`

**Why it's valuable:**
- Provides **call context** - crucial for understanding code flow
- Answers "Who calls this function?" and "What does this call?"
- Much better than just returning isolated chunks

**Implementation approach for CodeRecall:**

```typescript
// src/search/CallGraphExpander.ts
export interface CallGraphNode {
  symbol: string;
  file: string;
  line: number;
  callers: string[]; // Function names that call this
  callees: string[]; // Functions this calls
}

export class CallGraphExpander {
  /**
   * Extract call relationships from AST
   */
  async buildCallGraph(chunks: Chunk[]): Promise<Map<string, CallGraphNode>> {
    // 1. Parse AST for each chunk
    // 2. Extract function calls
    // 3. Build bidirectional graph: caller -> callee, callee -> caller
    // 4. Store in separate DB table: call_edges
  }

  /**
   * BFS expand from matched symbols
   */
  expandFromSeeds(
    seeds: Chunk[],
    graph: Map<string, CallGraphNode>,
    depth: number = 2
  ): Chunk[] {
    // 1. Start from seed chunks
    // 2. BFS traverse callers/callees
    // 3. Return expanded set with call context
  }
}
```

**Database schema addition:**
```sql
CREATE TABLE IF NOT EXISTS call_edges (
  id INTEGER PRIMARY KEY,
  caller_chunk_id TEXT NOT NULL,
  caller_symbol TEXT NOT NULL,
  callee_chunk_id TEXT NOT NULL,
  callee_symbol TEXT NOT NULL,
  FOREIGN KEY (caller_chunk_id) REFERENCES chunks(id),
  FOREIGN KEY (callee_chunk_id) REFERENCES chunks(id)
);

CREATE INDEX idx_call_edges_caller ON call_edges(caller_chunk_id);
CREATE INDEX idx_call_edges_callee ON call_edges(callee_chunk_id);
```

**Output format:**
```typescript
{
  path: "src/api/auth.ts",
  range: { start: 10, end: 25 },
  code: "...",
  callContext: {
    callers: ["loginHandler", "refreshToken", "+3 more"],
    callees: ["validateToken", "getUserById"]
  }
}
```

---

### 2. **Framework-Aware Resolution** 🔥 HIGHEST PRIORITY

**What it does:**
- Detects React, Express, Django, Spring, Go Gin
- Produces routing/DI/rendering edges automatically
- Example: `app.get('/api/users', handler)` → links route to handler

**Why it's valuable:**
- Most codebases use frameworks
- Understanding routing/DI is critical for API/web apps
- Answers "Which handler serves this endpoint?"

**Implementation:**

```typescript
// src/parsing/FrameworkDetector.ts
export interface FrameworkEdge {
  type: 'route' | 'di' | 'render' | 'middleware';
  source: string; // e.g., "/api/users"
  target: string; // e.g., "getUsersHandler"
  file: string;
  line: number;
}

export class FrameworkDetector {
  detectReactComponents(ast: Parser.Tree): FrameworkEdge[] {
    // Detect: function MyComponent() { return <div>... }
    // Detect: const MyComponent = () => <div>...
    // Extract: component name, props, children
  }

  detectExpressRoutes(ast: Parser.Tree): FrameworkEdge[] {
    // Pattern: app.get('/path', handler)
    // Pattern: router.post('/path', middleware, handler)
    // Extract: method, path, handler name
  }

  detectFastAPIRoutes(ast: Parser.Tree): FrameworkEdge[] {
    // Pattern: @app.get("/path")
    // Pattern: @router.post("/path")
  }

  detectSpringControllers(ast: Parser.Tree): FrameworkEdge[] {
    // Pattern: @GetMapping("/path")
    // Pattern: @RestController
  }
}
```

**Query enhancement:**
```typescript
// When user searches for "GET /api/users handler"
// 1. Parse query to extract route pattern
// 2. Look up framework_edges table
// 3. Find handler function
// 4. Return handler code + route definition
```

---

### 3. **Field-Qualified Search** 🔥 HIGHEST PRIORITY

**What it does:**
- Filter results with prefixes: `kind:function`, `lang:rust`, `path:src/api`, `name:Handler`
- Example: `kind:function name:authenticate lang:typescript`

**Why it's valuable:**
- Dramatically improves search precision
- Reduces noise in large codebases
- Natural query syntax

**Implementation:**

```typescript
// src/search/QueryParser.ts
export interface ParsedQuery {
  naturalText: string; // Text for embedding
  filters: {
    kind?: 'function' | 'class' | 'method' | 'variable';
    lang?: string[];
    path?: string; // Glob pattern
    name?: string; // Symbol name pattern
  };
}

export function parseFieldQualifiedQuery(query: string): ParsedQuery {
  // Regex: /\b(kind|lang|path|name):(\S+)/g
  // Extract all field:value pairs
  // Remove them from query text
  // Return structured filters
}

// src/search/SearchService.ts
async function applyFieldFilters(
  chunks: Chunk[],
  filters: ParsedQuery['filters']
): Promise<Chunk[]> {
  return chunks.filter(chunk => {
    if (filters.kind && chunk.symbolKind !== filters.kind) return false;
    if (filters.lang && !filters.lang.includes(chunk.language)) return false;
    if (filters.path && !minimatch(chunk.file, filters.path)) return false;
    if (filters.name && !chunk.symbolName?.includes(filters.name)) return false;
    return true;
  });
}
```

**Example queries:**
```
"authentication logic kind:function lang:typescript"
→ Returns only TypeScript functions related to auth

"database connection path:src/db/** kind:class"
→ Returns only classes in src/db/ folder

"Handler name:User path:src/api/**"
→ Returns symbols with "User" in name from src/api/
```

---

### 4. **Web UI** ⭐ HIGH PRIORITY

**What it does:**
- Settings management (API keys, search params)
- Index explorer (browse indexed files/symbols)
- Query test console
- Real-time indexing progress via SSE

**Why it's valuable:**
- Better developer experience
- Easy debugging and testing
- Visual feedback during indexing

**Implementation:**

```typescript
// src/web/server.ts
import express from 'express';
import { EventEmitter } from 'events';

const app = express();
const indexEvents = new EventEmitter();

// SSE endpoint for progress
app.get('/api/index/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const listener = (data: { current: number; total: number; message: string }) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  indexEvents.on('progress', listener);

  req.on('close', () => {
    indexEvents.off('progress', listener);
  });
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  // Load from ~/.coderecall/settings.json
});

app.post('/api/settings', async (req, res) => {
  // Save to ~/.coderecall/settings.json
});

// Index explorer
app.get('/api/index/files', async (req, res) => {
  // List all indexed files
});

app.get('/api/index/symbols', async (req, res) => {
  // List symbols in a file
});

// Query test console
app.post('/api/query', async (req, res) => {
  const { query, filters } = req.body;
  const results = await searchService.search(query, filters);
  res.json(results);
});
```

**Frontend (React):**
```
src/web/ui/
  ├── pages/
  │   ├── Settings.tsx
  │   ├── IndexExplorer.tsx
  │   └── QueryConsole.tsx
  ├── components/
  │   ├── ProgressStream.tsx
  │   ├── CodeViewer.tsx
  │   └── SymbolTree.tsx
  └── App.tsx
```

---

### 5. **Generated-File Detection** ⭐ MEDIUM PRIORITY

**What it does:**
- Downranks protobuf stubs, gRPC scaffolding, mocks, codegen outputs
- Hand-written code surfaces first

**Why it's valuable:**
- Reduces noise from auto-generated code
- Improves search quality

**Implementation:**

```typescript
// src/scanner/generatedFileDetector.ts
export function isGeneratedFile(path: string, content: string): boolean {
  // 1. Check file name patterns
  if (/(\.pb\.|\.g\.|\.generated\.|\.mock\.)/.test(path)) return true;
  if (/(__generated__|__mocks__)/.test(path)) return true;

  // 2. Check file header comments
  const firstLines = content.split('\n').slice(0, 10).join('\n');
  if (/(@generated|DO NOT EDIT|Code generated|Auto-generated)/i.test(firstLines)) {
    return true;
  }

  // 3. Check specific patterns
  if (path.endsWith('.proto.ts')) return true;
  if (path.endsWith('_pb.py')) return true;
  if (path.includes('vendor/') || path.includes('node_modules/')) return true;

  return false;
}

// Apply score penalty during ranking
function applyGeneratedFilePenalty(chunk: Chunk, score: number): number {
  if (isGeneratedFile(chunk.file, chunk.displayCode)) {
    return score * 0.3; // 70% penalty
  }
  return score;
}
```

---

### 6. **Enriched Output Format** ⭐ MEDIUM PRIORITY

**What it does:**
- Shows symbol names in context: `[callers: fn_a, fn_b +N more]`
- Numbered lines in output
- Clear range markers

**Example output:**
```
src/api/auth.ts#L10-25

  8 | import { validateToken } from './utils';
  9 |
 10 | export async function authenticate(req: Request) {
 11 |   const token = req.headers.authorization;
 12 |   if (!token) throw new Error('No token');
 13 |   return await validateToken(token);
 14 | }
 15 |

[Called by: loginHandler, refreshToken, +3 more]
[Calls: validateToken]
```

---

## 📋 Implementation Roadmap

### Phase 1: Search Enhancement (2-3 weeks)
1. ✅ Field-qualified search parser
2. ✅ Apply filters to search results
3. ✅ Update MCP tool schema
4. ✅ CLI support: `--filter "kind:function lang:ts"`

### Phase 2: Call Graph (3-4 weeks)
1. ✅ Extract call relationships from AST
2. ✅ Store in call_edges table
3. ✅ Implement BFS expansion
4. ✅ Update output format with caller/callee info

### Phase 3: Framework Detection (2-3 weeks)
1. ✅ Implement Express/Fastify detector
2. ✅ Implement React component detector
3. ✅ Implement FastAPI detector
4. ✅ Store in framework_edges table

### Phase 4: Web UI (4-5 weeks)
1. ✅ Setup Express + React
2. ✅ Settings page
3. ✅ Index explorer
4. ✅ Query console
5. ✅ SSE progress stream

### Phase 5: Quality Improvements (1-2 weeks)
1. ✅ Generated file detection
2. ✅ Enriched output format
3. ✅ Documentation updates

---

## 🔮 Future Considerations

### Performance Optimization (Rust Rewrite?)
- vibervn is 10-100x faster due to Rust
- Consider: Rust core + Node.js wrapper
- Or: Keep TypeScript, optimize hot paths

### Advanced Vector Index
- In-memory index like vibervn (HNSW)
- Faster than LanceDB file I/O
- Trade-off: Memory usage vs speed

### SurrealDB Migration
- Unified datastore (vector + relational)
- Better query capabilities
- Active development

---

## 📊 Expected Impact

| Feature | Impact | Effort |
|---------|--------|--------|
| Field-qualified search | 🔥🔥🔥 High | Low |
| Call-graph expansion | 🔥🔥🔥 High | High |
| Framework-aware | 🔥🔥🔥 High | Medium |
| Web UI | 🔥🔥 Medium | High |
| Generated file detection | 🔥 Low | Low |
| Enriched output | 🔥 Low | Low |

**Recommended priority:**
1. Field-qualified search (quick win)
2. Generated file detection (quick win)
3. Enriched output (quick win)
4. Call-graph expansion (high impact)
5. Framework-aware (high impact)
6. Web UI (nice to have)

---

## 🚀 Getting Started

Start with Phase 1 - Field-qualified search, which provides immediate value with minimal effort.
