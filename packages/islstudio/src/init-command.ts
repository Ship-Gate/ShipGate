/**
 * ISL Studio - Init Command
 * 
 * npx islstudio init
 * 
 * Creates:
 *   - .islstudio/config.json
 *   - Optional baseline
 *   - GitHub workflow YAML
 *   - Optional intent file
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { templates, detectFramework, getTemplate } from './templates/index.js';

export interface InitOptions {
  preset?: string;
  baseline?: boolean;
  yes?: boolean;
  framework?: string;
}

const WORKFLOW_YAML = `# .github/workflows/isl-gate.yml
name: ISL Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ISL-Studio/islstudio-gate-action@v1
        with:
          mode: enforce        # 'enforce' blocks PRs, 'warn' just comments
          upload-sarif: true   # Upload to GitHub Security tab
`;

const CONFIG_TEMPLATE = {
  'startup-default': {
    preset: 'startup-default',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: false },
      'rate-limit': { enabled: true },
    },
    threshold: 70,
  },
  'strict-security': {
    preset: 'strict-security',
    packs: {
      auth: { enabled: true },
      pii: { enabled: true },
      payments: { enabled: true },
      'rate-limit': { enabled: true },
    },
    threshold: 90,
  },
  minimal: {
    preset: 'minimal',
    packs: {
      auth: { enabled: true },
      pii: { enabled: false },
      payments: { enabled: false },
      'rate-limit': { enabled: false },
    },
    threshold: 50,
  },
};

export async function runInitCommand(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const configDir = path.join(cwd, '.islstudio');
  const configPath = path.join(configDir, 'config.json');
  const workflowDir = path.join(cwd, '.github', 'workflows');
  const workflowPath = path.join(workflowDir, 'isl-gate.yml');

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              ISL Studio - Quick Setup                     ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Check if already initialized
  try {
    await fs.access(configPath);
    console.log('⚠️  Already initialized (.islstudio/config.json exists)\n');
    console.log('To reconfigure, delete .islstudio/ and run again.\n');
    return;
  } catch {
    // Not initialized, continue
  }

  // Detect framework from package.json
  let detectedFramework: string | null = null;
  try {
    const pkgJson = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf-8'));
    detectedFramework = detectFramework(pkgJson);
  } catch {
    // No package.json
  }

  // Parse options
  const options: InitOptions = {
    preset: 'startup-default',
    baseline: false,
    yes: args.includes('-y') || args.includes('--yes'),
    framework: detectedFramework || undefined,
  };

  // Get options from args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preset' && args[i + 1]) {
      options.preset = args[i + 1];
    }
    if (args[i] === '--baseline') {
      options.baseline = true;
    }
    if (args[i] === '--framework' && args[i + 1]) {
      options.framework = args[i + 1];
    }
  }

  // Interactive mode if not --yes
  if (!options.yes) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (q: string): Promise<string> =>
      new Promise(resolve => rl.question(q, resolve));

    // Framework selection
    if (detectedFramework) {
      console.log(`📦 Detected framework: ${detectedFramework}\n`);
    } else {
      console.log('Select your framework:\n');
      console.log('  1) nextjs   - Next.js with API routes');
      console.log('  2) express  - Express.js REST API');
      console.log('  3) fastify  - Fastify REST API');
      console.log('  4) nestjs   - NestJS enterprise API');
      console.log('  5) hono     - Hono edge API');
      console.log('  6) generic  - Generic TypeScript\n');

      const fwChoice = await ask('Select framework [1]: ');
      const fwMap: Record<string, string> = {
        '1': 'nextjs', '2': 'express', '3': 'fastify',
        '4': 'nestjs', '5': 'hono', '6': 'generic',
      };
      options.framework = fwMap[fwChoice] || 'nextjs';
    }

    // Preset selection
    console.log('\nChoose a preset:\n');
    console.log('  1) startup-default  - Auth + PII + Rate-limit (recommended)');
    console.log('  2) strict-security  - All packs enabled, 90% threshold');
    console.log('  3) minimal          - Auth only, 50% threshold\n');

    const choice = await ask('Select preset [1]: ');
    if (choice === '2') options.preset = 'strict-security';
    else if (choice === '3') options.preset = 'minimal';
    else options.preset = 'startup-default';

    const createBaseline = await ask('\nCreate baseline for existing violations? [y/N]: ');
    options.baseline = createBaseline.toLowerCase() === 'y';

    rl.close();
  }

  // Get template for framework
  const template = options.framework ? getTemplate(options.framework) : null;

  // Create config directory
  await fs.mkdir(configDir, { recursive: true });

  // Write config (use template config if available)
  const config = template?.config || CONFIG_TEMPLATE[options.preset as keyof typeof CONFIG_TEMPLATE] || CONFIG_TEMPLATE['startup-default'];
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  console.log(`\n✅ Created .islstudio/config.json (${options.framework || options.preset})`);

  // Create baseline if requested
  if (options.baseline) {
    console.log('\n📊 Creating baseline...');
    // Import dynamically to avoid circular deps
    const { runGate } = await import('./gate.js');
    const { loadConfig } = await import('./config.js');
    const { saveBaseline } = await import('./baseline.js');
    
    const loadedConfig = await loadConfig(cwd);
    const files = await findSourceFiles(cwd);
    const result = await runGate(files, loadedConfig);
    
    const baselinePath = path.join(configDir, 'baseline.json');
    await saveBaseline(baselinePath, result.violations);
    console.log(`✅ Created baseline with ${result.violations.length} entries`);
  }

  // Check for existing workflow
  let workflowExists = false;
  try {
    await fs.access(workflowPath);
    workflowExists = true;
  } catch {
    // Doesn't exist
  }

  if (!workflowExists) {
    await fs.mkdir(workflowDir, { recursive: true });
    const workflowContent = template?.workflow || WORKFLOW_YAML;
    await fs.writeFile(workflowPath, workflowContent);
    console.log(`✅ Created .github/workflows/isl-gate.yml (${options.framework || 'generic'})`);
  } else {
    console.log('⚠️  Workflow already exists at .github/workflows/isl-gate.yml');
  }

  // Create intent file if template has one
  if (template?.intentFile) {
    const intentPath = path.join(configDir, 'intent.md');
    await fs.writeFile(intentPath, template.intentFile);
    console.log('✅ Created .islstudio/intent.md (intent declarations)');
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Setup complete!

Next steps:

  1. Commit the new files:
     git add .islstudio .github/workflows/isl-gate.yml
     git commit -m "Add ISL Studio gate"

  2. Open a PR to see it in action

  3. Run locally anytime:
     npx islstudio gate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

async function findSourceFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  const srcDir = path.join(cwd, 'src');
  
  try {
    await collectFiles(srcDir, files);
  } catch {
    // No src directory, try root
    await collectFiles(cwd, files);
  }
  
  return files.slice(0, 100); // Limit for init
}

async function collectFiles(dir: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        await collectFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
}
