/**
 * Generate Command
 * 
 * Generate TypeScript types, tests, and documentation from ISL files.
 * Usage: isl generate --types --tests --docs
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { glob } from 'glob';
import { resolve, relative, dirname, join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL, type Domain as DomainDeclaration, type TypeDefinition } from '@isl-lang/parser';
import { output } from '../output.js';
import { loadConfig, type ISLConfig } from '../config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Generate TypeScript types */
  types?: boolean;
  /** Generate test files */
  tests?: boolean;
  /** Generate documentation */
  docs?: boolean;
  /** Output directory */
  output?: string;
  /** Config file path */
  config?: string;
  /** Watch mode */
  watch?: boolean;
  /** Overwrite existing files */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface GeneratedFile {
  path: string;
  type: 'types' | 'tests' | 'docs';
  content: string;
}

export interface GenerateResult {
  success: boolean;
  files: GeneratedFile[];
  errors: string[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate types for a domain
 */
function generateTypesForDomain(domain: DomainDeclaration): string {
  const lines: string[] = [];
  
  lines.push('// Types generated from ISL specification');
  lines.push('');
  
  // Generate type aliases for custom types
  for (const type of domain.types) {
    const tsType = generateTypeDefinition(type.definition);
    lines.push(`export type ${type.name.name} = ${tsType};`);
    lines.push('');
  }
  
  // Generate interfaces for entities
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name.name} {`);
    
    if (entity.fields) {
      for (const field of entity.fields) {
        const tsType = mapToTypeScriptType(field.type);
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name.name}${optional}: ${tsType};`);
      }
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate function types for behaviors
  for (const behavior of domain.behaviors) {
    const inputParams = behavior.inputs?.map(i => 
      `${i.name.name}: ${mapToTypeScriptType(i.type)}`
    ).join(', ') ?? '';
    
    const outputType = behavior.output 
      ? mapToTypeScriptType(behavior.output)
      : 'void';
    
    lines.push(`export type ${behavior.name.name}Fn = (${inputParams}) => Promise<${outputType}>;`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate tests for a domain
 */
function generateTestsForDomain(domain: DomainDeclaration): string {
  const lines: string[] = [];
  
  lines.push("import { describe, it, expect } from 'vitest';");
  lines.push('');
  
  // Generate tests for each behavior
  for (const behavior of domain.behaviors) {
    lines.push(`describe('${behavior.name.name}', () => {`);
    
    // Generate a basic test skeleton
    lines.push(`  it('should execute successfully', async () => {`);
    lines.push(`    // TODO: Implement test for ${behavior.name.name}`);
    lines.push(`    expect(true).toBe(true);`);
    lines.push(`  });`);
    
    // Generate precondition tests
    if (behavior.preconditions && behavior.preconditions.length > 0) {
      lines.push('');
      lines.push(`  describe('preconditions', () => {`);
      for (let i = 0; i < behavior.preconditions.length; i++) {
        lines.push(`    it('should validate precondition ${i + 1}', () => {`);
        lines.push(`      // TODO: Test precondition`);
        lines.push(`      expect(true).toBe(true);`);
        lines.push(`    });`);
      }
      lines.push(`  });`);
    }
    
    lines.push(`});`);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate TypeScript type from ISL type definition
 */
function generateTypeDefinition(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      return mapPrimitiveToTS(def.name);
    case 'EnumType':
      return def.variants.map(v => `'${v.name.name}'`).join(' | ');
    case 'StructType':
      const fields = def.fields.map(f => 
        `${f.name.name}${f.optional ? '?' : ''}: ${mapToTypeScriptType(f.type)}`
      ).join('; ');
      return `{ ${fields} }`;
    case 'ListType':
      return `${generateTypeDefinition(def.elementType)}[]`;
    case 'MapType':
      return `Record<${generateTypeDefinition(def.keyType)}, ${generateTypeDefinition(def.valueType)}>`;
    case 'OptionalType':
      return `${generateTypeDefinition(def.inner)} | null`;
    case 'UnionType':
      return def.types.map(t => generateTypeDefinition(t)).join(' | ');
    case 'ReferenceType':
      return def.name.name;
    case 'ConstrainedType':
      return generateTypeDefinition(def.base);
    default:
      return 'unknown';
  }
}

/**
 * Map ISL primitive to TypeScript type
 */
function mapPrimitiveToTS(name: string): string {
  const map: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Decimal': 'number',
    'Boolean': 'boolean',
    'Timestamp': 'Date',
    'UUID': 'string',
    'Duration': 'number',
  };
  return map[name] ?? 'unknown';
}

/**
 * Map ISL type reference to TypeScript
 */
function mapToTypeScriptType(typeRef: TypeDefinition | { name: string } | undefined | null): string {
  if (!typeRef) return 'unknown';
  
  // Handle TypeDefinition
  if ('kind' in typeRef) {
    return generateTypeDefinition(typeRef as TypeDefinition);
  }
  
  // Handle simple name reference
  if ('name' in typeRef) {
    const name = typeRef.name;
    const primitiveMap: Record<string, string> = {
      'String': 'string',
      'Int': 'number',
      'Integer': 'number',
      'Float': 'number',
      'Decimal': 'number',
      'Boolean': 'boolean',
      'Bool': 'boolean',
      'ID': 'string',
      'UUID': 'string',
      'DateTime': 'Date',
      'Timestamp': 'Date',
      'Date': 'string',
      'Time': 'string',
      'Void': 'void',
      'Any': 'unknown',
    };
    return primitiveMap[name] ?? name;
  }
  
  return 'unknown';
}

/**
 * Generate documentation for a domain
 */
function generateDocsForDomain(domain: DomainDeclaration): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# ${domain.name.name}`);
  lines.push('');
  if (domain.description) {
    lines.push(domain.description);
    lines.push('');
  }
  
  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Entities](#entities)');
  lines.push('- [Behaviors](#behaviors)');
  if (domain.invariants?.length) {
    lines.push('- [Invariants](#invariants)');
  }
  lines.push('');

  // Entities
  lines.push('## Entities');
  lines.push('');
  
  for (const entity of domain.entities) {
    lines.push(`### ${entity.name.name}`);
    lines.push('');
    
    if (entity.fields && entity.fields.length > 0) {
      lines.push('| Field | Type | Description |');
      lines.push('|-------|------|-------------|');
      
      for (const field of entity.fields) {
        const typeStr = field.type?.name ?? 'unknown';
        lines.push(`| \`${field.name.name}\` | \`${typeStr}\` | |`);
      }
      lines.push('');
    }
  }

  // Behaviors
  lines.push('## Behaviors');
  lines.push('');
  
  for (const behavior of domain.behaviors) {
    lines.push(`### ${behavior.name.name}`);
    lines.push('');
    
    // Signature
    if (behavior.inputs && behavior.inputs.length > 0) {
      const inputs = behavior.inputs.map(i => `${i.name.name}: ${i.type?.name ?? 'unknown'}`).join(', ');
      const output = behavior.output?.name ?? 'void';
      lines.push(`**Signature:** \`(${inputs}) -> ${output}\``);
      lines.push('');
    }

    // Postconditions
    if (behavior.body?.postconditions && behavior.body.postconditions.length > 0) {
      lines.push('**Postconditions:**');
      for (const post of behavior.body.postconditions) {
        lines.push(`- ${post.description ?? 'No description'}`);
      }
      lines.push('');
    }

    // Scenarios
    if (behavior.body?.scenarios && behavior.body.scenarios.length > 0) {
      lines.push('**Scenarios:**');
      lines.push('');
      for (const scenario of behavior.body.scenarios) {
        lines.push(`#### ${scenario.name}`);
        if (scenario.given) {
          lines.push(`- **Given:** ${JSON.stringify(scenario.given)}`);
        }
        if (scenario.when) {
          lines.push(`- **When:** ${JSON.stringify(scenario.when)}`);
        }
        if (scenario.then) {
          lines.push(`- **Then:** ${JSON.stringify(scenario.then)}`);
        }
        lines.push('');
      }
    }
  }

  // Invariants
  if (domain.invariants && domain.invariants.length > 0) {
    lines.push('## Invariants');
    lines.push('');
    
    for (const inv of domain.invariants) {
      lines.push(`- **${inv.name?.name ?? 'Unnamed'}:** ${inv.description ?? 'No description'}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Generated by ISL CLI on ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Generate all outputs for a single ISL file
 */
async function generateForFile(
  filePath: string,
  options: GenerateOptions,
  outputDir: string
): Promise<{ files: GeneratedFile[]; errors: string[] }> {
  const files: GeneratedFile[] = [];
  const errors: string[] = [];
  
  try {
    const source = await readFile(filePath, 'utf-8');
    const { domain: ast, errors: parseErrors } = parseISL(source, filePath);

    if (parseErrors.length > 0 || !ast) {
      errors.push(...parseErrors.map(e => `${filePath}: ${e.message}`));
      return { files, errors };
    }

    const domainName = ast.name.name.toLowerCase();

    // Generate types
    if (options.types !== false) {
      const typesContent = generateTypesForDomain(ast);
      const typesPath = join(outputDir, 'types', `${domainName}.types.ts`);
      files.push({ path: typesPath, type: 'types', content: typesContent });
    }

    // Generate tests
    if (options.tests !== false) {
      const testsContent = generateTestsForDomain(ast);
      const testsPath = join(outputDir, 'tests', `${domainName}.test.ts`);
      files.push({ path: testsPath, type: 'tests', content: testsContent });
    }

    // Generate docs
    if (options.docs) {
      const docsContent = generateDocsForDomain(ast);
      const docsPath = join(outputDir, 'docs', `${domainName}.md`);
      files.push({ path: docsPath, type: 'docs', content: docsContent });
    }
  } catch (err) {
    errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { files, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Generate Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate types, tests, and documentation from ISL files
 */
export async function generate(filePatterns: string[], options: GenerateOptions = {}): Promise<GenerateResult> {
  const startTime = Date.now();
  const spinner = ora('Loading configuration...').start();

  // Load config
  const { config } = await loadConfig();
  
  // Determine what to generate
  const generateTypes = options.types ?? config?.output?.types ?? true;
  const generateTests = options.tests ?? config?.output?.tests ?? true;
  const generateDocs = options.docs ?? config?.output?.docs ?? false;

  // Determine output directory
  const outputDir = resolve(options.output ?? config?.output?.dir ?? './generated');

  // Resolve files
  const patterns = filePatterns.length > 0 ? filePatterns : config?.include ?? ['**/*.isl'];
  const exclude = config?.exclude ?? ['node_modules/**', 'dist/**'];
  
  const islFiles: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('.isl')) {
      islFiles.push(resolve(pattern));
    } else {
      const matches = await glob(pattern, { cwd: process.cwd(), ignore: exclude });
      islFiles.push(...matches.filter(m => m.endsWith('.isl')).map(m => resolve(m)));
    }
  }

  if (islFiles.length === 0) {
    spinner.warn('No ISL files found');
    return {
      success: true,
      files: [],
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  spinner.text = `Generating from ${islFiles.length} file${islFiles.length === 1 ? '' : 's'}...`;

  // Collect all generated files
  const allFiles: GeneratedFile[] = [];
  const allErrors: string[] = [];

  for (const file of islFiles) {
    const { files, errors } = await generateForFile(file, {
      ...options,
      types: generateTypes,
      tests: generateTests,
      docs: generateDocs,
    }, outputDir);
    
    allFiles.push(...files);
    allErrors.push(...errors);
  }

  // Write all files
  if (allErrors.length === 0) {
    spinner.text = `Writing ${allFiles.length} file${allFiles.length === 1 ? '' : 's'}...`;
    
    for (const file of allFiles) {
      await mkdir(dirname(file.path), { recursive: true });
      
      // Add header comment for code files
      let content = file.content;
      if (file.type !== 'docs') {
        content = `/**
 * Auto-generated by ISL CLI
 * DO NOT EDIT - regenerate with: isl generate
 * Generated: ${new Date().toISOString()}
 */

${content}`;
      }
      
      await writeFile(file.path, content);
    }
  }

  const duration = Date.now() - startTime;

  if (allErrors.length > 0) {
    spinner.fail(`Generation failed with ${allErrors.length} error${allErrors.length === 1 ? '' : 's'}`);
  } else {
    spinner.succeed(`Generated ${allFiles.length} file${allFiles.length === 1 ? '' : 's'} (${duration}ms)`);
  }

  return {
    success: allErrors.length === 0,
    files: allFiles,
    errors: allErrors,
    duration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print generate results to console
 */
export function printGenerateResult(result: GenerateResult): void {
  console.log('');

  if (result.success) {
    // Group files by type
    const typeFiles = result.files.filter(f => f.type === 'types');
    const testFiles = result.files.filter(f => f.type === 'tests');
    const docFiles = result.files.filter(f => f.type === 'docs');

    if (typeFiles.length > 0) {
      output.section('Types');
      for (const file of typeFiles) {
        output.filePath(relative(process.cwd(), file.path), 'created');
      }
    }

    if (testFiles.length > 0) {
      output.section('Tests');
      for (const file of testFiles) {
        output.filePath(relative(process.cwd(), file.path), 'created');
      }
    }

    if (docFiles.length > 0) {
      output.section('Documentation');
      for (const file of docFiles) {
        output.filePath(relative(process.cwd(), file.path), 'created');
      }
    }

    console.log('');
    console.log(chalk.green(`✓ Generated ${result.files.length} file${result.files.length === 1 ? '' : 's'}`));
  } else {
    console.log(chalk.red('✗ Generation failed'));
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
  }

  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

export default generate;
