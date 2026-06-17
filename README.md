# 🧠 Awesome Context Engineering (ACE)

> **ACE** is a next-generation semantic retrieval engine and Context-Weaving MCP Server designed specifically for AI Coding Agents. By fusing Vector search and AST-based Lexical search, ACE builds high-precision, token-efficient context packages to supercharge AI developer workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20%20%3C24-brightgreen)](https://nodejs.org/)

---

## 📖 Table of Contents
- [🚀 Quick Start](#-quick-start)
- [✨ Core Features](#-core-features)
- [🌐 Secure Web UI & Admin Dashboard](#-secure-web-ui--admin-dashboard)
- [🛠️ CLI Command Reference](#️-cli-command-reference)
- [🔌 Model Context Protocol (MCP) Integration](#-model-context-protocol-mcp-integration)
- [🏗️ Pipeline Architecture](#️-pipeline-architecture)
- [🔧 Configuration & Environment Variables](#-configuration--environment-variables)
- [📄 License & Credits](#-license--credits)

---

## 🚀 Quick Start

### 1. Installation
Install the CLI tool globally:
```bash
npm install -g @nv876620-design/ace-recall
```

### 2. Initialization
Setup the environment configuration file:
```bash
ace-recall init
```
This initializes a configuration template under `~/.coderecall/.env`.

### 3. Add API Keys
Open `~/.coderecall/.env` and configure your API keys (SiliconFlow, Jina, OpenAI, etc.):
```env
EMBEDDINGS_API_KEYS=your-embedding-key-1,your-embedding-key-2
RERANK_API_KEYS=your-reranker-key-here
ACE_ADMIN_PASSWORD=admin
```

### 4. Index a Codebase
Run the crawler and build the semantic vector index:
```bash
ace-recall index .
```

### 5. Launch the Web UI & MCP Server
Start the HTTP admin portal (running on port `9988` by default):
```bash
ace-recall mcp-http --port 9988
```

---

## ✨ Core Features

### 🔍 1. Hybrid Retrieval & RRF Fusion
Fuses **Dense Vector Embeddings** (e.g., SiliconFlow, OpenAI, Jina) with **FTS5 Lexical Search** (BM25) using **Reciprocal Rank Fusion (RRF)**. Resolves semantic intents and exact keyword matching simultaneously.

### 📊 2. AST-Based Semantic Chunking
Parses files into semantic abstract syntax tree nodes using **Tree-sitter** for 12+ programming languages. Respects logical scopes (classes, functions, methods) to prevent code truncation.

### 🧠 3. Smart Context Expansion (E1 / E2 / E3)
- **E1 (Neighbor Hops)**: Extracts adjacent chunks within the same source file.
- **E2 (Breadcrumbs)**: Restores parent context scopes (e.g., namespace or class declarations).
- **E3 (Import Resolution)**: Parses dependencies and references across TypeScript, Python, Go, Rust, Java, Kotlin, PHP, Ruby, Swift, Dart, and C/C++.

### 🤖 4. AI-Powered Developer Tooling
- **Commit Messages**: Analyzes `git diff` and automatically generates Conventional Commits:
  ```bash
  git add .
  ace-recall git-msg --style conventional
  ```
- **Task Detection**: Automatically discovers tasks defined in configuration files (npm scripts, Makefile, docker-compose, taskfile, etc.):
  ```bash
  ace-recall tasks
  ```

---

## 🌐 Secure Web UI & Admin Dashboard

ACE features a premium dark-themed admin dashboard (Glassmorphism layout with smooth transitions) accessible at `http://127.0.0.1:9988`:

- **🔒 Password Protection**: Secures dashboard operations with password authentication (defaults to `admin` if not set).
- **👁️ API Key Masking**: Automatically replaces active keys with masking characters (`*`) for security.
- **📁 Directory Browser**: Browse and pick `Workspace Path` using a built-in visual folder browser.
- **📈 System Monitoring**: Track server uptime, environment configurations, and active MCP status instantly.

---

## 🛠️ CLI Command Reference

| Command | Description |
|---------|-------------|
| `ace-recall init` | Creates the global `.env` file template under `~/.coderecall/.env` |
| `ace-recall index [path]` | Scans and indexes the target codebase directory (use `-f` to force rebuild) |
| `ace-recall search` | Performs interactive command-line searches on your indexed codebases |
| `ace-recall tasks [path]` | Automatically discovers runnable tasks and commands in the workspace |
| `ace-recall git-msg` | Generates a commit message using the current staged Git changes |
| `ace-recall mcp` | Starts the stdio-based MCP Server for IDE clients |
| `ace-recall mcp-http` | Runs the HTTP Server including the Web UI and MCP SSE transport portal |
| `ace-recall doctor [path]` | Checks consistency between FTS and Vector indices, with optional `--repair` |

---

## 🔌 Model Context Protocol (MCP) Integration

### Claude Desktop Integration
To use ACE as an MCP server with Claude Desktop, edit your configuration:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following config block:
```json
{
  "mcpServers": {
    "awesome-context-engineering": {
      "command": "ace-recall",
      "args": ["mcp"]
    }
  }
}
```

### Available Tools
1. `codebase-retrieval`: Semantically query the codebase.
2. `file-retrieval`: Read and retrieve files.
3. `generate-commit-message`: Generate commit messages from current staged diffs.
4. `detect-tasks`: Auto-detect build scripts and workspace tasks.

---

## 🏗️ Pipeline Architecture

```
[Index Pipeline]
Crawler (gitignore-aware) ➔ Filter (extension whitelists) ➔ AST Semantic Splitter ➔ Embeddings Generator ➔ LanceDB (Vector) + SQLite (FTS5)

[Search Pipeline]
User Query ➔ Hybrid Recall (Vector + BM25) ➔ RRF Fusion ➔ Rerank ➔ Graph Expander (Neighbor, Breadcrumb, Imports) ➔ Smart Context Packer ➔ Packaged Output
```

---

## 🔧 Configuration & Environment Variables

Configure these settings inside `~/.coderecall/.env`:

```env
# Embedding Models Config
EMBEDDINGS_API_KEYS=key1,key2        # Multi-key rotation supported
EMBEDDINGS_BASE_URL=https://...
EMBEDDINGS_MODEL=BAAI/bge-m3
EMBEDDINGS_DIMENSIONS=1024

# Reranker Config
RERANK_API_KEYS=key1,key2
RERANK_BASE_URL=https://...
RERANK_MODEL=BAAI/bge-reranker-v2-m3

# Admin Security
ACE_ADMIN_PASSWORD=your-secure-password
```

---

## 📄 License & Credits

- Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
- Extended and rebranded from original **CodeRecall** by `alistar.max`. Built with TypeScript, Tree-sitter, LanceDB, and Model Context Protocol.

---
Created with ❤️ by **Awesome Context Engineering** team.
