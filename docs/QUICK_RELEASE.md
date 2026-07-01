# Quick Release Guide

This guide shows how to create and publish a new ACE release.

## Prerequisites

1. NPM account with publish permission for `@nv876620-design` scope
2. NPM_TOKEN configured in GitHub repository secrets
3. All changes committed and tests passing

## Step-by-Step Release Process

### 1. Update Version

Choose your new version number following [Semantic Versioning](https://semver.org/):
- **Patch** (0.2.0 → 0.2.1): Bug fixes, no breaking changes
- **Minor** (0.2.1 → 0.3.0): New features, no breaking changes
- **Major** (0.3.0 → 1.0.0): Breaking changes

Update all package versions:

```bash
# Set new version
NEW_VERSION="0.2.1"

# Update main package
npm version $NEW_VERSION --no-git-tag-version

# Update all language plugin packages
for dir in packages/*/; do
  (cd "$dir" && npm version $NEW_VERSION --no-git-tag-version)
done
```

### 2. Commit Version Changes

```bash
git add package.json packages/*/package.json
git commit -m "chore: bump version to v$NEW_VERSION"
git push origin main
```

### 3. Create and Push Git Tag

```bash
git tag "v$NEW_VERSION"
git push origin "v$NEW_VERSION"
```

This triggers the GitHub Actions release workflow automatically.

### 4. Monitor Release Workflow

1. Go to: https://github.com/nv876620-design/ace-recall/actions
2. Click on the running "Release" workflow
3. Monitor progress (~5-10 minutes)

### 5. Verify Published Packages

```bash
# Check main package
npm view @nv876620-design/ace-recall

# Test installation
npm install -g @nv876620-design/ace-recall
ace --version
```

### 6. Test on Different Platforms (Optional but Recommended)

- **Windows**: `npm install -g @nv876620-design/ace-recall`
- **macOS**: `npm install -g @nv876620-design/ace-recall`
- **Linux**: `npm install -g @nv876620-design/ace-recall`

## Manual Workflow Trigger (Alternative)

If you prefer not to use git tags:

1. Go to: https://github.com/nv876620-design/ace-recall/actions
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter version (e.g., `0.2.1`)
5. Click "Run workflow" button

**Note**: The git tag must already exist for this method.

## Troubleshooting

### "Version mismatch" Error

All package.json files must have matching versions:

```bash
# Check all versions
grep '"version"' package.json packages/*/package.json

# Fix if needed and recommit
```

### "403 Forbidden" During Publish

NPM_TOKEN expired or invalid:

1. Create new token: https://www.npmjs.com/settings/[username]/tokens
2. Update GitHub secret: Settings → Secrets → Actions → NPM_TOKEN

### "409 Conflict" During Publish

Version already published (this is OK, workflow will skip).

To republish:
1. Increment version: `0.2.1` → `0.2.2`
2. Follow steps 1-3 again

## Post-Release

After successful release:

1. Verify installation works: `npm install -g @nv876620-design/ace-recall`
2. Check GitHub Releases page for auto-generated release notes
3. Update release notes if needed (add highlights, breaking changes)
4. Announce release (optional):
   - GitHub Discussions
   - Project README
   - Social media

## Emergency Rollback

If a broken version was published:

### Option 1: Deprecate the Version

```bash
npm deprecate @nv876620-design/ace-recall@0.2.1 "Broken release, use 0.2.2"
```

### Option 2: Publish Hotfix

```bash
# Fix the issue, then:
NEW_VERSION="0.2.2"  # or use patch increment
# Follow release process steps 1-5
```

### Option 3: Unpublish (Last Resort, < 24 hours only)

```bash
npm unpublish @nv876620-design/ace-recall@0.2.1
```

**Warning**: Unpublishing is permanent and can break dependent projects.

## Canary/Beta Releases

For testing before official release:

```bash
# Tag as beta
NEW_VERSION="0.3.0-beta.1"
npm version $NEW_VERSION --no-git-tag-version

# Update all packages (same as above)
for dir in packages/*/; do
  (cd "$dir" && npm version $NEW_VERSION --no-git-tag-version)
done

# Commit and tag
git commit -am "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

# Users install with:
npm install -g @nv876620-design/ace-recall@beta
```

## Full Release Checklist

Before creating release:

```bash
# Run full test suite
pnpm test
pnpm test:benchmark

# Build all packages
pnpm build
pnpm -r build

# Test locally
pnpm link --global
ace --version
ace init
ace index .
ace search

# Check versions are synced
grep '"version"' package.json packages/*/package.json
```

After release:

```bash
# Verify npm package
npm view @nv876620-design/ace-recall

# Test fresh install
npm install -g @nv876620-design/ace-recall
ace --version

# Check GitHub release created
# Visit: https://github.com/nv876620-design/ace-recall/releases
```

## References

- [Full Release Process Documentation](RELEASE_PROCESS.md)
- [Installation Guide](INSTALLATION.md)
- [Semantic Versioning](https://semver.org/)
- [npm publish documentation](https://docs.npmjs.com/cli/v10/commands/npm-publish)
