# 🚀 New Features: NotepadAI-Inspired Additions

CodeRecall v0.1.7+ includes powerful new features inspired by [NotepadAI](https://github.com/nullmastermind/NotepadAI).

## ✨ Features Overview

### 1. 🤖 AI-Powered Commit Messages
Generate meaningful commit messages from your staged changes using AI.

### 2. 🔧 Automatic Task Detection
Discover all runnable tasks in your project automatically.

---

## 🤖 AI-Powered Commit Messages

### What it does
Analyzes your staged git changes and generates a well-formatted commit message following best practices.

### CLI Usage

```bash
# Basic usage (conventional commits style)
coderecall git-msg

# Different styles
coderecall git-msg --style simple
coderecall git-msg --style detailed

# Without detailed body
coderecall git-msg --no-body

# For a specific repository
coderecall git-msg /path/to/repo
```

### MCP Usage

From Claude Desktop or any MCP client:

```
Use the generate-commit-message tool with:
- repo_path: /path/to/your/repo
- style: "conventional" (or "simple", "detailed")
- include_body: true (optional)
```

### Example Workflow

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
# 
# 使用此消息:
#   git commit -m "feat(api): add JWT token validation"

# 3. Commit using the generated message
git commit -m "feat(api): add JWT token validation"
```

### Commit Message Styles

#### Conventional Commits (default)
```
feat(scope): add new feature
fix(auth): resolve null pointer bug
docs(readme): update installation guide
```

Format: `type(scope): description`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Maintenance

#### Simple
```
Add JWT token validation
Fix null pointer in auth service
Update installation documentation
```

Clear, concise descriptions without prefixes.

#### Detailed
```
Add comprehensive JWT token validation

Implemented a new middleware to validate JWT tokens
in all authenticated endpoints. Added utility functions
for parsing and verifying token signatures.
```

Extended message with explanation.

### Configuration

The tool uses your existing API configuration:

```env
# In ~/.coderecall/.env
RERANK_BASE_URL=https://api.siliconflow.cn/v1
RERANK_API_KEYS=sk-xxx

# The tool converts /rerank to /chat/completions
# Model used: Qwen/Qwen2.5-7B-Instruct
```

### Fallback Behavior

If the API fails or is not configured, the tool falls back to rule-based generation:

```typescript
// Analyzes:
// - File types (test, docs, source)
// - Change ratio (additions vs deletions)
// - Common directory (src, tests, docs)
// Generates appropriate conventional commit
```

---

## 🔧 Automatic Task Detection

### What it does
Scans your project and discovers all runnable tasks from:
- **package.json** (npm/pnpm/yarn scripts)
- **Makefile** (make targets)
- **justfile** (just recipes)
- **deno.json** (deno tasks)
- **Cargo.toml** (cargo commands)

### CLI Usage

```bash
# Detect tasks in current directory
coderecall tasks

# Detect tasks in specific directory
coderecall tasks /path/to/project
```

### MCP Usage

From Claude Desktop or any MCP client:

```
Use the detect-tasks tool with:
- repo_path: /path/to/your/repo
```

### Example Output

```bash
$ coderecall tasks

━━━━ 检测到 15 个任务 ━━━━

【PNPM】 (package.json)
  pnpm:build                          tsup src/index.ts --format esm
  pnpm:dev                            tsup src/index.ts --watch
  pnpm:test                           tsx tests/runtime/registry.test.ts
  pnpm:fmt                            biome check --write ./src

【MAKE】 (Makefile)
  make:install                        # Install dependencies
  make:clean                          # Clean build artifacts
  make:release                        # Create release build

【JUST】 (justfile)
  just:build-all                      # Build all packages
  just:lint                           # Run linter
  just:watch                          # Watch mode

运行任务:
  pnpm run build
```

### Supported Task Files

| File | Task Runner | Example |
|------|-------------|---------|
| `package.json` | npm/pnpm/yarn | `pnpm run build` |
| `Makefile` | make | `make install` |
| `justfile` | just | `just build-all` |
| `deno.json` | deno | `deno task dev` |
| `Cargo.toml` | cargo | `cargo build` |

### Use Cases

#### 1. Onboarding New Developers
```bash
# "How do I build this project?"
coderecall tasks

# Shows all available tasks instantly
```

#### 2. AI Agent Discovery
```
AI: "What tasks are available in this project?"
[calls detect-tasks tool]
AI: "I found 10 tasks. You can run 'pnpm test' to run tests."
```

#### 3. Quick Reference
```bash
# Forgot the exact command?
coderecall tasks | grep test

# Output:
#   pnpm:test        tsx tests/runtime/registry.test.ts
#   make:test        # Run all tests
```

---

## 🛠️ Implementation Details

### Architecture

```
src/
├── git/
│   ├── diff.ts                 # Git diff utilities
│   └── commitMessage.ts        # AI commit message generation
│
└── mcp/
    └── tools/
        ├── generateCommitMessage.ts  # MCP tool for commit messages
        └── detectTasks.ts            # MCP tool for task detection
```

### Key Technologies

- **Git Integration**: Direct `git` command execution via `child_process`
- **AI Generation**: Uses SiliconFlow API (Qwen/Qwen2.5-7B-Instruct)
- **Task Parsing**: Regex-based parsing of various project files
- **Fallback Logic**: Rule-based generation when API unavailable

### Error Handling

#### No Staged Changes
```bash
$ coderecall git-msg
Error: No staged changes found. Use `git add` first.
```

#### Not a Git Repository
```bash
$ coderecall git-msg /path/to/non-git
Error: /path/to/non-git is not a git repository
```

#### No Tasks Found
```bash
$ coderecall tasks
未找到任何任务

支持的文件: package.json, Makefile, justfile, deno.json, Cargo.toml
```

---

## 🔮 Future Enhancements

### Planned Features

1. **Interactive Task Runner**
   ```bash
   coderecall run-task
   # Interactive picker to select and run tasks
   ```

2. **Git-Aware Search**
   ```bash
   coderecall search --only-modified
   # Search only in files with uncommitted changes
   ```

3. **Multi-Workspace Support**
   ```bash
   coderecall workspace add ~/projects/app1
   coderecall workspace add ~/projects/app2
   coderecall workspace list
   ```

4. **Scheduled Indexing**
   ```bash
   coderecall daemon start
   # Auto-index on file changes (watch mode)
   ```

5. **SSH Remote Development**
   ```bash
   coderecall index ssh://user@host/path
   # Index remote repository over SSH
   ```

---

## 📊 Comparison with NotepadAI

| Feature | NotepadAI | CodeRecall | Notes |
|---------|-----------|------------|-------|
| AI Commit Messages | ✅ Built-in | ✅ CLI + MCP | CodeRecall uses API |
| Task Detection | ✅ Editor UI | ✅ CLI + MCP | CodeRecall outputs text |
| Git Integration | ✅ Full GUI | ⚠️ Basic CLI | CodeRecall focuses on indexing |
| Terminal | ✅ Embedded PTY | ❌ N/A | CodeRecall is CLI-only |
| Multi-Workspace | ✅ Multiple roots | 🚧 Planned | Coming in v0.2.0 |
| SSH Remote | ✅ SFTP | 🚧 Planned | Long-term goal |

**Key Difference:**
- **NotepadAI**: Desktop editor with AI **inside**
- **CodeRecall**: Context provider for **any** editor (via MCP)

---

## 🐛 Troubleshooting

### API Issues

**Problem:** `LLM API not configured`

**Solution:**
```bash
# Check your .env file
cat ~/.coderecall/.env

# Ensure these are set:
RERANK_BASE_URL=https://api.siliconflow.cn/v1/rerank
RERANK_API_KEYS=sk-xxx
```

### Git Issues

**Problem:** `Failed to get staged diff: Command failed`

**Solution:**
```bash
# Ensure git is installed and in PATH
git --version

# Ensure you're in a git repository
git status
```

### Task Detection Issues

**Problem:** Tasks not detected

**Solution:**
```bash
# Ensure task files exist
ls -la package.json Makefile justfile

# Check file permissions
```

---

## 📝 Examples

### Complete Workflow Example

```bash
# 1. Make changes to your code
vim src/api/auth.ts

# 2. Stage changes
git add src/api/auth.ts

# 3. Generate commit message
coderecall git-msg --style conventional

# Output:
# feat(api): implement JWT authentication
# 
# Add token validation middleware and helper functions
# for secure API authentication.

# 4. Commit
git commit -m "feat(api): implement JWT authentication"

# 5. Check available tasks
coderecall tasks

# 6. Run tests
pnpm test

# 7. Push
git push origin feature/auth
```

### MCP Workflow Example

**User:** "Help me commit my changes"

**AI:**
```
I'll help you generate a commit message.
[calls generate-commit-message tool]

I've generated this commit message based on your staged changes:

feat(api): implement JWT authentication

Would you like me to commit with this message?
```

**User:** "Yes, and also show me what tasks I can run"

**AI:**
```
[executes git commit]
Committed successfully!

[calls detect-tasks tool]

Here are the available tasks in your project:
- pnpm:build - Build the project
- pnpm:test - Run tests
- make:clean - Clean build artifacts

Would you like me to run the tests?
```

---

## 🎓 Learn More

- **NotepadAI Source**: https://github.com/nullmastermind/NotepadAI
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Just Command Runner**: https://github.com/casey/just
- **MCP Protocol**: https://modelcontextprotocol.io/

---

## 🤝 Contributing

We welcome contributions! Areas to improve:

1. **More task file formats** (gradle, rake, etc.)
2. **Better AI prompts** for commit messages
3. **Interactive mode** for task selection
4. **Git hooks integration** (auto-generate on pre-commit)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## 📜 License

GPL-3.0 - Same as CodeRecall

**Inspiration Credits:** Features inspired by [NotepadAI](https://github.com/nullmastermind/NotepadAI) by nullmastermind.
