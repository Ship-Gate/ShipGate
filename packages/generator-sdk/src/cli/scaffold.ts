/**
 * Scaffold Command
 *
 * Creates a new ISL generator project from templates.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for scaffolding a new generator.
 */
export interface ScaffoldOptions {
  /** Generator name (e.g., 'my-generator') */
  name: string;
  /** Output directory */
  outputDir: string;
  /** Target language for generated code */
  targetLanguage?: string;
  /** Generator description */
  description?: string;
  /** Include example templates */
  includeExamples?: boolean;
  /** Package manager to use */
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

/**
 * Result of scaffolding.
 */
export interface ScaffoldResult {
  /** Directory created */
  outputDir: string;
  /** Files created */
  files: string[];
}

// ============================================================================
// Scaffold Function
// ============================================================================

/**
 * Scaffold a new ISL generator project.
 */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const {
    name,
    outputDir,
    targetLanguage = 'typescript',
    description = `ISL code generator for ${targetLanguage}`,
    includeExamples = true,
    packageManager = 'npm',
  } = options;

  // Normalize name
  const kebabName = toKebabCase(name);
  const pascalName = toPascalCase(name);
  const projectDir = join(outputDir, kebabName);

  const files: string[] = [];

  // Create directories
  await mkdir(join(projectDir, 'src'), { recursive: true });
  await mkdir(join(projectDir, 'templates'), { recursive: true });
  await mkdir(join(projectDir, 'tests'), { recursive: true });

  // Create package.json
  const packageJson = createPackageJson(kebabName, description, packageManager);
  await writeFile(join(projectDir, 'package.json'), packageJson);
  files.push('package.json');

  // Create tsconfig.json
  const tsconfig = createTsConfig();
  await writeFile(join(projectDir, 'tsconfig.json'), tsconfig);
  files.push('tsconfig.json');

  // Create main generator file
  const generatorContent = createGeneratorFile(pascalName, targetLanguage);
  await writeFile(join(projectDir, 'src', 'generator.ts'), generatorContent);
  files.push('src/generator.ts');

  // Create index.ts
  const indexContent = createIndexFile(pascalName);
  await writeFile(join(projectDir, 'src', 'index.ts'), indexContent);
  files.push('src/index.ts');

  // Create example templates
  if (includeExamples) {
    const entityTemplate = createEntityTemplate(targetLanguage);
    await writeFile(join(projectDir, 'templates', 'entity.hbs'), entityTemplate);
    files.push('templates/entity.hbs');

    const behaviorTemplate = createBehaviorTemplate(targetLanguage);
    await writeFile(join(projectDir, 'templates', 'behavior.hbs'), behaviorTemplate);
    files.push('templates/behavior.hbs');

    const indexTemplate = createIndexTemplate(targetLanguage);
    await writeFile(join(projectDir, 'templates', 'index.hbs'), indexTemplate);
    files.push('templates/index.hbs');
  }

  // Create test file
  const testContent = createTestFile(pascalName);
  await writeFile(join(projectDir, 'tests', 'generator.test.ts'), testContent);
  files.push('tests/generator.test.ts');

  // Create README
  const readme = createReadme(kebabName, description, targetLanguage);
  await writeFile(join(projectDir, 'README.md'), readme);
  files.push('README.md');

  // Create .gitignore
  const gitignore = createGitignore();
  await writeFile(join(projectDir, '.gitignore'), gitignore);
  files.push('.gitignore');

  return {
    outputDir: projectDir,
    files,
  };
}

// ============================================================================
// File Content Generators
// ============================================================================

function createPackageJson(
  name: string,
  description: string,
  packageManager: string
): string {
  const lockfile =
    packageManager === 'yarn' ? 'yarn.lock' : packageManager === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json';

  return JSON.stringify(
    {
      name: `@isl/${name}`,
      version: '1.0.0',
      description,
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
        test: 'vitest',
        lint: 'eslint src --ext .ts',
        clean: 'rimraf dist',
      },
      keywords: ['isl', 'intentos', 'generator', 'codegen'],
      license: 'MIT',
      dependencies: {
        '@isl-lang/generator-sdk': 'workspace:*',
        '@isl-lang/isl-core': 'workspace:*',
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        typescript: '^5.3.3',
        vitest: '^1.2.0',
        rimraf: '^5.0.5',
      },
      files: ['dist', 'templates'],
    },
    null,
    2
  );
}

function createTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests'],
    },
    null,
    2
  );
}

function createGeneratorFile(className: string, targetLanguage: string): string {
  return `/**
 * ${className} Generator
 *
 * Custom ISL code generator for ${targetLanguage}.
 */

import {
  Generator,
  type GeneratedFile,
  type DomainDeclaration,
  type EntityDeclaration,
  type BehaviorDeclaration,
  type TypeDeclaration,
  type EnumDeclaration,
} from '@isl-lang/generator-sdk';

// ============================================================================
// Generator Implementation
// ============================================================================

/**
 * ${className} - Generates ${targetLanguage} code from ISL specifications.
 *
 * @example
 * \`\`\`typescript
 * const generator = new ${className}();
 * const result = await generator.generate(domain, {
 *   outputDir: './generated',
 * });
 * \`\`\`
 */
export class ${className} extends Generator {
  readonly name = '${toKebabCase(className)}';
  version = '1.0.0';
  description = 'Generates ${targetLanguage} code from ISL specifications';
  targetLanguages = ['${targetLanguage}'];
  defaultExtension = '${getExtension(targetLanguage)}';

  /**
   * Custom template helpers.
   */
  protected helpers = {
    customFormat: (s: string) => s.toUpperCase(),
  };

  // ==========================================================================
  // Domain-Level Generation
  // ==========================================================================

  protected visitDomain(domain: DomainDeclaration): GeneratedFile[] {
    return [{
      path: 'index${getExtension(targetLanguage)}',
      content: this.template('index', { domain }),
    }];
  }

  // ==========================================================================
  // Entity Generation
  // ==========================================================================

  protected visitEntity(entity: EntityDeclaration): GeneratedFile[] {
    return [{
      path: \`entities/\${this.toKebabCase(entity.name.name)}${getExtension(targetLanguage)}\`,
      content: this.template('entity', { entity }),
    }];
  }

  // ==========================================================================
  // Behavior Generation
  // ==========================================================================

  protected visitBehavior(behavior: BehaviorDeclaration): GeneratedFile[] {
    return [{
      path: \`behaviors/\${this.toKebabCase(behavior.name.name)}${getExtension(targetLanguage)}\`,
      content: this.template('behavior', { behavior }),
    }];
  }

  // ==========================================================================
  // Type Generation (Optional)
  // ==========================================================================

  protected visitType(type: TypeDeclaration): GeneratedFile[] | null {
    // Override to generate type-specific files
    return null;
  }

  protected visitEnum(enumDecl: EnumDeclaration): GeneratedFile[] | null {
    // Override to generate enum-specific files
    return null;
  }

  // ==========================================================================
  // Lifecycle Hooks
  // ==========================================================================

  protected finalize(domain: DomainDeclaration): GeneratedFile[] {
    // Generate any final files (e.g., manifest)
    return [];
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }
}
`;
}

function createIndexFile(className: string): string {
  return `/**
 * ${className} Generator
 *
 * Main entry point for the generator package.
 */

export { ${className} } from './generator.js';

// Re-export types from SDK for convenience
export type {
  GeneratedFile,
  GenerationResult,
  GeneratorOptions,
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
} from '@isl-lang/generator-sdk';
`;
}

function createEntityTemplate(targetLanguage: string): string {
  if (targetLanguage === 'python') {
    return `"""
Entity: {{entity.name.name}}
Generated from ISL specification.
"""

from dataclasses import dataclass
from typing import Optional
from datetime import datetime

@dataclass
class {{entity.name.name}}:
    """{{entity.name.name}} entity."""
    {{#each entity.fields}}
    {{snakeCase name.name}}: {{typeToPython type}}{{#if optional}} = None{{/if}}
    {{/each}}
`;
  }

  if (targetLanguage === 'go') {
    return `// Package generated contains ISL-generated types.
package generated

// {{entity.name.name}} represents the {{entity.name.name}} entity.
type {{entity.name.name}} struct {
{{#each entity.fields}}
\t{{pascalCase name.name}} {{typeToGo type}} \`json:"{{camelCase name.name}}{{#if optional}},omitempty{{/if}}"\`
{{/each}}
}
`;
  }

  // Default: TypeScript
  return `/**
 * Entity: {{entity.name.name}}
 * Generated from ISL specification.
 */

export interface {{entity.name.name}} {
{{#each entity.fields}}
  {{#if (hasAnnotation this 'immutable')}}readonly {{/if}}{{name.name}}{{#if optional}}?{{/if}}: {{typeToTS type}};
{{/each}}
}

/**
 * Create input for {{entity.name.name}}.
 */
export interface {{entity.name.name}}CreateInput {
{{#each entity.fields}}
{{#unless (hasAnnotation this 'computed')}}
  {{name.name}}{{#if optional}}?{{/if}}: {{typeToTS type}};
{{/unless}}
{{/each}}
}
`;
}

function createBehaviorTemplate(targetLanguage: string): string {
  if (targetLanguage === 'python') {
    return `"""
Behavior: {{behavior.name.name}}
{{#if behavior.description}}
{{behavior.description.value}}
{{/if}}
"""

from dataclasses import dataclass
from typing import Union
from enum import Enum

{{#if behavior.input}}
@dataclass
class {{behavior.name.name}}Input:
    """Input for {{behavior.name.name}}."""
{{#each behavior.input.fields}}
    {{snakeCase name.name}}: {{typeToPython type}}{{#if optional}} = None{{/if}}
{{/each}}
{{/if}}

{{#if behavior.output.errors}}
class {{behavior.name.name}}ErrorCode(Enum):
{{#each behavior.output.errors}}
    {{screamingSnakeCase name.name}} = "{{name.name}}"
{{/each}}
{{/if}}

async def {{snakeCase behavior.name.name}}(input: {{behavior.name.name}}Input):
    """Execute {{behavior.name.name}} behavior."""
    # TODO: Implement
    pass
`;
  }

  // Default: TypeScript
  return `/**
 * Behavior: {{behavior.name.name}}
{{#if behavior.description}}
 * {{behavior.description.value}}
{{/if}}
 */

{{#if behavior.input}}
export interface {{behavior.name.name}}Input {
{{#each behavior.input.fields}}
  {{name.name}}{{#if optional}}?{{/if}}: {{typeToTS type}};
{{/each}}
}
{{/if}}

{{#if behavior.output.errors}}
export type {{behavior.name.name}}ErrorCode = 
{{#each behavior.output.errors}}
  | '{{name.name}}'
{{/each}};

export interface {{behavior.name.name}}Error {
  code: {{behavior.name.name}}ErrorCode;
  message: string;
  retriable: boolean;
}
{{/if}}

export type {{behavior.name.name}}Result = 
  | { success: true; data: {{typeToTS behavior.output.success}} }
  | { success: false; error: {{behavior.name.name}}Error };

/**
 * {{behavior.name.name}} handler.
 */
export async function {{camelCase behavior.name.name}}(
  input: {{behavior.name.name}}Input
): Promise<{{behavior.name.name}}Result> {
  // TODO: Implement
  throw new Error('Not implemented');
}
`;
}

function createIndexTemplate(targetLanguage: string): string {
  if (targetLanguage === 'python') {
    return `"""
{{domain.name.name}} Domain
Generated from ISL specification.
"""

# Re-export all entities
{{#each domain.entities}}
from .entities.{{snakeCase name.name}} import {{name.name}}
{{/each}}

# Re-export all behaviors
{{#each domain.behaviors}}
from .behaviors.{{snakeCase name.name}} import {{camelCase name.name}}
{{/each}}

__all__ = [
{{#each domain.entities}}
    '{{name.name}}',
{{/each}}
{{#each domain.behaviors}}
    '{{camelCase name.name}}',
{{/each}}
]
`;
  }

  // Default: TypeScript
  return `/**
 * {{domain.name.name}} Domain
 * Generated from ISL specification.
 * 
 * @generated
 */

// Entities
{{#each domain.entities}}
export * from './entities/{{kebabCase name.name}}.js';
{{/each}}

// Behaviors
{{#each domain.behaviors}}
export * from './behaviors/{{kebabCase name.name}}.js';
{{/each}}
`;
}

function createTestFile(className: string): string {
  return `/**
 * Tests for ${className}
 */

import { describe, it, expect } from 'vitest';
import { ${className} } from '../src/generator.js';

describe('${className}', () => {
  it('should have correct name', () => {
    const generator = new ${className}();
    expect(generator.name).toBe('${toKebabCase(className)}');
  });

  it('should generate files from domain', async () => {
    const generator = new ${className}();
    
    // Create a mock domain
    const domain = {
      kind: 'DomainDeclaration',
      name: { kind: 'Identifier', name: 'TestDomain', span: { start: 0, end: 0, line: 1, column: 1 } },
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [],
      invariants: [],
      span: { start: 0, end: 0, line: 1, column: 1 },
    };

    const result = await generator.generate(domain as any);
    expect(result.files).toBeDefined();
    expect(result.generator).toBe('${toKebabCase(className)}');
  });
});
`;
}

function createReadme(name: string, description: string, targetLanguage: string): string {
  return `# ${name}

${description}

## Installation

\`\`\`bash
npm install @isl/${name}
\`\`\`

## Usage

\`\`\`typescript
import { ${toPascalCase(name)} } from '@isl/${name}';
import { parseISL } from '@isl-lang/isl-core';

// Parse your ISL file
const { ast } = parseISL(islSource);

// Create generator
const generator = new ${toPascalCase(name)}();

// Generate code
const result = await generator.generate(ast, {
  outputDir: './generated',
});

console.log(\`Generated \${result.files.length} files\`);
\`\`\`

## Generated Files

This generator produces ${targetLanguage} files:

- \`entities/*.${getExtensionWithoutDot(targetLanguage)}\` - Entity types
- \`behaviors/*.${getExtensionWithoutDot(targetLanguage)}\` - Behavior handlers
- \`index.${getExtensionWithoutDot(targetLanguage)}\` - Main export file

## Customization

### Custom Templates

Place custom Handlebars templates in the \`templates/\` directory:

- \`entity.hbs\` - Entity template
- \`behavior.hbs\` - Behavior template
- \`index.hbs\` - Index file template

### Custom Helpers

Register custom template helpers:

\`\`\`typescript
class MyGenerator extends ${toPascalCase(name)} {
  protected helpers = {
    myHelper: (value: string) => value.toUpperCase(),
  };
}
\`\`\`

## Development

\`\`\`bash
# Build
npm run build

# Test
npm test

# Watch mode
npm run dev
\`\`\`

## License

MIT
`;
}

function createGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# Logs
*.log
npm-debug.log*
`;
}

// ============================================================================
// Utility Functions
// ============================================================================

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/^-/, '');
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function getExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: '.ts',
    javascript: '.js',
    python: '.py',
    go: '.go',
    rust: '.rs',
    java: '.java',
    kotlin: '.kt',
    swift: '.swift',
    csharp: '.cs',
  };
  return extensions[language.toLowerCase()] ?? '.txt';
}

function getExtensionWithoutDot(language: string): string {
  return getExtension(language).slice(1);
}
