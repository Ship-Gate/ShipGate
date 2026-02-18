/**
 * Debug: replicate the verify test runner step by step
 * Run: node debug-verify.mjs
 */
import { createRequire } from 'module';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const { parse } = require('../parser/dist/index.cjs');
const { generate } = require('../codegen-tests/dist/index.cjs');

const specContent = readFileSync('../../shipgate-ci-toolkit/examples/demo-repo/specs/user-service.isl', 'utf-8');
const implContent = readFileSync('../../shipgate-ci-toolkit/examples/demo-repo/src/user-service.ts', 'utf-8');
const implSource = `// === user-service.ts ===\n${implContent}`;

const parseResult = parse(specContent, 'spec.isl');
const domain = parseResult.domain;
const domainName = domain.name.name.toLowerCase(); // 'userservice'

// Create workDir
const workDir = join(tmpdir(), 'isl-verify-debug');
mkdirSync(workDir, { recursive: true });
mkdirSync(join(workDir, 'src'), { recursive: true });
mkdirSync(join(workDir, 'helpers'), { recursive: true });
mkdirSync(join(workDir, 'fixtures'), { recursive: true });

// Write impl
writeFileSync(join(workDir, 'src', `${domainName}.impl.ts`), implSource);

// Generate types
const typeLines = ['// Auto-generated types'];
for (const b of domain.behaviors) {
  if (b.input?.fields?.length) {
    typeLines.push(`export interface ${b.name.name}Input {`);
    for (const f of b.input.fields) { typeLines.push(`  ${f.name.name}: unknown;`); }
    typeLines.push('}');
  }
}
writeFileSync(join(workDir, 'src', 'types.ts'), typeLines.join('\n'));

// Write test-runtime-mock
const entityNames = domain.entities.map(e => e.name.name);
const mockContent = `
export function createTestInput() { return {}; }
export function createInvalidInput() { return {}; }
export function createTestContext(opts) {
  const names = (opts && opts.entities) ? opts.entities : ${JSON.stringify(entityNames)};
  const map = {};
  for (const n of names) map[n] = {};
  return { entities: map, reset() {}, captureState() { return {}; } };
}
`.trim();
writeFileSync(join(workDir, 'test-runtime-mock.ts'), mockContent);

// Generate and write test files
const generatedFiles = generate(domain, { framework: 'vitest', outputDir: '.', includeHelpers: true, includeChaosTests: false });
for (const file of generatedFiles) {
  const relPath = file.path ?? '';
  if (!relPath || relPath.endsWith('.scenarios.test.ts')) continue;
  if (relPath.endsWith('vitest.config.ts') || relPath.endsWith('vitest.config.js')) continue;
  let content = file.content;
  // patchTestImports
  content = content.replace(/from '\.\.\/src\//g, "from './src/");
  content = content.replace(/from '@isl-lang\/test-runtime'/g, "from './test-runtime-mock'");
  // patchBehaviorImports
  for (const b of domain.behaviors) {
    const bName = b.name.name;
    const funcName = bName.charAt(0).toLowerCase() + bName.slice(1);
    content = content.replace(new RegExp(`from '\\.\\.?\\/src\\/${bName}'`, 'g'), `from './src/${domainName}.impl'`);
    content = content.replace(new RegExp(`from '\\.\\/${bName}'`, 'g'), `from './src/${domainName}.impl'`);
    content = content.replace(new RegExp(`import \\{ ${bName} \\}`, 'g'), `import { ${funcName} as ${bName} }`);
  }
  const filePath = join(workDir, relPath);
  const sepIdx = Math.max(relPath.lastIndexOf('/'), relPath.lastIndexOf('\\'));
  const dir = sepIdx >= 0 ? join(workDir, relPath.substring(0, sepIdx)) : workDir;
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content);
}

// Write package.json
writeFileSync(join(workDir, 'package.json'), JSON.stringify({
  name: 'isl-verify-debug', type: 'module',
  scripts: { test: 'vitest run --reporter=json' }
}, null, 2));

// Write vitest.config.mjs — plain object, no imports (avoids package resolution issue)
writeFileSync(join(workDir, 'vitest.config.mjs'), `export default {
  test: { globals: true, testTimeout: 15000, include: ['**/*.test.ts'], reporters: ['json'] }
};`);

// Write tsconfig
writeFileSync(join(workDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler',
    esModuleInterop: true, strict: false, skipLibCheck: true }
}, null, 2));

console.log('\nWorkDir:', workDir);
console.log('Files written:');
for (const f of generatedFiles) {
  if (!(f.path ?? '').endsWith('.scenarios.test.ts')) console.log(' -', f.path);
}

// Run vitest
console.log('\nRunning vitest...');
const result = spawnSync('npx.cmd', ['vitest', 'run', '--reporter=json'], {
  cwd: workDir, shell: true, timeout: 60000,
  encoding: 'utf-8'
});
console.log('\n--- stdout ---');
console.log(result.stdout?.slice(0, 3000) || '(empty)');
console.log('\n--- stderr ---');
console.log(result.stderr?.slice(0, 1000) || '(empty)');
console.log('\n--- exit code:', result.status, '---');
