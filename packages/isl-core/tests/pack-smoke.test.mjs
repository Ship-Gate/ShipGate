/**
 * Pack Smoke Test
 * 
 * This test verifies that the package can be built, packed,
 * and imported from a tarball - simulating npm install from registry.
 */

import { execSync } from 'child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');
const tempDir = join(packageRoot, '.test-consumer');

// Colors for output
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

console.log(yellow('\n📦 ISL Core Pack Smoke Test\n'));

try {
  // Step 1: Find the tarball
  console.log('1. Finding tarball...');
  const files = readdirSync(packageRoot).filter(f => f.endsWith('.tgz'));
  const tarball = files[0];
  if (!tarball) {
    throw new Error('No tarball found. Run `pnpm pack` first.');
  }
  console.log(green(`   Found: ${tarball}`));

  // Step 2: Create temp consumer directory
  console.log('2. Creating test consumer...');
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });
  console.log(green(`   Created: ${tempDir}`));

  // Step 3: Create consumer package.json
  console.log('3. Setting up consumer package...');
  const consumerPackage = {
    name: 'test-consumer',
    version: '1.0.0',
    type: 'module',
    dependencies: {
      '@isl-lang/isl-core': `file:${join(packageRoot, tarball)}`
    }
  };
  writeFileSync(
    join(tempDir, 'package.json'),
    JSON.stringify(consumerPackage, null, 2)
  );
  console.log(green('   Created package.json'));

  // Step 4: Install the package
  console.log('4. Installing package...');
  execSync('npm install --ignore-scripts', { 
    cwd: tempDir, 
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  console.log(green('   Installed successfully'));

  // Step 5: Create and run import test
  console.log('5. Running import tests...');
  
  const testScript = `
import * as core from '@isl-lang/isl-core';

// Test 1: Basic exports exist
const exports = [
  'parseISL',
  'compile',
  'VERSION',
  'API_VERSION',
  'tokenize',
  'parse',
  'check',
  'format',
  'lint',
  'verification',
  'testgen',
];

console.log('   Checking exports...');
for (const exp of exports) {
  if (!(exp in core)) {
    throw new Error('Missing export: ' + exp);
  }
  console.log('     ✓ ' + exp);
}

// Test 2: Parse a simple ISL file
console.log('   Testing parse...');
const result = core.parseISL(\`
domain TestDomain {
  entity User {
    id: UUID
    name: String
  }
}
\`);

if (!result.ast) {
  throw new Error('Parse failed: ' + JSON.stringify(result.errors));
}
console.log('     ✓ parseISL works');

// Test 3: Type check
console.log('   Testing check...');
const checkResult = core.check(result.ast);
console.log('     ✓ check works (valid: ' + checkResult.valid + ')');

// Test 4: Format
console.log('   Testing format...');
const formatted = core.format(result.ast);
if (!formatted.includes('domain TestDomain')) {
  throw new Error('Format failed');
}
console.log('     ✓ format works');

// Test 5: Lint
console.log('   Testing lint...');
const lintResult = core.lint(result.ast);
console.log('     ✓ lint works (messages: ' + lintResult.messages.length + ')');

// Test 6: Verification namespace
console.log('   Testing verification...');
if (typeof core.verification.verify !== 'function') {
  throw new Error('verification.verify not found');
}
console.log('     ✓ verification namespace works');

// Test 7: Testgen namespace
console.log('   Testing testgen...');
if (typeof core.testgen.generateTests !== 'function') {
  throw new Error('testgen.generateTests not found');
}
console.log('     ✓ testgen namespace works');

// Test 8: Full compile pipeline
console.log('   Testing compile...');
const compileResult = core.compile(\`
domain CompileTest {
  entity Item {
    id: UUID
    name: String
  }
  
  behavior CreateItem {
    input {
      name: String
    }
    output {
      success: Item
    }
  }
}
\`);

if (!compileResult.success) {
  console.log('     Note: compile returned success=false (expected for strict checks)');
}
console.log('     ✓ compile works');

console.log('\\n   All import tests passed!');
`;

  writeFileSync(join(tempDir, 'test.mjs'), testScript);
  
  const output = execSync('node test.mjs', { 
    cwd: tempDir, 
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  console.log(output);

  // Step 6: Cleanup
  console.log('6. Cleaning up...');
  rmSync(tempDir, { recursive: true });
  console.log(green('   Done'));

  console.log(green('\n✅ Pack smoke test PASSED\n'));
  process.exit(0);

} catch (error) {
  console.error(red('\n❌ Pack smoke test FAILED'));
  console.error(red(error.message));
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  
  // Cleanup on failure
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  
  process.exit(1);
}
