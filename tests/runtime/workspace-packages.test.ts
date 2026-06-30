import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type PackageDefinition = {
  dir: string;
  name: string;
};

const packageDefinitions: PackageDefinition[] = [
  { dir: 'lang-all', name: '@alistar.max/ace-lang-all' },
  { dir: 'lang-typescript', name: '@alistar.max/ace-lang-typescript' },
  { dir: 'lang-kotlin', name: '@alistar.max/ace-lang-kotlin' },
  { dir: 'lang-csharp', name: '@alistar.max/ace-lang-csharp' },
  { dir: 'lang-cpp', name: '@alistar.max/ace-lang-cpp' },
  { dir: 'lang-java', name: '@alistar.max/ace-lang-java' },
  { dir: 'lang-ruby', name: '@alistar.max/ace-lang-ruby' },
  { dir: 'lang-c', name: '@alistar.max/ace-lang-c' },
  { dir: 'lang-php', name: '@alistar.max/ace-lang-php' },
  { dir: 'lang-rust', name: '@alistar.max/ace-lang-rust' },
  { dir: 'lang-swift', name: '@alistar.max/ace-lang-swift' },
];

const requiredFiles = ['pnpm-workspace.yaml'];
for (const packageDefinition of packageDefinitions) {
  requiredFiles.push(`packages/${packageDefinition.dir}/package.json`);
  requiredFiles.push(`packages/${packageDefinition.dir}/tsconfig.json`);
  requiredFiles.push(`packages/${packageDefinition.dir}/src/index.ts`);
}

for (const relativePath of requiredFiles) {
  const filePath = path.resolve(process.cwd(), relativePath);
  assert.equal(fs.existsSync(filePath), true, `缺少文件: ${relativePath}`);
}

const workspaceContent = fs.readFileSync(path.resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf8');
assert.equal(workspaceContent.includes('packages/*'), true, 'pnpm-workspace.yaml 必须包含 packages/*');

for (const packageDefinition of packageDefinitions) {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), `packages/${packageDefinition.dir}/package.json`), 'utf8'),
  ) as {
    name: string;
    exports?: {
      '.': string | { default?: string };
    };
  };

  assert.equal(pkg.name, packageDefinition.name);

  const packageExport = pkg.exports?.['.'];
  assert.equal(
    typeof packageExport === 'string' ? packageExport : packageExport?.default,
    './dist/index.js',
  );
}
