# 🚀 Quick Start: New Features

## Overview

CodeRecall v0.1.7+ includes powerful new features inspired by nullmastermind's repositories:
- **AI-Powered Commit Messages** - Generate meaningful commit messages automatically
- **Task Detection** - Discover all runnable tasks in your project
- **Field-Qualified Search** - Filter search results with precision

---

## 🤖 AI Commit Messages

### Quick Example

```bash
# 1. Stage your changes
git add src/api/auth.ts src/utils/validation.ts

# 2. Generate commit message
coderecall git-msg

# Output:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# feat(api): add JWT token validation
# 
# - Implement token verification middleware
# - Add validation utilities for auth headers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 3. Use the generated message
git commit -m "feat(api): add JWT token validation"
```

### Available Styles

```bash
# Conventional Commits (default)
coderecall git-msg --style conventional

# Simple style
coderecall git-msg --style simple

# Detailed with explanation
coderecall git-msg --style detailed

# Without body
coderecall git-msg --no-body
```

### From MCP Clients

```typescript
// In Claude Desktop or any MCP client
use generate-commit-message with:
  repo_path: "/path/to/repo"
  style: "conventional"
  include_body: true
```

---

## 🔧 Task Detection

### Quick Example

```bash
# Detect all tasks in current directory
coderecall tasks

# Output:
# ━━━━ 检测到 15 个任务 ━━━━
# 
# 【PNPM】 (package.json)
#   pnpm:build      tsup src/index.ts --format esm...
#   pnpm:test       tsx tests/...
#   pnpm:fmt        biome check --write ./src
#   ...
```

### From MCP Clients

```typescript
use detect-tasks with:
  repo_path: "/path/to/repo"
```

### Supported Formats

- ✅ `package.json` scripts (npm/pnpm/yarn)
- ✅ `Makefile` targets
- ✅ `justfile` recipes
- ✅ `deno.json` tasks
- ✅ `Cargo.toml` (common cargo commands)

---

## 🔍 Field-Qualified Search

### Quick Examples

```bash
# Filter by symbol kind
coderecall search-context \
  --information-request "authentication logic kind:function"

# Multiple filters
coderecall search-context \
  --information-request "database models kind:class lang:typescript path:src/db"

# Language filter
coderecall search-context \
  --information-request "error handling lang:python lang:rust"

# Path filter
coderecall search-context \
  --information-request "API endpoints path:src/api path:routes"

# Name filter
coderecall search-context \
  --information-request "validation logic name:Validator name:validate"
```

### Available Filters

| Filter | Description | Example |
|--------|-------------|---------|
| `kind:` | Filter by symbol type | `kind:function`, `kind:class`, `kind:method` |
| `lang:` | Filter by programming language | `lang:typescript`, `lang:python` |
| `path:` | Filter by file path pattern | `path:src/api`, `path:components` |
| `name:` | Filter by symbol name | `name:Handler`, `name:Controller` |

### From MCP Clients

The field-qualified search is automatically integrated into the `codebase-retrieval` MCP tool:

```typescript
use codebase-retrieval with:
  repo_path: "/path/to/repo"
  information_request: "authentication kind:function lang:typescript path:src/auth"
```

---

## 📚 Documentation

- **User Guide**: [NEW_FEATURES.md](NEW_FEATURES.md)
- **Field-Qualified Search**: [FIELD_QUALIFIED_SEARCH.md](FIELD_QUALIFIED_SEARCH.md)
- **NotepadAI Inspiration**: [NOTEPADAI_INSPIRATION.md](NOTEPADAI_INSPIRATION.md)
- **vibervn Inspiration**: [VIBERVN_INSPIRATION.md](VIBERVN_INSPIRATION.md)
- **Full Report**: [FINAL_IMPLEMENTATION_REPORT.md](FINAL_IMPLEMENTATION_REPORT.md)

---

## 🎯 Tips

1. **Commit Messages**: Always stage changes with `git add` before generating messages
2. **Tasks**: Run `coderecall tasks` in any project to discover available commands
3. **Search Filters**: Combine multiple filters for precise results
4. **MCP Integration**: All features are available through MCP tools for AI agents

---

## 🐛 Troubleshooting

### Commit message generation fails
- Ensure you have staged changes: `git status`
- Check if you're in a git repository: `git rev-parse --git-dir`
- Verify API keys are configured in `.env`

### Task detection finds nothing
- Check if you have supported files (`package.json`, `Makefile`, etc.)
- Verify file permissions

### Field-qualified search returns no results
- Ensure the repository is indexed: `coderecall index .`
- Check filter syntax (use `:` separator, not `=`)
- Try without filters first to verify basic search works

---

## 🚀 Next Steps

1. Try generating a commit message for your current work
2. Discover tasks in your projects with `coderecall tasks`
3. Explore field-qualified search to find specific code patterns
4. Integrate with Claude Desktop or other MCP clients

**Enjoy the new features!** 🎉
