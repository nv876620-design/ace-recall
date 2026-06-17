# NotepadAI Inspiration for CodeRecall

Các ý tưởng hay từ [NotepadAI](https://github.com/nullmastermind/NotepadAI) có thể áp dụng vào CodeRecall.

## 🎯 Ý tưởng có thể implement ngay

### 1. **Auto Commit Message Generation** ⭐ HIGH PRIORITY
**NotepadAI có gì:**
- AI tự động viết commit message từ staged diff
- Tích hợp trong git commit flow

**Áp dụng vào CodeRecall:**
```typescript
// Thêm vào src/mcp/tools/
export async function generateCommitMessage(
  repoPath: string,
  stagedFiles: string[]
): Promise<string> {
  // 1. Get diff của staged files
  const diff = await getStagedDiff(repoPath);
  
  // 2. Gọi embedding model để tóm tắt changes
  const embeddingClient = getEmbeddingClient();
  const summary = await embeddingClient.generateText({
    prompt: `Analyze this git diff and write a concise commit message following conventional commits format:\n\n${diff}`,
    maxTokens: 100
  });
  
  // 3. Format theo conventional commits
  return formatCommitMessage(summary);
}
```

**Use cases:**
- MCP tool: `generate-commit-message`
- CLI: `coderecall git-msg`
- Auto-generate khi user gõ `git commit` mà chưa có message

---

### 2. **Task Detection & Quick Actions** ⭐ HIGH PRIORITY
**NotepadAI có gì:**
- Parse Justfile, Makefile, package.json, deno.json
- Hiển thị clickable run icons trong editor margin
- Scheduled tasks (cron)

**Áp dụng vào CodeRecall:**
```typescript
// src/scanner/taskDetector.ts
export interface DetectedTask {
  name: string;
  command: string;
  file: string;
  type: 'npm' | 'make' | 'just' | 'deno' | 'cargo';
}

export function detectProjectTasks(rootPath: string): DetectedTask[] {
  const tasks: DetectedTask[] = [];
  
  // Parse package.json scripts
  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
      tasks.push({
        name: `npm:${name}`,
        command: `npm run ${name}`,
        file: 'package.json',
        type: 'npm'
      });
    }
  }
  
  // Parse Makefile targets
  const makefilePath = path.join(rootPath, 'Makefile');
  if (fs.existsSync(makefilePath)) {
    const content = fs.readFileSync(makefilePath, 'utf-8');
    const targets = content.match(/^([a-zA-Z0-9_-]+):/gm);
    if (targets) {
      for (const target of targets) {
        const name = target.slice(0, -1);
        tasks.push({
          name: `make:${name}`,
          command: `make ${name}`,
          file: 'Makefile',
          type: 'make'
        });
      }
    }
  }
  
  // Parse Justfile
  // Parse Cargo.toml
  // etc...
  
  return tasks;
}
```

**MCP Tool:**
```typescript
// src/mcp/tools/listTasks.ts
export const listTasksSchema = z.object({
  repo_path: z.string()
});

export async function handleListTasks(args: z.infer<typeof listTasksSchema>) {
  const tasks = detectProjectTasks(args.repo_path);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(tasks, null, 2)
    }]
  };
}
```

**Use cases:**
- AI agent tự động discover available tasks
- Suggest tasks khi user hỏi "how do I run tests?"
- Quick actions trong MCP UI

---

### 3. **Multi-Workspace Support** ⭐ MEDIUM PRIORITY
**NotepadAI có gì:**
- Nhiều folder roots mở cùng lúc
- Mỗi workspace độc lập
- Data directory configurable

**Áp dụng vào CodeRecall:**
```typescript
// src/db/workspace.ts
export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  projectId: string; // generateProjectId(rootPath)
  lastOpened: number;
}

export class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  
  addWorkspace(rootPath: string): Workspace {
    const projectId = generateProjectId(rootPath);
    const workspace: Workspace = {
      id: projectId,
      name: path.basename(rootPath),
      rootPath,
      projectId,
      lastOpened: Date.now()
    };
    this.workspaces.set(projectId, workspace);
    return workspace;
  }
  
  listWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values())
      .sort((a, b) => b.lastOpened - a.lastOpened);
  }
  
  switchWorkspace(projectId: string): void {
    const ws = this.workspaces.get(projectId);
    if (ws) {
      ws.lastOpened = Date.now();
    }
  }
}
```

**MCP Tool:**
```typescript
// list-workspaces, switch-workspace, add-workspace
```

**Benefits:**
- User có thể index nhiều projects
- Chuyển đổi nhanh giữa các projects
- Mỗi project có vector store riêng

---

### 4. **Portable Mode & Data Directory Config** ⭐ LOW PRIORITY
**NotepadAI có gì:**
- CLI flag: `--data-dir=D:/profiles/work`
- Env var: `NOTEPADAI_DATA_DIR`
- Portable marker file
- Settings UI

**Áp dụng vào CodeRecall:**
```typescript
// src/utils/paths.ts (update)
export function getConfigBaseDir(): string {
  // Priority order:
  // 1. CLI flag --data-dir
  // 2. Env var CODERECALL_DATA_DIR
  // 3. Portable marker (./portable file exists)
  // 4. Default (~/.coderecall)
  
  const cliDataDir = process.argv.find(arg => arg.startsWith('--data-dir='));
  if (cliDataDir) {
    return path.resolve(cliDataDir.split('=')[1]);
  }
  
  const envDataDir = process.env.CODERECALL_DATA_DIR;
  if (envDataDir) {
    return path.resolve(envDataDir);
  }
  
  const exeDir = path.dirname(process.execPath);
  const portableMarker = path.join(exeDir, 'portable');
  if (fs.existsSync(portableMarker)) {
    return path.join(exeDir, 'data');
  }
  
  return path.join(os.homedir(), '.coderecall');
}
```

**Use cases:**
- Corporate environments (data trên network drive)
- USB portable mode
- Multiple profiles

---

### 5. **Progress UI Enhancements** ⭐ MEDIUM PRIORITY
**NotepadAI có gì:**
- SFTP progress với conflict detection
- Detailed progress tracking

**Áp dụng vào CodeRecall:**

Hiện tại CodeRecall đã có `onProgress` callback trong `scan()`, nhưng chưa đủ chi tiết.

**Cải thiện:**
```typescript
// src/scanner/index.ts
export interface DetailedProgress {
  stage: 'crawl' | 'process' | 'embed' | 'index';
  current: number;
  total: number;
  message: string;
  files?: {
    current: string;
    remaining: string[];
  };
  errors?: Array<{ file: string; error: string }>;
  eta?: number; // Estimated time remaining (ms)
}

export type DetailedProgressCallback = (progress: DetailedProgress) => void;
```

**MCP Integration:**
- Gửi `notifications/progress` với detailed info
- Claude Desktop có thể show progress bar

---

### 6. **Git Integration Ideas** (Long-term)
**NotepadAI có gì:**
- Inline blame
- Gutter diff markers
- Interactive rebase editor
- 3-way conflict viewer
- Parse git directly (không shell out)

**CodeRecall context:**
- CodeRecall là **indexing/search tool**, không phải editor
- Nhưng có thể thêm git-aware features vào search:

**Ý tưởng:**
```typescript
// src/search/gitAwareSearch.ts
export interface GitAwareSearchOptions {
  onlyModified?: boolean;      // Chỉ search trong modified files
  excludeIgnored?: boolean;     // Exclude .gitignore files
  authorFilter?: string;        // Chỉ search code của author X
  sinceCommit?: string;         // Chỉ search changes since commit X
}
```

**Use cases:**
- "Find authentication logic that changed in last 3 commits"
- "Search only in files modified by author John"
- "Find TODO comments in uncommitted changes"

---

## 🚀 Implementation Roadmap

### Phase 1 (Quick Wins - 1 week)
1. ✅ **Auto Commit Message** - Thêm MCP tool `generate-commit-message`
2. ✅ **Task Detection** - Thêm MCP tool `list-tasks` + `run-task`
3. ✅ **Detailed Progress** - Improve progress reporting

### Phase 2 (Medium - 2 weeks)
4. ✅ **Multi-Workspace** - Workspace manager + MCP tools
5. ✅ **Portable Mode** - Data directory config

### Phase 3 (Long-term - Future)
6. ❌ **Git-Aware Search** - Extend search với git context
7. ❌ **Scheduled Tasks** - Cron-like background indexing

---

## 💡 Other Inspirations

### SSH Remote Development
- NotepadAI hỗ trợ SSH + SFTP
- CodeRecall có thể thêm:
  - `coderecall index ssh://user@host/path`
  - Remote vector store sync

### Mini-Apps (WebView Tools)
- NotepadAI có HTML/JS mini-apps
- CodeRecall có thể có:
  - Search result visualizer (web UI)
  - Vector space explorer
  - Query debugger

### Scheduled Indexing
- NotepadAI có scheduled tasks
- CodeRecall có thể có:
  - Auto-index on file change (watch mode)
  - Nightly full re-index
  - Incremental index every N minutes

---

## 📝 Notes

- NotepadAI là C++/Qt desktop app → focus on UI/UX
- CodeRecall là Node.js CLI/MCP tool → focus on API/integration
- Không nên copy 100% features, chỉ lấy ý tưởng phù hợp

**Core difference:**
- NotepadAI: "Editor with AI inside"
- CodeRecall: "AI context provider for any editor"

**Synergy:**
- User dùng NotepadAI (hoặc VSCode, Cursor, etc) làm editor
- CodeRecall chạy background như MCP server
- Editor gọi CodeRecall qua MCP để lấy context
