#!/usr/bin/env node

import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const HELP = `
create-shipgate-check — Scaffold a new ShipGate SpeclessCheck plugin

Usage:
  create-shipgate-check <check-name>

Examples:
  create-shipgate-check no-console
  create-shipgate-check license-audit
  create-shipgate-check api-versioning

Options:
  --help, -h    Show this help message
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP.trim());
    process.exit(args.length === 0 ? 1 : 0);
  }

  const rawName = args[0];
  const checkName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!checkName) {
    console.error('Error: Invalid check name. Use alphanumeric characters and hyphens.');
    process.exit(1);
  }

  const packageName = `shipgate-check-${checkName}`;
  const camelName = checkName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const checkVarName = `${camelName}Check`;
  const dir = resolve(process.cwd(), packageName);

  console.log(`\nScaffolding ${packageName}...\n`);

  await mkdir(join(dir, 'src'), { recursive: true });
  await mkdir(join(dir, 'tests'), { recursive: true });

  await writeFile(join(dir, 'package.json'), generatePackageJson(packageName));
  await writeFile(join(dir, 'tsconfig.json'), generateTsConfig());
  await writeFile(join(dir, 'src', 'index.ts'), generateCheckImpl(checkName, checkVarName));
  await writeFile(join(dir, 'src', 'adapter.ts'), generateAdapter(checkVarName));
  await writeFile(join(dir, 'tests', 'check.test.ts'), generateTest(checkName, checkVarName));
  await writeFile(join(dir, 'README.md'), generateReadme(packageName, checkName));

  console.log(`  Created ${packageName}/`);
  console.log(`  ├── package.json`);
  console.log(`  ├── tsconfig.json`);
  console.log(`  ├── README.md`);
  console.log(`  ├── src/`);
  console.log(`  │   ├── index.ts`);
  console.log(`  │   └── adapter.ts`);
  console.log(`  └── tests/`);
  console.log(`      └── check.test.ts`);
  console.log();
  console.log(`Next steps:`);
  console.log(`  cd ${packageName}`);
  console.log(`  npm install`);
  console.log(`  # Edit src/index.ts with your check logic`);
  console.log(`  npm test`);
  console.log();
}

function generatePackageJson(name: string): string {
  const pkg = {
    name,
    version: '0.1.0',
    description: `ShipGate SpeclessCheck plugin: ${name}`,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        import: './dist/index.js',
        types: './dist/index.d.ts',
      },
      './adapter': {
        import: './dist/adapter.js',
        types: './dist/adapter.d.ts',
      },
    },
    files: ['dist'],
    scripts: {
      build: 'tsup src/index.ts src/adapter.ts --format esm --dts --clean',
      test: 'vitest run',
      'test:watch': 'vitest',
      typecheck: 'tsc --noEmit',
    },
    keywords: ['shipgate', 'shipgate-check', 'isl', 'specless'],
    peerDependencies: {
      '@isl-lang/gate': '>=1.0.0',
    },
    peerDependenciesMeta: {
      '@isl-lang/gate': { optional: false },
    },
    devDependencies: {
      '@isl-lang/gate': 'workspace:*',
      '@types/node': '^20.10.0',
      tsup: '^8.0.1',
      typescript: '^5.3.3',
      vitest: '^1.2.0',
    },
    license: 'MIT',
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  };
  return JSON.stringify(config, null, 2) + '\n';
}

function generateCheckImpl(checkName: string, varName: string): string {
  return `import type { GateEvidence } from '@isl-lang/gate/authoritative/verdict-engine';
import type { SpeclessCheck, GateContext } from '@isl-lang/gate/authoritative/specless-registry';

function isSupportedFile(file: string): boolean {
  return /\\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.toLowerCase());
}

export const ${varName}: SpeclessCheck = {
  name: '${checkName}',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isSupportedFile(file)) {
      return [];
    }

    // TODO: Implement your check logic here.
    //
    // Scan \`context.implementation\` for patterns and return evidence.
    //
    // Return 'pass' when the file is clean:
    //   { source: 'specless-scanner', check: '${checkName}: clean', result: 'pass', confidence: 0.85, details: '...' }
    //
    // Return 'fail' with a critical prefix to force NO_SHIP:
    //   { source: 'specless-scanner', check: 'security_violation: ...', result: 'fail', confidence: 0.90, details: '...' }
    //
    // Return 'warn' for non-blocking issues:
    //   { source: 'specless-scanner', check: '${checkName}: ...', result: 'warn', confidence: 0.70, details: '...' }

    return [{
      source: 'specless-scanner',
      check: '${checkName}: clean',
      result: 'pass',
      confidence: 0.85,
      details: \`No issues found in \${file}\`,
    }];
  },
};

export type { SpeclessCheck, GateContext, GateEvidence };
`;
}

function generateAdapter(varName: string): string {
  return `import { registerSpeclessCheck } from '@isl-lang/gate/authoritative/specless-registry';
import { ${varName} } from './index.js';

registerSpeclessCheck(${varName});
`;
}

function generateTest(checkName: string, varName: string): string {
  return `import { describe, it, expect } from 'vitest';
import { ${varName} } from '../src/index.js';
import type { GateContext } from '../src/index.js';

function makeContext(impl: string): GateContext {
  return { projectRoot: '/tmp/test', implementation: impl, specOptional: true };
}

describe('${checkName}', () => {
  it('returns pass for clean files', async () => {
    const evidence = await ${varName}.run(
      'src/service.ts',
      makeContext('export function add(a: number, b: number) { return a + b; }'),
    );
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].result).toBe('pass');
  });

  it('skips unsupported file types', async () => {
    const evidence = await ${varName}.run(
      'data/config.yaml',
      makeContext('key: value'),
    );
    expect(evidence).toHaveLength(0);
  });

  it('has correct check name', () => {
    expect(${varName}.name).toBe('${checkName}');
  });

  it('returns valid GateEvidence shape', async () => {
    const evidence = await ${varName}.run('src/app.ts', makeContext('const x = 1;'));
    for (const e of evidence) {
      expect(e.source).toBe('specless-scanner');
      expect(['pass', 'fail', 'warn', 'skip']).toContain(e.result);
      expect(e.confidence).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeLessThanOrEqual(1);
      expect(typeof e.check).toBe('string');
      expect(typeof e.details).toBe('string');
    }
  });
});
`;
}

function generateReadme(packageName: string, checkName: string): string {
  return `# ${packageName}

A [ShipGate](https://github.com/mevla/ShipGate) SpeclessCheck plugin.

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Usage

Import the adapter to auto-register the check with the gate pipeline:

\`\`\`typescript
import '${packageName}/adapter';
\`\`\`

The check runs automatically on every \`shipgate gate\` invocation in specless mode.

## What it checks

<!-- Describe what your check detects -->

This check scans TypeScript and JavaScript files for:

- TODO: Describe your detection targets

## Development

\`\`\`bash
npm install
npm test
npm run build
\`\`\`

## Configuration

This check follows the [ShipGate Plugin Guide](https://github.com/mevla/ShipGate/blob/main/docs/PLUGIN_GUIDE.md).

## License

MIT
`;
}

main().catch((err: unknown) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
