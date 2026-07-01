# Installation Guide

## Quick Install

### Global Installation (Recommended)

```bash
npm install -g @nv876620-design/ace-recall
```

Or using pnpm:

```bash
pnpm add -g @nv876620-design/ace-recall
```

### Verify Installation

```bash
ace --version
ace init
```

## Platform Support

ACE (Awesome Context Engineering) supports the following platforms:

| Platform | Architecture | Status |
|----------|-------------|--------|
| Windows | x64 | ✅ Supported |
| macOS | x64 (Intel) | ✅ Supported |
| macOS | arm64 (Apple Silicon) | ✅ Supported |
| Linux | x64 | ✅ Supported |
| Linux | arm64 | ✅ Supported |

## Native Dependencies

ACE includes native Node.js modules that are automatically downloaded during installation:

- **better-sqlite3**: SQLite database bindings
- **@lancedb/lancedb**: Vector database for semantic search
- **tree-sitter**: Parser generator tool for AST-based code chunking
- **tree-sitter-{language}**: Language-specific parsers

### First-Time Installation Notes

1. **Network Connection**: First installation requires downloading prebuilt binaries for your platform
2. **Node.js Version**: Requires Node.js 20 or 22 (recommended: Node 22 LTS)
3. **Installation Time**: May take 1-3 minutes depending on your network speed

### Troubleshooting Installation

If you encounter issues during installation:

```bash
# Clear npm cache
npm cache clean --force

# Retry installation
npm install -g @nv876620-design/ace-recall
```

#### Common Issues

**1. "Node version mismatch"**
```bash
# Check your Node version
node --version

# Should be >= 20.0.0 and < 24.0.0
# Switch to Node 22 (recommended)
nvm install 22
nvm use 22
```

**2. "Permission denied" (Linux/macOS)**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g @nv876620-design/ace-recall

# Option 2: Configure npm to use user directory (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g @nv876620-design/ace-recall
```

**3. "Prebuild not found" errors**

This means the native module doesn't have a prebuilt binary for your platform. The module will attempt to compile from source. Ensure you have:

- **Windows**: Visual Studio Build Tools or Windows SDK
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `build-essential` package (`apt-get install build-essential`)

## Language Plugins

ACE comes with built-in support for JavaScript, Python, and Go. For additional languages, install the corresponding plugin:

### TypeScript / Kotlin / Java / Rust (Core Support)

These are already included in the main package as default plugins.

### Additional Language Plugins

```bash
# C language support
npm install -g @nv876620-design/ace-lang-c

# C++ language support
npm install -g @nv876620-design/ace-lang-cpp

# C# language support
npm install -g @nv876620-design/ace-lang-csharp

# PHP language support
npm install -g @nv876620-design/ace-lang-php

# Ruby language support
npm install -g @nv876620-design/ace-lang-ruby

# Swift language support
npm install -g @nv876620-design/ace-lang-swift

# Install ALL language plugins at once
npm install -g @nv876620-design/ace-lang-all
```

## Configuration

After installation, initialize ACE configuration:

```bash
ace init
```

This creates `~/.ace/.env` with default configuration. Edit this file to add your API keys:

```bash
# Embedding API configuration (required)
EMBEDDINGS_API_KEYS=your-api-key-here

# Reranker configuration (required)
RERANK_API_KEYS=your-api-key-here
```

## Usage

### Index a Repository

```bash
# Index current directory
ace index .

# Index specific path
ace index /path/to/your/project

# Force reindex
ace index . -f
```

### Search

```bash
# Interactive search
ace search

# Start MCP server (stdio)
ace mcp

# Start MCP HTTP server
ace mcp-http --port 3000
```

## Docker Installation

If you prefer Docker:

```bash
docker pull ghcr.io/nv876620-design/ace-recall:latest

docker run -it \
  -v ~/.ace:/root/.ace \
  -v /path/to/your/code:/workspace \
  ghcr.io/nv876620-design/ace-recall:latest \
  ace index /workspace
```

## Development Installation

For contributors or developers who want to build from source:

```bash
# Clone repository
git clone https://github.com/nv876620-design/ace-recall.git
cd ace-recall

# Install dependencies
pnpm install --frozen-lockfile

# Build
pnpm build

# Link globally
pnpm link --global

# Verify
ace --version
```

## Uninstallation

```bash
# Remove global package
npm uninstall -g @nv876620-design/ace-recall

# Remove configuration and data (optional)
rm -rf ~/.ace
```

## Getting Help

- Documentation: [README.md](../README.md)
- Issues: [GitHub Issues](https://github.com/nv876620-design/ace-recall/issues)
- Architecture: [docs/architecture.md](./architecture.md)

## License

MIT - see [LICENSE](../LICENSE) for details
