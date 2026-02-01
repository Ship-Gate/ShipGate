/**
 * AI Prompt Templates
 * 
 * Structured prompts for generating implementations from ISL specs.
 */

import type {
  DomainDeclaration,
  BehaviorDeclaration,
  EntityDeclaration,
  Expression,
  TypeExpression,
} from '@isl-lang/isl-core';

export interface PromptContext {
  domain: DomainDeclaration;
  behavior: BehaviorDeclaration;
  generatedTypes: string;
  existingEntities: EntityDeclaration[];
}

/**
 * Generate the system prompt for implementation generation
 */
export function generateSystemPrompt(): string {
  return `You are an expert software engineer implementing behaviors from Intent Specification Language (ISL) specs.

Your task is to generate TypeScript implementations that:
1. EXACTLY match the behavioral contract specified in the ISL
2. Satisfy ALL preconditions, postconditions, and invariants
3. Handle ALL specified error cases correctly
4. Meet temporal requirements (latency, eventual consistency)
5. Follow security requirements strictly

Rules:
- Generate clean, production-ready TypeScript code
- Use async/await for all asynchronous operations
- Include proper error handling for each error case in the spec
- Add JSDoc comments referencing the ISL spec sections
- Use the provided TypeScript types exactly
- Do NOT add functionality beyond what's specified
- Do NOT skip any postconditions or invariants

Output format:
- Return ONLY the implementation code
- Do not include imports (they will be added separately)
- Do not include type definitions (they are generated from the spec)
- Export the behavior as a named function`;
}

/**
 * Generate the implementation prompt for a specific behavior
 */
export function generateImplementationPrompt(ctx: PromptContext): string {
  const { domain, behavior, generatedTypes, existingEntities } = ctx;
  
  const parts: string[] = [];
  
  // Header
  parts.push(`# Implementation Request`);
  parts.push('');
  parts.push(`Generate a TypeScript implementation for the \`${behavior.name.name}\` behavior from the \`${domain.name.name}\` domain.`);
  parts.push('');
  
  // ISL Spec
  parts.push('## ISL Specification');
  parts.push('');
  parts.push('```isl');
  parts.push(behaviorToISL(behavior));
  parts.push('```');
  parts.push('');
  
  // TypeScript Types
  parts.push('## TypeScript Types');
  parts.push('');
  parts.push('Use these exact types in your implementation:');
  parts.push('');
  parts.push('```typescript');
  parts.push(generatedTypes);
  parts.push('```');
  parts.push('');
  
  // Entity Context
  if (existingEntities.length > 0) {
    parts.push('## Entity Repositories');
    parts.push('');
    parts.push('The following repositories are available as dependencies:');
    parts.push('');
    for (const entity of existingEntities) {
      parts.push(`- \`${entity.name.name}Repository\`: CRUD operations for ${entity.name.name}`);
    }
    parts.push('');
  }
  
  // Preconditions
  if (behavior.preconditions) {
    parts.push('## Preconditions to Validate');
    parts.push('');
    parts.push('The implementation MUST validate these before proceeding:');
    parts.push('');
    for (const condition of behavior.preconditions.conditions) {
      for (const statement of condition.statements) {
        parts.push(`- ${expressionToReadable(statement.expression)}`);
      }
    }
    parts.push('');
  }
  
  // Postconditions
  if (behavior.postconditions) {
    parts.push('## Postconditions to Ensure');
    parts.push('');
    for (const condition of behavior.postconditions.conditions) {
      if (condition.guard === 'success') {
        parts.push('On success:');
        for (const statement of condition.statements) {
          parts.push(`- ${expressionToReadable(statement.expression)}`);
        }
        parts.push('');
      } else if (condition.guard === 'failure') {
        parts.push('On failure:');
        for (const statement of condition.statements) {
          parts.push(`- ${expressionToReadable(statement.expression)}`);
        }
        parts.push('');
      }
    }
  }
  
  // Invariants
  if (behavior.invariants && behavior.invariants.length > 0) {
    parts.push('## Invariants to Maintain');
    parts.push('');
    parts.push('These MUST hold true always:');
    parts.push('');
    for (const inv of behavior.invariants) {
      parts.push(`- ${expressionToReadable(inv.expression)}`);
    }
    parts.push('');
  }
  
  // Error Cases
  if (behavior.output?.errors && behavior.output.errors.length > 0) {
    parts.push('## Error Cases');
    parts.push('');
    parts.push('Handle these error conditions:');
    parts.push('');
    for (const error of behavior.output.errors) {
      parts.push(`### ${error.name.name}`);
      if (error.when) {
        parts.push(`- When: ${error.when.value}`);
      }
      if (error.retriable !== undefined) {
        parts.push(`- Retriable: ${error.retriable}`);
      }
      if (error.retryAfter) {
        parts.push(`- Retry after: ${expressionToReadable(error.retryAfter)}`);
      }
      parts.push('');
    }
  }
  
  // Temporal Requirements
  if (behavior.temporal) {
    parts.push('## Temporal Requirements');
    parts.push('');
    for (const req of behavior.temporal.requirements) {
      parts.push(`- ${temporalToReadable(req)}`);
    }
    parts.push('');
  }
  
  // Security Requirements
  if (behavior.security) {
    parts.push('## Security Requirements');
    parts.push('');
    for (const req of behavior.security.requirements) {
      parts.push(`- ${expressionToReadable(req.expression)}`);
    }
    parts.push('');
  }
  
  // Implementation structure
  parts.push('## Expected Implementation Structure');
  parts.push('');
  parts.push('```typescript');
  parts.push(generateImplementationSkeleton(behavior));
  parts.push('```');
  parts.push('');
  
  parts.push('Generate the complete implementation following this structure.');
  
  return parts.join('\n');
}

/**
 * Convert behavior to ISL string for prompt
 */
function behaviorToISL(behavior: BehaviorDeclaration): string {
  const lines: string[] = [];
  
  lines.push(`behavior ${behavior.name.name} {`);
  
  if (behavior.description) {
    lines.push(`  description: "${behavior.description.value}"`);
    lines.push('');
  }
  
  if (behavior.input) {
    lines.push('  input {');
    for (const field of behavior.input.fields) {
      const optional = field.optional ? '?' : '';
      const annotations = field.annotations.length > 0 
        ? ` [${field.annotations.map(a => a.name.name).join(', ')}]`
        : '';
      lines.push(`    ${field.name.name}: ${typeToString(field.type)}${optional}${annotations}`);
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.output) {
    lines.push('  output {');
    lines.push(`    success: ${typeToString(behavior.output.success)}`);
    if (behavior.output.errors.length > 0) {
      lines.push('    errors {');
      for (const error of behavior.output.errors) {
        lines.push(`      ${error.name.name}`);
      }
      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.preconditions) {
    lines.push('  preconditions {');
    for (const condition of behavior.preconditions.conditions) {
      for (const statement of condition.statements) {
        lines.push(`    ${expressionToReadable(statement.expression)}`);
      }
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.postconditions) {
    lines.push('  postconditions {');
    for (const condition of behavior.postconditions.conditions) {
      if (condition.guard === 'success') {
        lines.push('    success implies:');
      } else if (condition.guard === 'failure') {
        lines.push('    failure implies:');
      }
      for (const statement of condition.statements) {
        lines.push(`      - ${expressionToReadable(statement.expression)}`);
      }
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.invariants && behavior.invariants.length > 0) {
    lines.push('  invariants {');
    for (const inv of behavior.invariants) {
      lines.push(`    - ${expressionToReadable(inv.expression)}`);
    }
    lines.push('  }');
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate implementation skeleton
 */
function generateImplementationSkeleton(behavior: BehaviorDeclaration): string {
  const name = behavior.name.name;
  const funcName = name.charAt(0).toLowerCase() + name.slice(1);
  
  const lines: string[] = [];
  
  // Dependencies interface
  lines.push('interface Dependencies {');
  lines.push('  // Add repository dependencies here');
  lines.push('}');
  lines.push('');
  
  // Factory function
  lines.push(`export function create${name}(deps: Dependencies): ${name}Function {`);
  lines.push(`  return async function ${funcName}(input: ${name}Input): Promise<${name}Result> {`);
  lines.push('    // 1. Validate preconditions');
  lines.push('    // 2. Execute business logic');
  lines.push('    // 3. Ensure postconditions');
  lines.push('    // 4. Return result');
  lines.push('  };');
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Convert expression to readable string
 */
function expressionToReadable(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'StringLiteral':
      return `"${expr.value}"`;
    case 'NumberLiteral':
      return expr.unit ? `${expr.value}${expr.unit}` : String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'NullLiteral':
      return 'null';
    case 'MemberExpression':
      return `${expressionToReadable(expr.object)}.${expr.property.name}`;
    case 'CallExpression':
      const args = expr.arguments.map(expressionToReadable).join(', ');
      return `${expressionToReadable(expr.callee)}(${args})`;
    case 'ComparisonExpression':
      return `${expressionToReadable(expr.left)} ${expr.operator} ${expressionToReadable(expr.right)}`;
    case 'LogicalExpression':
      return `${expressionToReadable(expr.left)} ${expr.operator} ${expressionToReadable(expr.right)}`;
    case 'BinaryExpression':
      return `${expressionToReadable(expr.left)} ${expr.operator} ${expressionToReadable(expr.right)}`;
    case 'UnaryExpression':
      return `${expr.operator} ${expressionToReadable(expr.operand)}`;
    case 'OldExpression':
      return `old(${expressionToReadable(expr.expression)})`;
    case 'DurationLiteral':
      return `${expr.value}${expr.unit}`;
    default:
      return 'expression';
  }
}

/**
 * Convert type expression to string
 */
function typeToString(type: TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      return type.name.name;
    case 'GenericType':
      const args = type.typeArguments.map(typeToString).join(', ');
      return `${type.name.name}<${args}>`;
    case 'UnionType':
      return type.variants.map(v => v.name.name).join(' | ');
    case 'ArrayType':
      return `${typeToString(type.elementType)}[]`;
    default:
      return 'unknown';
  }
}

/**
 * Convert temporal requirement to readable string
 */
function temporalToReadable(req: any): string {
  const duration = req.duration ? `${req.duration.value}${req.duration.unit}` : '';
  const percentile = req.percentile ? ` (${req.percentile})` : '';
  const condition = expressionToReadable(req.condition);
  
  switch (req.type) {
    case 'within':
      return `Response within ${duration}${percentile}`;
    case 'eventually':
      return `Eventually ${duration ? `within ${duration}` : ''}: ${condition}`;
    case 'immediately':
      return `Immediately: ${condition}`;
    case 'never':
      return `Never: ${condition}`;
    case 'always':
      return `Always: ${condition}`;
    default:
      return `${req.type}: ${condition}`;
  }
}

/**
 * Generate TypeScript types from domain for prompt context
 * (Simplified version - avoids circular dependency with isl-compiler)
 */
export function generateTypesFromDomain(domain: DomainDeclaration): string {
  const lines: string[] = [];
  
  // Generate entity interfaces
  for (const entity of domain.entities) {
    lines.push(`interface ${entity.name.name} {`);
    for (const field of entity.fields) {
      const optional = field.optional ? '?' : '';
      const tsType = fieldTypeToTS(field.type);
      lines.push(`  ${field.name.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }
  
  // Generate behavior types
  for (const behavior of domain.behaviors) {
    const name = behavior.name.name;
    
    // Input type
    if (behavior.input) {
      lines.push(`interface ${name}Input {`);
      for (const field of behavior.input.fields) {
        const optional = field.optional ? '?' : '';
        const tsType = fieldTypeToTS(field.type);
        lines.push(`  ${field.name.name}${optional}: ${tsType};`);
      }
      lines.push('}');
      lines.push('');
    }
    
    // Result type
    if (behavior.output) {
      const successType = typeToString(behavior.output.success);
      const errorCodes = behavior.output.errors.map(e => `'${e.name.name}'`).join(' | ');
      
      lines.push(`type ${name}Result =`);
      lines.push(`  | { success: true; data: ${successType} }`);
      if (errorCodes) {
        lines.push(`  | { success: false; error: { code: ${errorCodes}; message: string } };`);
      } else {
        lines.push(`  | { success: false; error: { code: string; message: string } };`);
      }
      lines.push('');
    }
    
    // Function type
    lines.push(`type ${name}Function = (input: ${name}Input) => Promise<${name}Result>;`);
    lines.push('');
  }
  
  return lines.join('\n');
}

function fieldTypeToTS(type: TypeExpression): string {
  const typeMap: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Decimal': 'number',
    'Boolean': 'boolean',
    'UUID': 'string',
    'Email': 'string',
    'Timestamp': 'Date',
  };
  
  if (type.kind === 'SimpleType') {
    return typeMap[type.name.name] ?? type.name.name;
  }
  return typeToString(type);
}
