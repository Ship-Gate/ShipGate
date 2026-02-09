/**
 * Domain Pack Commands
 * 
 * Commands for creating, validating, and publishing domain packs.
 * Domain packs are distributable ISL domain specifications.
 */

import { writeFile, mkdir, readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { check } from './check.js';
import { verify } from './verify.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainPackManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
  domain: {
    name: string;
    version: string;
    specs: string[];
    dependencies?: Record<string, string>;
  };
  files?: string[];
  publish?: {
    registry?: string;
    access?: 'public' | 'private';
  };
}

export interface DomainInitOptions {
  /** Pack name */
  name?: string;
  /** Target directory (defaults to current directory) */
  directory?: string;
  /** Force overwrite existing files */
  force?: boolean;
  /** Include example spec */
  examples?: boolean;
}

export interface DomainInitResult {
  success: boolean;
  packPath: string;
  files: string[];
  errors: string[];
}

export interface DomainValidateOptions {
  /** Pack directory (defaults to current directory) */
  directory?: string;
  /** Run verification tests */
  test?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface DomainValidateResult {
  success: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
  testResults?: {
    passed: number;
    failed: number;
    total: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

const PACK_JSON_TEMPLATE = `{
  "name": "{{name}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "author": "{{author}}",
  "license": "MIT",
  "keywords": ["isl", "domain-pack", "{{domainName}}"],
  "domain": {
    "name": "{{domainName}}",
    "version": "0.1.0",
    "specs": [
      "specs/*.isl"
    ]
  },
  "files": [
    "specs/**/*.isl",
    "tests/**/*.test.ts",
    "pack.json",
    "README.md"
  ],
  "publish": {
    "registry": "https://registry.shipgate.dev",
    "access": "public"
  }
}
`;

const README_TEMPLATE = `# {{name}}

{{description}}

## Installation

\`\`\`bash
shipgate domain install {{name}}
\`\`\`

## Usage

\`\`\`isl
import {{domainName}} from "{{name}}";

// Use domain types and behaviors
\`\`\`

## Domain Specs

This pack includes the following ISL domain specifications:

{{specList}}

## Testing

Run the pack tests:

\`\`\`bash
shipgate domain validate --test
\`\`\`

## Publishing

Publish this pack to the registry:

\`\`\`bash
shipgate domain publish
\`\`\`
`;

const EXAMPLE_SPEC_TEMPLATE = `/**
 * {{domainName}} Domain
 * 
 * {{description}}
 */

domain {{domainName}} {
  /**
   * Example entity
   */
  entity Example {
    id: ID
    name: String
    createdAt: DateTime
  }

  /**
   * Example behavior
   */
  behavior CreateExample {
    input {
      name: String
    }
    
    output Example
    
    preconditions {
      require input.name.length > 0
    }
    
    postconditions {
      ensure result.id != null
      ensure result.name == input.name
    }
    
    scenario "creates example with valid name" {
      given {
        name: "Test Example"
      }
      then {
        result.name == "Test Example"
        result.id != null
      }
    }
  }
}
`;

const TEST_TEMPLATE = `/**
 * Domain Pack Tests
 * 
 * Unit tests for {{domainName}} domain pack.
 */

import { describe, it, expect } from 'vitest';
import { parse, check } from '@isl-lang/core';

describe('{{domainName}} Domain Pack', () => {
  it('should parse all specs', async () => {
    const specFiles = [
      // Add your spec file paths here
      // 'specs/example.isl'
    ];

    for (const specFile of specFiles) {
      const result = await parse(specFile);
      expect(result.success).toBe(true);
    }
  });

  it('should type-check all specs', async () => {
    const specFiles = [
      // Add your spec file paths here
    ];

    for (const specFile of specFiles) {
      const result = await check([specFile]);
      expect(result.success).toBe(true);
      expect(result.totalErrors).toBe(0);
    }
  });

  it('should verify sample behaviors', async () => {
    // Add verification tests here
    // Example:
    // const result = await verify('specs/example.isl', {
    //   impl: 'tests/fixtures/example.ts'
    // });
    // expect(result.success).toBe(true);
  });
}
`;

const PUBLISH_WORKFLOW_TEMPLATE = `name: Publish Domain Pack

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish'
        required: true
        type: string

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install ShipGate CLI
        run: npm install -g @isl-lang/cli

      - name: Validate Pack
        run: shipgate domain validate --test

      - name: Publish Pack
        run: shipgate domain publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
          SHIPGATE_REGISTRY_TOKEN: \${{ secrets.SHIPGATE_REGISTRY_TOKEN }}
`;

const GITIGNORE_TEMPLATE = `# Dependencies
node_modules/

# Build outputs
dist/
.generated/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Init Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a new domain pack
 */
export async function domainInit(
  options: DomainInitOptions = {}
): Promise<DomainInitResult> {
  const spinner = ora('Initializing domain pack...').start();
  const files: string[] = [];
  const errors: string[] = [];

  try {
    // Determine pack name and directory
    const packName = options.name || basename(process.cwd());
    const packDir = resolve(options.directory || process.cwd());
    const domainName = toPascalCase(packName);
    const kebabName = toKebabCase(packName);

    // Check if directory exists and has content
    if (await stat(packDir).then(() => true).catch(() => false)) {
      const entries = await readdir(packDir);
      if (entries.length > 0 && !options.force) {
        spinner.fail('Directory is not empty');
        return {
          success: false,
          packPath: packDir,
          files: [],
          errors: ['Directory is not empty. Use --force to overwrite.'],
        };
      }
    }

    // Create directory structure
    await mkdir(packDir, { recursive: true });
    await mkdir(join(packDir, 'specs'), { recursive: true });
    await mkdir(join(packDir, 'tests'), { recursive: true });
    spinner.text = 'Creating pack structure...';

    // Create pack.json
    const packJsonPath = join(packDir, 'pack.json');
    const packJsonContent = applyTemplate(PACK_JSON_TEMPLATE, {
      name: kebabName,
      description: `ISL domain pack for ${domainName}`,
      author: 'Your Name',
      domainName,
    });
    await writeFile(packJsonPath, JSON.stringify(JSON.parse(packJsonContent), null, 2));
    files.push(packJsonPath);

    // Create example spec if requested
    if (options.examples !== false) {
      const exampleSpecPath = join(packDir, 'specs', `${kebabName}.isl`);
      const exampleSpecContent = applyTemplate(EXAMPLE_SPEC_TEMPLATE, {
        domainName,
        description: `Domain specification for ${domainName}`,
      });
      await writeFile(exampleSpecPath, exampleSpecContent);
      files.push(exampleSpecPath);
    }

    // Create test file
    const testPath = join(packDir, 'tests', `${kebabName}.test.ts`);
    const testContent = applyTemplate(TEST_TEMPLATE, {
      domainName,
    });
    await writeFile(testPath, testContent);
    files.push(testPath);

    // Create README
    const readmePath = join(packDir, 'README.md');
    const specList = options.examples !== false
      ? `- \`specs/${kebabName}.isl\` - Main domain specification`
      : 'No specs yet. Add ISL files to the `specs/` directory.';
    const readmeContent = applyTemplate(README_TEMPLATE, {
      name: kebabName,
      description: `ISL domain pack for ${domainName}`,
      domainName,
      specList,
    });
    await writeFile(readmePath, readmeContent);
    files.push(readmePath);

    // Create .gitignore
    const gitignorePath = join(packDir, '.gitignore');
    if (!existsSync(gitignorePath)) {
      await writeFile(gitignorePath, GITIGNORE_TEMPLATE);
      files.push(gitignorePath);
    }

    // Create publish workflow
    const workflowDir = join(packDir, '.github', 'workflows');
    await mkdir(workflowDir, { recursive: true });
    const workflowPath = join(workflowDir, 'publish.yml');
    await writeFile(workflowPath, PUBLISH_WORKFLOW_TEMPLATE);
    files.push(workflowPath);

    spinner.succeed(`Domain pack initialized at ${packDir}`);

    return {
      success: true,
      packPath: packDir,
      files,
      errors,
    };
  } catch (err) {
    spinner.fail('Failed to initialize domain pack');
    errors.push(err instanceof Error ? err.message : String(err));
    
    return {
      success: false,
      packPath: options.directory || process.cwd(),
      files,
      errors,
    };
  }
}

/**
 * Print domain init result
 */
export function printDomainInitResult(result: DomainInitResult): void {
  console.log('');

  if (result.success) {
    console.log(chalk.green('✓') + ` Domain pack initialized at ${chalk.cyan(result.packPath)}`);
    console.log('');
    
    output.section('Created files:');
    for (const file of result.files) {
      output.filePath(file, 'created');
    }

    console.log('');
    output.box('Next Steps', [
      `cd ${result.packPath}`,
      'shipgate domain validate',
      'shipgate domain validate --test',
      'shipgate domain publish',
    ], 'info');
  } else {
    console.log(chalk.red('✗') + ' Failed to initialize domain pack');
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Validate Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a domain pack
 */
export async function domainValidate(
  options: DomainValidateOptions = {}
): Promise<DomainValidateResult> {
  const spinner = ora('Validating domain pack...').start();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const packDir = resolve(options.directory || process.cwd());

    // Check pack.json exists
    const packJsonPath = join(packDir, 'pack.json');
    if (!existsSync(packJsonPath)) {
      spinner.fail('pack.json not found');
      return {
        success: false,
        valid: false,
        errors: ['pack.json not found. Run `shipgate domain init` first.'],
        warnings: [],
      };
    }

    // Read and validate pack.json
    spinner.text = 'Reading pack.json...';
    const packJsonContent = await readFile(packJsonPath, 'utf-8');
    let packManifest: DomainPackManifest;
    try {
      packManifest = JSON.parse(packJsonContent);
    } catch (err) {
      spinner.fail('Invalid pack.json');
      return {
        success: false,
        valid: false,
        errors: [`Invalid pack.json: ${err instanceof Error ? err.message : String(err)}`],
        warnings: [],
      };
    }

    // Validate manifest structure
    if (!packManifest.name) {
      errors.push('pack.json: missing "name" field');
    }
    if (!packManifest.version) {
      errors.push('pack.json: missing "version" field');
    }
    if (!packManifest.domain) {
      errors.push('pack.json: missing "domain" field');
    } else {
      if (!packManifest.domain.name) {
        errors.push('pack.json: missing "domain.name" field');
      }
      if (!packManifest.domain.specs || !Array.isArray(packManifest.domain.specs)) {
        errors.push('pack.json: missing or invalid "domain.specs" field');
      }
    }

    // Check specs directory exists
    const specsDir = join(packDir, 'specs');
    if (!existsSync(specsDir)) {
      errors.push('specs/ directory not found');
    } else {
      // Validate all spec files
      spinner.text = 'Validating ISL specs...';
      const specPatterns = packManifest.domain.specs || ['specs/**/*.isl'];
      const specFiles: string[] = [];

      for (const pattern of specPatterns) {
        const matches = await glob(pattern, { cwd: packDir });
        specFiles.push(...matches.map(f => join(packDir, f)));
      }

      if (specFiles.length === 0) {
        warnings.push('No ISL spec files found');
      } else {
        // Check each spec file
        for (const specFile of specFiles) {
          if (!existsSync(specFile)) {
            errors.push(`Spec file not found: ${specFile}`);
            continue;
          }

          // Parse and check spec
          try {
            const checkResult = await check([specFile]);
            if (!checkResult.success || checkResult.totalErrors > 0) {
              errors.push(`${specFile}: ${checkResult.totalErrors} error(s)`);
              if (options.verbose) {
                for (const file of checkResult.files) {
                  for (const error of file.errors) {
                    errors.push(`  ${error.message} (${error.line}:${error.column})`);
                  }
                }
              }
            }
          } catch (err) {
            errors.push(`${specFile}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    // Run tests if requested
    let testResults: DomainValidateResult['testResults'] | undefined;
    if (options.test) {
      spinner.text = 'Running tests...';
      const testsDir = join(packDir, 'tests');
      if (existsSync(testsDir)) {
        const testFiles = await glob('**/*.test.ts', { cwd: testsDir });
        if (testFiles.length > 0) {
          // Note: In a real implementation, we'd run the tests
          // For now, we'll just check they exist
          testResults = {
            passed: 0,
            failed: 0,
            total: testFiles.length,
          };
          warnings.push('Test execution not yet implemented. Tests found but not run.');
        } else {
          warnings.push('No test files found in tests/ directory');
        }
      } else {
        warnings.push('tests/ directory not found');
      }
    }

    const valid = errors.length === 0;
    if (valid) {
      spinner.succeed('Domain pack is valid');
    } else {
      spinner.fail('Domain pack validation failed');
    }

    return {
      success: true,
      valid,
      errors,
      warnings,
      testResults,
    };
  } catch (err) {
    spinner.fail('Validation failed');
    return {
      success: false,
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings: [],
    };
  }
}

/**
 * Print domain validate result
 */
export function printDomainValidateResult(
  result: DomainValidateResult,
  options: { verbose?: boolean } = {}
): void {
  console.log('');

  if (result.valid) {
    console.log(chalk.green('✓') + ' Domain pack is valid');
  } else {
    console.log(chalk.red('✗') + ' Domain pack validation failed');
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  • ${error}`));
    }
  }

  if (result.warnings.length > 0) {
    console.log('');
    console.log(chalk.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  • ${warning}`));
    }
  }

  if (result.testResults) {
    console.log('');
    console.log(chalk.bold('Test Results:'));
    console.log(chalk.gray(`  Total: ${result.testResults.total}`));
    console.log(chalk.green(`  Passed: ${result.testResults.passed}`));
    if (result.testResults.failed > 0) {
      console.log(chalk.red(`  Failed: ${result.testResults.failed}`));
    }
  }
}

/**
 * Get exit code for domain validate result
 */
export function getDomainValidateExitCode(result: DomainValidateResult): ExitCode {
  if (!result.success || !result.valid) {
    return ExitCode.ISL_ERROR;
  }
  return ExitCode.SUCCESS;
}
