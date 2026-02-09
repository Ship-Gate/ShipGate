/**
 * Example usage of env-reality-checker
 * 
 * Run with: tsx src/example.ts
 */

import { checkEnvReality, formatReport } from './index.js';

async function main() {
  console.log('🔍 Checking environment variable reality...\n');

  const result = await checkEnvReality({
    projectRoot: process.cwd(),
    sourcePatterns: ['**/*.{ts,tsx,js,jsx}'],
    envFilePatterns: ['.env*'],
    schemaPatterns: ['**/*schema*.ts', '**/config/**/*.ts'],
    k8sPatterns: ['**/*.{yaml,yml}'],
    dockerfilePatterns: ['**/Dockerfile*'],
    includeNodeModules: false,
  });

  // Print report
  console.log(formatReport(result));

  // Exit with error code if there are critical issues
  const errors = result.claims.filter(c => c.severity === 'error');
  if (errors.length > 0) {
    console.error(`\n❌ Found ${errors.length} critical issues`);
    process.exit(1);
  } else if (result.claims.length > 0) {
    console.log(`\n⚠️  Found ${result.claims.length} issues (non-critical)`);
    process.exit(0);
  } else {
    console.log('\n✅ No issues found!');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
