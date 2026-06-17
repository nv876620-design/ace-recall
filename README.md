# Awesome Context Engineering (ACE)

> A powerful context weaving tool for AI agents with advanced code intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20%20%3C24-brightgreen)](https://nodejs.org/)

## 🚀 Quick Start

```bash
# Install globally
npm install -g @nv876620-design/ace-recall

# Or use with npx
npx @nv876620-design/ace-recall

# Initialize configuration
ace-recall init

# Index your codebase
ace-recall index .

# Start MCP server
ace-recall mcp

# Start HTTP server with Web UI
ace-recall mcp-http --port 6699
```

## ✨ Features

### Core Capabilities
- 🔍 **Semantic Code Search** - Find code by meaning via embeddings
- 🧠 **Hybrid Retrieval** - Vector search + Full-text search (BM25) with RRF fusion
- 📊 **AST-Based Chunking** - Tree-sitter semantic splitting for 12+ languages
- 🎯 **Smart Context Expansion** - Neighbor chunks, breadcrumb completion, import resolution
- 🔄 **Incremental Indexing** - Fast updates with change detection
- 🌐 **MCP Integration** - Works with Claude Desktop and other AI agents

### NEW: Developer Productivity Features (v0.2.0)

#### 🤖 AI-Powered Commit Messages
Generate meaningful commit messages automatically:
```bash
git add .
ace-recall git-msg --style conventional
```

#### 🔧 Automatic Task Detection
Discover all runnable tasks in your project:
```bash
ace-recall tasks
```

#### 🎯 Field-Qualified Search
Filter search results with precision:
```bash
# Search for specific types of code
ace-recall search-context \
  --information-request "authentication logic kind:function lang:typescript"
```

## 📦 Installation

### Prerequisites
- Node.js >= 20 and < 24
- Git (for version control features)

### Global Installation
```bash
npm install -g @nv876620-design/ace-recall
```

### Usage in Projects
```bash
# Initialize config
ace-recall init

# Index your codebase
ace-recall index /path/to/project

# Search for code
ace-recall search-context \
  --project-path /path/to/project \
  --information-request "user authentication"
```

## 🔧 Configuration

ACE uses environment variables for API keys. Create a `.env` file:

```env
# Embedding API (required)
RERANK_BASE_URL=https://api.siliconflow.cn/v1
RERANK_API_KEY=your-api-key-here

# Admin password for Web UI (optional)
ACE_ADMIN_PASSWORD=your-secure-password

# Token secret for API authentication (optional)
ACE_TOKEN_SECRET=your-secret-key
```

## 🌐 Web UI

Start the HTTP server with Web UI:

```bash
ace-recall mcp-http --port 6699 --bind 0.0.0.0
```

Access at: http://localhost:6699

### Authentication
- Default admin login required
- Set password via `ACE_ADMIN_PASSWORD` environment variable
- Generate API tokens for programmatic access

## 🛠️ Commands

### Indexing
```bash
# Index current directory
ace-recall index .

# Force full re-index
ace-recall index . --force

# Index with custom chunk size
ace-recall index . --chunk-size 1024
```

### Search
```bash
# Basic search
ace-recall search-context \
  --information-request "database connection"

# With filters
ace-recall search-context \
  --information-request "API handlers kind:function path:src/api"

# Specify project
ace-recall search-context \
  --project-path /path/to/project \
  --information-request "error handling"
```

### Git Integration
```bash
# Generate commit message
ace-recall git-msg

# With specific style
ace-recall git-msg --style conventional
ace-recall git-msg --style simple
ace-recall git-msg --style detailed

# Without body
ace-recall git-msg --no-body
```

### Task Management
```bash
# Detect tasks
ace-recall tasks

# Detect in specific directory
ace-recall tasks /path/to/project
```

### MCP Server
```bash
# Start MCP server (stdio)
ace-recall mcp

# Start HTTP server
ace-recall mcp-http --port 6699
```

## 🔌 MCP Integration

### Claude Desktop Configuration

Add to your Claude Desktop config:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ace-recall": {
      "command": "ace-recall",
      "args": ["mcp"]
    }
  }
}
```

### Available MCP Tools
- `codebase-retrieval` - Search codebase semantically
- `file-retrieval` - Retrieve specific files
- `generate-commit-message` - Generate AI commit messages
- `detect-tasks` - Detect runnable tasks

## 📚 Documentation

- [Field-Qualified Search Guide](docs/FIELD_QUALIFIED_SEARCH.md)
- [New Features Guide](docs/QUICK_START_NEW_FEATURES.md)
- [Implementation Report](docs/FINAL_IMPLEMENTATION_REPORT.md)
- [Inspiration Sources](docs/CROSS_REPO_INSPIRATION_SUMMARY.md)

## 🎯 Use Cases

### For AI Coding Agents
- Provide accurate code context for Claude, GPT-4, and other AI agents
- Semantic search understands intent, not just keywords
- Smart context expansion reduces hallucinations

### For Developers
- Generate meaningful commit messages automatically
- Discover tasks across different build systems
- Search code with precision using field filters

### For Teams
- Consistent code understanding across AI agents
- Self-hosted with no cloud dependencies
- Token-based API access for automation

## 🏗️ Architecture

```
ACE Recall
├── Indexing Pipeline
│   ├── File Scanner (fdir + ignore patterns)
│   ├── AST Parser (Tree-sitter)
│   ├── Semantic Chunker
│   └── Embedding Generator (BAAI/bge-m3)
├── Storage Layer
│   ├── SQLite (metadata + FTS)
│   └── LanceDB (vector embeddings)
├── Search Pipeline
│   ├── Hybrid Retrieval (Vector + BM25)
│   ├── RRF Fusion
│   ├── Reranking (BAAI/bge-reranker-v2-m3)
│   └── Context Expansion (Graph + Import)
└── Interfaces
    ├── CLI Commands
    ├── MCP Server (stdio)
    ├── HTTP Server + Web UI
    └── API Endpoints
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Credits

- Original CodeRecall by alistar.max
- Enhanced with features inspired by nullmastermind's work
- Built with TypeScript, LanceDB, Tree-sitter, and MCP SDK

---

**Awesome Context Engineering** - Making AI agents smarter with better code context 🚀
