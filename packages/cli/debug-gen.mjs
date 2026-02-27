// Debug script — run with: node debug-gen.mjs
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const { parse } = require('../parser/dist/index.cjs');
const { generate } = require('../codegen-tests/dist/index.cjs');

const spec = readFileSync('../../shipgate-ci-toolkit/examples/demo-repo/specs/user-service.isl', 'utf-8');
const r = parse(spec, 'spec.isl');
const files = generate(r.domain, { framework: 'vitest', outputDir: '.', includeHelpers: true, includeChaosTests: false });

for (const f of files) {
  console.log(`\n=== ${f.path} (${f.content.length} bytes) ===`);
  // Apply patchTestImports
  let content = f.content;
  content = content.replace(/from '\.\.\/src\//g, "from './src/");
  content = content.replace(/from '@isl-lang\/test-runtime'/g, "from './test-runtime-mock'");
  // Apply patchBehaviorImports for RegisterUser
  content = content.replace(/from '\.\.?\/src\/RegisterUser'/g, "from './src/userservice.impl'");
  content = content.replace(/from '\.\/RegisterUser'/g, "from './src/userservice.impl'");
  content = content.replace(/import \{ RegisterUser \}/g, "import { registerUser as RegisterUser }");
  // Apply patchBehaviorImports for GetUser
  content = content.replace(/from '\.\.?\/src\/GetUser'/g, "from './src/userservice.impl'");
  content = content.replace(/from '\.\/GetUser'/g, "from './src/userservice.impl'");
  content = content.replace(/import \{ GetUser \}/g, "import { getUser as GetUser }");
  
  if (f.path.endsWith('.test.ts')) {
    console.log(content.slice(0, 3000));
  }
}
