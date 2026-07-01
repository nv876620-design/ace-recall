# Release Process Documentation

## Overview

The ACE release pipeline is designed to publish npm packages that work seamlessly across all major platforms (Windows, macOS, Linux) and architectures (x64, arm64) without requiring platform-specific builds.

## How Cross-Platform Support Works

### Native Dependencies with Prebuilt Binaries

ACE uses three native Node.js modules:

1. **better-sqlite3** (v12.5.0)
2. **@lancedb/lancedb** (v0.22.0)
3. **tree-sitter** (v0.25.0) and language parsers

All of these packages provide **prebuilt binaries** for common platforms via npm. When a user runs `npm install -g @nv876620-design/ace-recall`, npm automatically:

1. Detects the platform (`process.platform`) and architecture (`process.arch`)
2. Downloads the matching prebuilt binary from the package's registry
3. Falls back to source compilation if no prebuilt binary exists (rare)

### Why Single-Platform Build Works

**Key Insight**: We don't need to build on multiple platforms because:

- Native modules ship their prebuilt binaries separately
- Our TypeScript code compiles to platform-agnostic JavaScript
- npm handles platform-specific binary selection at install time

The release workflow only builds the TypeScript source to JavaScript once (on Linux), and npm takes care of the rest.

## Release Workflow

### Trigger Methods

**Method 1: Git Tag Push** (Recommended)
```bash
git tag v0.2.0
git push origin v0.2.0
```

**Method 2: Manual Workflow Dispatch**
- Go to GitHub Actions → Release workflow
- Click "Run workflow"
- Enter version (e.g., `0.2.0`)

### Workflow Steps

1. **Checkout**: Fetches the tagged version of the code
2. **Version Resolution**: Extracts version from tag (e.g., `v0.2.0` → `0.2.0`)
3. **Setup Environment**:
   - Install pnpm 10
   - Setup Node.js from `.node-version` (Node 22)
   - Configure npm registry for publishing
4. **Dependency Installation**: `pnpm install --frozen-lockfile`
5. **Run Tests**: Full test suite including unit, runtime, and e2e tests
6. **Build Packages**:
   - Main package: `pnpm build`
   - Language plugins: `pnpm -r --filter='!./packages/lang-all' build`
   - Meta package (lang-all): `pnpm --filter='./packages/lang-all' build`
7. **Version Verification**: Ensures all package.json versions match the release tag
8. **Publish to npm**:
   - Plugins published first (typescript, kotlin, java, etc.)
   - Main package published last
   - Each package checks if version already exists (idempotent)
   - Uses npm provenance for supply chain security
9. **Create GitHub Release**: Generates release notes with installation instructions

### Published Packages

| Package | Description |
|---------|-------------|
| `@nv876620-design/ace-recall` | Main CLI package |
| `@nv876620-design/ace-lang-typescript` | TypeScript AST parser plugin |
| `@nv876620-design/ace-lang-kotlin` | Kotlin AST parser plugin |
| `@nv876620-design/ace-lang-java` | Java AST parser plugin |
| `@nv876620-design/ace-lang-rust` | Rust AST parser plugin |
| `@nv876620-design/ace-lang-c` | C AST parser plugin |
| `@nv876620-design/ace-lang-cpp` | C++ AST parser plugin |
| `@nv876620-design/ace-lang-csharp` | C# AST parser plugin |
| `@nv876620-design/ace-lang-php` | PHP AST parser plugin |
| `@nv876620-design/ace-lang-ruby` | Ruby AST parser plugin |
| `@nv876620-design/ace-lang-swift` | Swift AST parser plugin |
| `@nv876620-design/ace-lang-all` | Meta-package including all language plugins |

## Prerequisites

### Required Secrets

Configure these in GitHub repository settings → Secrets and variables → Actions:

- **NPM_TOKEN**: npm authentication token with publish permission
  ```bash
  # Create token at: https://www.npmjs.com/settings/[username]/tokens
  # Select "Automation" token type
  # Scope: Read and Publish
  ```

### Package Configuration

Each package must have:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

For scoped packages (`@nv876620-design/*`), public access is required.

## Version Management

### Synchronization Strategy

All packages (main + plugins) must have the **same version number**. The workflow enforces this with a verification step.

To prepare a new release:

1. Update version in all `package.json` files:
   ```bash
   # Script to update all versions
   NEW_VERSION="0.2.1"
   
   # Update main package
   npm version $NEW_VERSION --no-git-tag-version
   
   # Update all plugin packages
   for dir in packages/*/; do
     (cd "$dir" && npm version $NEW_VERSION --no-git-tag-version)
   done
   ```

2. Commit version changes:
   ```bash
   git add package.json packages/*/package.json
   git commit -m "chore: bump version to v$NEW_VERSION"
   ```

3. Create and push tag:
   ```bash
   git tag "v$NEW_VERSION"
   git push origin main
   git push origin "v$NEW_VERSION"
   ```

### Version Verification

The workflow includes a Node.js script that checks all package versions match the tag:

```javascript
const files = [
  ['@nv876620-design/ace-recall', 'package.json'],
  ['@nv876620-design/ace-lang-typescript', 'packages/lang-typescript/package.json'],
  // ... all other packages
];

for (const [name, file] of files) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (pkg.version !== expectedVersion) {
    console.error(`${name} version mismatch!`);
    process.exit(1);
  }
}
```

## Publishing Strategy

### Idempotent Publishing

The workflow checks if a version already exists before attempting to publish:

```bash
if npm view "$PACKAGE@$VERSION" version >/dev/null 2>&1; then
  echo "Skip: $PACKAGE@$VERSION already published"
  exit 0
fi
```

This allows:
- Safe workflow re-runs after partial failures
- Manual package republishing if needed

### Dependency Order

Plugins are published before the main package because:
1. Main package doesn't directly depend on plugins (optional peer deps)
2. Users may want to install plugins separately
3. Ensures all parts are available when main package is published

### Provenance & Security

All packages are published with npm provenance (`--provenance` flag):
- Links package to source code commit
- Provides supply chain transparency
- Enables verification via [Socket](https://socket.dev/) or similar tools

## Platform-Specific Installation

### What Happens During `npm install -g`

1. **Download**: npm downloads `@nv876620-design/ace-recall` tarball
2. **Detect Platform**: Node.js determines `process.platform` and `process.arch`
3. **Install Dependencies**:
   - **better-sqlite3**: Downloads Windows `.node` / macOS `.dylib` / Linux `.so`
   - **@lancedb/lancedb**: Downloads platform-specific Rust binaries
   - **tree-sitter**: Downloads platform-specific WASM + native bindings
4. **Link Binary**: Creates symlink `ace` → `node_modules/.bin/ace-recall`

### Supported Platforms

| Platform | Architecture | Tested |
|----------|-------------|--------|
| Windows 10/11 | x64 | ✅ |
| Windows 10/11 | arm64 | ⚠️ Limited testing |
| macOS 11+ | x64 (Intel) | ✅ |
| macOS 11+ | arm64 (Apple Silicon) | ✅ |
| Linux (Ubuntu, Debian) | x64 | ✅ |
| Linux (Ubuntu, Debian) | arm64 | ✅ |
| Alpine Linux | x64 | ⚠️ May require build tools |

### Fallback to Source Compilation

If prebuilt binaries are unavailable, npm will try to compile from source. This requires:

- **Windows**: Visual Studio Build Tools or Windows SDK
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: `build-essential` (`apt-get install build-essential`)

## Troubleshooting

### Release Workflow Failures

**Issue: "Version mismatch" error**
- **Cause**: package.json versions don't match the git tag
- **Fix**: Update all package versions and recreate the tag

**Issue: "npm publish failed: 403 Forbidden"**
- **Cause**: Invalid or expired NPM_TOKEN
- **Fix**: Generate new npm token and update GitHub secret

**Issue: "npm publish failed: 409 Conflict"**
- **Cause**: Version already published
- **Fix**: This is expected behavior (idempotent). Workflow will skip.

### Installation Failures

**Issue: "Prebuild not found"**
- **Cause**: No prebuilt binary for the platform
- **Fix**: Install build tools (see Fallback to Source Compilation)

**Issue: "EACCES: permission denied"**
- **Cause**: No write permission to npm global directory
- **Fix**: Configure npm prefix to user directory (see [Installation Guide](INSTALLATION.md))

## Testing Before Release

### Local Testing

1. Build packages locally:
   ```bash
   pnpm build
   pnpm -r build
   ```

2. Test main package:
   ```bash
   pnpm link --global
   ace --version
   ace init
   ```

3. Test language plugins:
   ```bash
   cd packages/lang-typescript
   pnpm link --global
   ```

### Smoke Test

Create a test repository:
```bash
mkdir test-ace && cd test-ace
npm install -g @nv876620-design/ace-recall
ace init
ace index .
ace search
```

## Release Checklist

Before creating a release:

- [ ] All tests pass locally: `pnpm test`
- [ ] Version bumped in all package.json files
- [ ] CHANGELOG.md updated (if exists)
- [ ] Dependencies updated (if needed)
- [ ] Documentation updated (README, CLAUDE.md)
- [ ] Git tag created and pushed
- [ ] NPM_TOKEN secret is valid
- [ ] GitHub release notes drafted (auto-generated is fine)

After release:

- [ ] Verify main package: `npm view @nv876620-design/ace-recall`
- [ ] Test installation: `npm install -g @nv876620-design/ace-recall`
- [ ] Test on different platform (if possible)
- [ ] Announce release (GitHub Discussions, Twitter, etc.)

## Future Improvements

Potential enhancements to the release process:

1. **Multi-Platform Verification**: Run installation tests on Windows/macOS/Linux in CI
2. **Automated Version Bumping**: Script to update all package versions atomically
3. **Canary Releases**: Publish pre-release versions with `@next` tag
4. **Release Notes Automation**: Parse commit messages to generate structured changelogs
5. **Binary Size Optimization**: Investigate reducing native module sizes

## References

- [npm Publishing Guide](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [GitHub Actions: Publishing Packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [better-sqlite3 Prebuilds](https://github.com/WiseLibs/better-sqlite3#usage)
- [LanceDB Node Bindings](https://lancedb.github.io/lancedb/javascript/)
- [tree-sitter Bindings](https://github.com/tree-sitter/node-tree-sitter)
