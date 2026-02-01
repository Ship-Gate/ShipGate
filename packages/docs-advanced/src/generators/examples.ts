// ============================================================================
// Examples Generator - Extract and format examples from ISL
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
import type {
  ExampleDoc,
  CodeBlock,
  SandboxConfig,
  SandboxFile,
  GeneratorOptions,
  GeneratedFile,
} from '../types';
import { expressionToString, typeToString } from '../utils/ast-helpers';

/**
 * Extract all examples from a domain
 */
export function extractExamples(domain: AST.Domain): ExampleDoc[] {
  const examples: ExampleDoc[] = [];

  // Extract from scenarios
  for (const scenarioBlock of domain.scenarios) {
    for (const scenario of scenarioBlock.scenarios) {
      examples.push({
        name: scenario.name.value,
        description: `Example for ${scenarioBlock.behaviorName.name}`,
        given: scenario.given.map(statementToString),
        when: scenario.when.map(statementToString),
        then: scenario.then.map(expressionToString),
        interactive: true,
      });
    }
  }

  // Extract from chaos scenarios
  for (const chaosBlock of domain.chaos) {
    for (const scenario of chaosBlock.scenarios) {
      examples.push({
        name: `[Chaos] ${scenario.name.value}`,
        description: `Chaos test for ${chaosBlock.behaviorName.name}`,
        when: scenario.when.map(statementToString),
        then: scenario.then.map(expressionToString),
        interactive: false,
      });
    }
  }

  return examples;
}

/**
 * Generate example code files
 */
export function generateExampleCode(
  behavior: AST.Behavior,
  domain: AST.Domain,
  language: 'typescript' | 'python' | 'go'
): CodeBlock[] {
  const examples: CodeBlock[] = [];

  // Basic usage example
  examples.push({
    language,
    code: generateBasicExample(behavior, language),
    filename: `${behavior.name.name.toLowerCase()}-basic.${getExtension(language)}`,
  });

  // Error handling example
  if (behavior.output.errors.length > 0) {
    examples.push({
      language,
      code: generateErrorHandlingExample(behavior, language),
      filename: `${behavior.name.name.toLowerCase()}-errors.${getExtension(language)}`,
    });
  }

  // Validation example
  if (behavior.preconditions.length > 0) {
    examples.push({
      language,
      code: generateValidationExample(behavior, language),
      filename: `${behavior.name.name.toLowerCase()}-validation.${getExtension(language)}`,
    });
  }

  return examples;
}

/**
 * Generate sandbox configuration for a behavior
 */
export function generateSandboxConfig(
  behavior: AST.Behavior,
  domain: AST.Domain
): SandboxConfig {
  const files: SandboxFile[] = [];

  // Main file
  files.push({
    path: 'index.ts',
    content: generateSandboxMain(behavior),
  });

  // Types file
  files.push({
    path: 'types.ts',
    content: generateSandboxTypes(behavior, domain),
  });

  // Mock client
  files.push({
    path: 'client.ts',
    content: generateSandboxClient(behavior),
  });

  // Test file
  files.push({
    path: 'test.ts',
    content: generateSandboxTest(behavior),
    hidden: true,
  });

  return {
    template: 'typescript',
    files,
    dependencies: {
      'typescript': '^5.0.0',
      'zod': '^3.22.0',
    },
    entryFile: 'index.ts',
  };
}

/**
 * Generate examples documentation pages
 */
export function generateExamplePages(
  examples: ExampleDoc[],
  options: GeneratorOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Index page
  files.push({
    path: 'examples/index.mdx',
    content: generateExamplesIndexPage(examples),
    type: 'page',
  });

  // Individual example pages
  const groupedExamples = groupExamplesByBehavior(examples);
  for (const [behavior, behaviorExamples] of Object.entries(groupedExamples)) {
    files.push({
      path: `examples/${behavior.toLowerCase()}.mdx`,
      content: generateBehaviorExamplesPage(behavior, behaviorExamples, options),
      type: 'page',
    });
  }

  return files;
}

// ============================================================================
// CODE GENERATION
// ============================================================================

function generateBasicExample(behavior: AST.Behavior, language: string): string {
  const name = behavior.name.name;
  const nameLower = name.toLowerCase();

  if (language === 'typescript') {
    return `import { ${name}Input, ${name}Output } from './types';
import { client } from './client';

async function ${nameLower}Example() {
  const input: ${name}Input = {
${behavior.input.fields.map(f => `    ${f.name.name}: ${getExampleValue(f.type)},`).join('\n')}
  };

  try {
    const result = await client.${nameLower}(input);
    console.log('Success:', result);
    return result;
  } catch (error) {
    console.error('Failed:', error);
    throw error;
  }
}

// Run the example
${nameLower}Example();
`;
  }

  if (language === 'python') {
    return `from client import ${nameLower}
from types import ${name}Input

async def ${nameLower}_example():
    input = ${name}Input(
${behavior.input.fields.map(f => `        ${f.name.name}=${getExampleValuePython(f.type)},`).join('\n')}
    )
    
    try:
        result = await ${nameLower}(input)
        print(f"Success: {result}")
        return result
    except Exception as error:
        print(f"Failed: {error}")
        raise

# Run the example
import asyncio
asyncio.run(${nameLower}_example())
`;
  }

  return `// Example for ${language}`;
}

function generateErrorHandlingExample(behavior: AST.Behavior, language: string): string {
  const name = behavior.name.name;
  const nameLower = name.toLowerCase();
  const errors = behavior.output.errors;

  if (language === 'typescript') {
    return `import { ${name}Input, ${name}Error } from './types';
import { client } from './client';

async function ${nameLower}WithErrorHandling(input: ${name}Input) {
  try {
    return await client.${nameLower}(input);
  } catch (error) {
    if (error instanceof ${name}Error) {
      switch (error.code) {
${errors.map(e => `        case '${e.name.name}':
          // ${e.when?.value ?? 'Handle this error'}
          ${e.retriable ? `console.log('Retriable error, consider retrying');` : `console.error('Non-retriable error');`}
          break;`).join('\n')}
        default:
          console.error('Unknown error:', error);
      }
    }
    throw error;
  }
}
`;
  }

  return `// Error handling example for ${language}`;
}

function generateValidationExample(behavior: AST.Behavior, language: string): string {
  const name = behavior.name.name;
  const nameLower = name.toLowerCase();

  if (language === 'typescript') {
    return `import { z } from 'zod';
import { ${name}Input } from './types';
import { client } from './client';

// Input validation schema
const ${nameLower}Schema = z.object({
${behavior.input.fields.map(f => `  ${f.name.name}: ${getZodType(f.type)}${f.optional ? '.optional()' : ''},`).join('\n')}
});

async function validated${name}(rawInput: unknown) {
  // Validate input
  const result = ${nameLower}Schema.safeParse(rawInput);
  
  if (!result.success) {
    console.error('Validation failed:', result.error.format());
    throw new Error('Invalid input');
  }
  
  // Proceed with validated input
  return client.${nameLower}(result.data);
}

// Example usage
validated${name}({
${behavior.input.fields.map(f => `  ${f.name.name}: ${getExampleValue(f.type)},`).join('\n')}
});
`;
  }

  return `// Validation example for ${language}`;
}

// ============================================================================
// SANDBOX GENERATION
// ============================================================================

function generateSandboxMain(behavior: AST.Behavior): string {
  const name = behavior.name.name;
  
  return `import { ${name.toLowerCase()} } from './client';
import type { ${name}Input } from './types';

// Try editing the input!
const input: ${name}Input = {
${behavior.input.fields.map(f => `  ${f.name.name}: ${getExampleValue(f.type)},`).join('\n')}
};

async function main() {
  console.log('Input:', input);
  
  const result = await ${name.toLowerCase()}(input);
  
  console.log('Result:', result);
}

main().catch(console.error);
`;
}

function generateSandboxTypes(behavior: AST.Behavior, domain: AST.Domain): string {
  return `// Auto-generated types for ${behavior.name.name}

export interface ${behavior.name.name}Input {
${behavior.input.fields.map(f => `  ${f.name.name}${f.optional ? '?' : ''}: ${typeToTSType(f.type)};`).join('\n')}
}

export interface ${behavior.name.name}Output {
  success: boolean;
  data?: ${typeToTSType(behavior.output.success!)};
  error?: {
    code: ${behavior.output.errors.map(e => `'${e.name.name}'`).join(' | ') || 'string'};
    message: string;
  };
}
`;
}

function generateSandboxClient(behavior: AST.Behavior): string {
  const name = behavior.name.name;
  
  return `import type { ${name}Input, ${name}Output } from './types';

// Mock implementation - replace with real API call
export async function ${name.toLowerCase()}(input: ${name}Input): Promise<${name}Output> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock response
  return {
    success: true,
    data: {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    },
  };
}
`;
}

function generateSandboxTest(behavior: AST.Behavior): string {
  return `import { ${behavior.name.name.toLowerCase()} } from './client';

// Hidden test file to verify example works
async function test() {
  const result = await ${behavior.name.name.toLowerCase()}({
${behavior.input.fields.filter(f => !f.optional).map(f => `    ${f.name.name}: ${getExampleValue(f.type)},`).join('\n')}
  });
  
  console.assert(result.success, 'Expected success');
}

test();
`;
}

// ============================================================================
// PAGE GENERATION
// ============================================================================

function generateExamplesIndexPage(examples: ExampleDoc[]): string {
  const grouped = groupExamplesByBehavior(examples);
  
  return `---
title: Examples
description: Code examples and scenarios
---

# Examples

Browse examples organized by behavior.

${Object.entries(grouped).map(([behavior, exs]) => `
## ${behavior}

${exs.map(e => `- [${e.name}](./${behavior.toLowerCase()}#${slugify(e.name)})`).join('\n')}
`).join('\n')}
`;
}

function generateBehaviorExamplesPage(
  behavior: string,
  examples: ExampleDoc[],
  options: GeneratorOptions
): string {
  return `---
title: "${behavior} Examples"
description: "Examples for ${behavior}"
---

# ${behavior} Examples

${examples.map(ex => `
## ${ex.name}

${ex.description}

${ex.given && ex.given.length > 0 ? `
### Given

\`\`\`
${ex.given.join('\n')}
\`\`\`
` : ''}

### When

\`\`\`
${ex.when.join('\n')}
\`\`\`

### Then

\`\`\`
${ex.then.join('\n')}
\`\`\`

${ex.code ? `
### Code

\`\`\`typescript
${ex.code}
\`\`\`
` : ''}

${ex.interactive && options.interactive ? `
<TryIt example="${slugify(ex.name)}" />
` : ''}
`).join('\n---\n')}
`;
}

// ============================================================================
// HELPERS
// ============================================================================

function statementToString(stmt: AST.Statement): string {
  switch (stmt.kind) {
    case 'AssignmentStmt':
      return `${stmt.target.name} = ${expressionToString(stmt.value)}`;
    case 'CallStmt':
      return stmt.target
        ? `${stmt.target.name} = ${expressionToString(stmt.call)}`
        : expressionToString(stmt.call);
    case 'LoopStmt':
      return `repeat ${expressionToString(stmt.count)} times`;
    default:
      return '';
  }
}

function groupExamplesByBehavior(examples: ExampleDoc[]): Record<string, ExampleDoc[]> {
  const grouped: Record<string, ExampleDoc[]> = {};
  
  for (const example of examples) {
    const match = example.description.match(/for (\w+)/);
    const behavior = match?.[1] ?? 'General';
    
    if (!grouped[behavior]) {
      grouped[behavior] = [];
    }
    grouped[behavior].push(example);
  }
  
  return grouped;
}

function getExampleValue(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return '"example"';
        case 'Int': return '42';
        case 'Decimal': return '99.99';
        case 'Boolean': return 'true';
        case 'UUID': return '"550e8400-e29b-41d4-a716-446655440000"';
        case 'Timestamp': return 'new Date().toISOString()';
        default: return 'null';
      }
    case 'ListType': return '[]';
    case 'OptionalType': return 'null';
    default: return '{}';
  }
}

function getExampleValuePython(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return '"example"';
        case 'Int': return '42';
        case 'Decimal': return '99.99';
        case 'Boolean': return 'True';
        case 'UUID': return '"550e8400-e29b-41d4-a716-446655440000"';
        case 'Timestamp': return 'datetime.now().isoformat()';
        default: return 'None';
      }
    case 'ListType': return '[]';
    case 'OptionalType': return 'None';
    default: return '{}';
  }
}

function typeToTSType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'string';
        case 'Int': case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'UUID': case 'Timestamp': return 'string';
        default: return 'unknown';
      }
    case 'ListType': return `${typeToTSType(type.element)}[]`;
    case 'OptionalType': return `${typeToTSType(type.inner)} | null`;
    case 'ReferenceType': return type.name.parts.map(p => p.name).join('.');
    default: return 'unknown';
  }
}

function getZodType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'z.string()';
        case 'Int': return 'z.number().int()';
        case 'Decimal': return 'z.number()';
        case 'Boolean': return 'z.boolean()';
        case 'UUID': return 'z.string().uuid()';
        case 'Timestamp': return 'z.string().datetime()';
        default: return 'z.unknown()';
      }
    case 'ListType': return `z.array(${getZodType(type.element)})`;
    case 'OptionalType': return `${getZodType(type.inner)}.nullable()`;
    default: return 'z.unknown()';
  }
}

function getExtension(language: string): string {
  switch (language) {
    case 'typescript': return 'ts';
    case 'python': return 'py';
    case 'go': return 'go';
    default: return 'txt';
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
