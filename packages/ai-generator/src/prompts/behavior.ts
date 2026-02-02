/**
 * Behavior-Specific Prompts
 * 
 * Converts ISL behaviors into detailed prompts for code generation.
 */

import type {
  DomainDeclaration,
  BehaviorDeclaration,
  EntityDeclaration,
  Expression,
  TypeExpression,
} from '@isl-lang/isl-core';

export interface BehaviorPromptContext {
  domain: DomainDeclaration;
  behavior: BehaviorDeclaration;
  generatedTypes: string;
  language: string;
}

/**
 * Generate the complete prompt for a behavior implementation
 */
export function generateBehaviorPrompt(ctx: BehaviorPromptContext): string {
  const { domain, behavior, generatedTypes, language } = ctx;
  const sections: string[] = [];

  // Header
  sections.push(generateHeader(domain, behavior));

  // ISL Specification (for reference)
  sections.push(generateISLSection(behavior));

  // Generated Types
  sections.push(generateTypesSection(generatedTypes, language));

  // Entity Repositories
  if (domain.entities.length > 0) {
    sections.push(generateRepositoriesSection(domain.entities));
  }

  // Preconditions
  if (behavior.preconditions) {
    sections.push(generatePreconditionsSection(behavior));
  }

  // Postconditions
  if (behavior.postconditions) {
    sections.push(generatePostconditionsSection(behavior));
  }

  // Invariants
  if (behavior.invariants && behavior.invariants.length > 0) {
    sections.push(generateInvariantsSection(behavior));
  }

  // Error Cases
  if (behavior.output?.errors && behavior.output.errors.length > 0) {
    sections.push(generateErrorsSection(behavior));
  }

  // Temporal Requirements
  if (behavior.temporal) {
    sections.push(generateTemporalSection(behavior));
  }

  // Security Requirements
  if (behavior.security) {
    sections.push(generateSecuritySection(behavior));
  }

  // Implementation Skeleton
  sections.push(generateSkeletonSection(behavior, language));

  // Final instruction
  sections.push('Generate the complete implementation following the structure above. Ensure ALL preconditions are validated and ALL postconditions hold on success.');

  return sections.join('\n\n');
}

function generateHeader(domain: DomainDeclaration, behavior: BehaviorDeclaration): string {
  return `# Implementation Request

Generate an implementation for the \`${behavior.name.name}\` behavior from the \`${domain.name.name}\` domain.

${behavior.description ? `**Description:** ${behavior.description.value}` : ''}`;
}

function generateISLSection(behavior: BehaviorDeclaration): string {
  return `## ISL Specification

\`\`\`isl
${behaviorToISL(behavior)}
\`\`\``;
}

function generateTypesSection(types: string, language: string): string {
  return `## ${language} Types

Use these exact types in your implementation:

\`\`\`${language.toLowerCase()}
${types}
\`\`\``;
}

function generateRepositoriesSection(entities: EntityDeclaration[]): string {
  const repos = entities.map(e => 
    `- \`${e.name.name}Repository\`: CRUD operations for ${e.name.name} entity
  - \`find(id: string)\`: Find by ID
  - \`findBy(criteria: object)\`: Find by criteria
  - \`create(data: object)\`: Create new entity
  - \`update(id: string, data: object)\`: Update entity
  - \`delete(id: string)\`: Delete entity
  - \`count(criteria?: object)\`: Count entities`
  ).join('\n');

  return `## Entity Repositories

The following repositories are available as dependencies:

${repos}`;
}

function generatePreconditionsSection(behavior: BehaviorDeclaration): string {
  const conditions: string[] = [];
  
  if (behavior.preconditions) {
    for (const condition of behavior.preconditions.conditions) {
      for (const statement of condition.statements) {
        conditions.push(`- ${expressionToReadable(statement.expression)}`);
      }
    }
  }

  return `## Preconditions

The implementation MUST validate ALL of these BEFORE executing business logic:

${conditions.join('\n')}

**Important:** If ANY precondition fails, throw an appropriate error immediately. Do not proceed with partial validation.`;
}

function generatePostconditionsSection(behavior: BehaviorDeclaration): string {
  const sections: string[] = [];

  if (behavior.postconditions) {
    for (const condition of behavior.postconditions.conditions) {
      const guard = condition.guard;
      const header = guard === 'success' 
        ? '### On Success'
        : guard === 'failure'
        ? '### On Any Error'
        : `### On ${typeof guard === 'object' ? guard.name : guard}`;
      
      const items = condition.statements.map(s => 
        `- ${expressionToReadable(s.expression)}`
      ).join('\n');

      sections.push(`${header}\n${items}`);
    }
  }

  return `## Postconditions

The following conditions MUST hold after execution:

${sections.join('\n\n')}

**Important:** These are contractual guarantees. The implementation MUST ensure they hold.`;
}

function generateInvariantsSection(behavior: BehaviorDeclaration): string {
  const invariants = behavior.invariants?.map(inv => 
    `- ${expressionToReadable(inv.expression)}`
  ).join('\n') ?? '';

  return `## Invariants

These conditions MUST hold throughout execution:

${invariants}

**Important:** If any invariant is violated at any point, throw an InvariantViolationError.`;
}

function generateErrorsSection(behavior: BehaviorDeclaration): string {
  const errors = behavior.output?.errors.map(error => {
    const parts = [`### ${error.name.name}`];
    if (error.when) {
      parts.push(`**When:** ${error.when.value}`);
    }
    if (error.retriable !== undefined) {
      parts.push(`**Retriable:** ${error.retriable}`);
    }
    if (error.retryAfter) {
      parts.push(`**Retry After:** ${expressionToReadable(error.retryAfter)}`);
    }
    return parts.join('\n');
  }).join('\n\n') ?? '';

  return `## Error Cases

Handle these error conditions explicitly:

${errors}

**Implementation Pattern:**
\`\`\`typescript
throw new BehaviorError({
  code: 'ERROR_CODE',
  message: 'Human readable message',
  retriable: true | false,
  retryAfter: milliseconds | undefined
});
\`\`\``;
}

function generateTemporalSection(behavior: BehaviorDeclaration): string {
  const requirements = behavior.temporal?.requirements.map(req => {
    const duration = req.duration ? `${req.duration.value}${req.duration.unit}` : '';
    const percentile = req.percentile ? ` (${req.percentile})` : '';
    const condition = expressionToReadable(req.condition);
    
    switch (req.type) {
      case 'within':
        return `- Response within ${duration}${percentile}`;
      case 'eventually':
        return `- Eventually${duration ? ` within ${duration}` : ''}: ${condition}`;
      case 'immediately':
        return `- Immediately: ${condition}`;
      case 'never':
        return `- Never: ${condition}`;
      case 'always':
        return `- Always: ${condition}`;
      default:
        return `- ${req.type}: ${condition}`;
    }
  }).join('\n') ?? '';

  return `## Temporal Requirements

${requirements}

**Implementation:** Use timeouts and async patterns to meet these requirements.`;
}

function generateSecuritySection(behavior: BehaviorDeclaration): string {
  const requirements = behavior.security?.requirements.map(req =>
    `- **${req.type}:** ${expressionToReadable(req.expression)}`
  ).join('\n') ?? '';

  return `## Security Requirements

${requirements}

**Important:** These security constraints are non-negotiable.`;
}

function generateSkeletonSection(behavior: BehaviorDeclaration, language: string): string {
  const name = behavior.name.name;
  const funcName = name.charAt(0).toLowerCase() + name.slice(1);

  const skeleton = language.toLowerCase() === 'typescript' || language.toLowerCase() === 'ts'
    ? `interface ${name}Dependencies {
  // Repository dependencies injected here
}

export function create${name}(deps: ${name}Dependencies) {
  return async function ${funcName}(input: ${name}Input): Promise<${name}Result> {
    // Step 1: Validate ALL preconditions
    // - Throw BehaviorError if any fail
    
    // Step 2: Execute business logic
    // - Implement the core behavior
    // - Handle each error case explicitly
    
    // Step 3: Verify postconditions (on success path)
    // - Assert success conditions hold
    
    // Step 4: Return typed result
    return { success: true, data: /* result */ };
  };
}`
    : `async function ${funcName}(input, deps) {
  // Step 1: Validate ALL preconditions
  // Step 2: Execute business logic
  // Step 3: Verify postconditions
  // Step 4: Return result
}`;

  return `## Expected Implementation Structure

\`\`\`${language.toLowerCase()}
${skeleton}
\`\`\``;
}

/**
 * Convert behavior to ISL string representation
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
      const opt = field.optional ? '?' : '';
      const anns = field.annotations.length > 0 
        ? ` [${field.annotations.map(a => a.name.name).join(', ')}]`
        : '';
      lines.push(`    ${field.name.name}: ${typeToString(field.type)}${opt}${anns}`);
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
        const parts = [error.name.name];
        if (error.retriable !== undefined) {
          parts.push(`retriable: ${error.retriable}`);
        }
        lines.push(`      ${parts.join(', ')}`);
      }
      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.preconditions) {
    lines.push('  preconditions {');
    for (const cond of behavior.preconditions.conditions) {
      for (const stmt of cond.statements) {
        lines.push(`    ${expressionToReadable(stmt.expression)}`);
      }
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.postconditions) {
    lines.push('  postconditions {');
    for (const cond of behavior.postconditions.conditions) {
      const guard = cond.guard;
      const guardStr = guard === 'success' || guard === 'failure' 
        ? guard 
        : typeof guard === 'object' ? guard.name : String(guard);
      lines.push(`    ${guardStr} implies {`);
      for (const stmt of cond.statements) {
        lines.push(`      ${expressionToReadable(stmt.expression)}`);
      }
      lines.push('    }');
    }
    lines.push('  }');
    lines.push('');
  }
  
  if (behavior.invariants && behavior.invariants.length > 0) {
    lines.push('  invariants {');
    for (const inv of behavior.invariants) {
      lines.push(`    ${expressionToReadable(inv.expression)}`);
    }
    lines.push('  }');
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Convert expression to readable string
 */
export function expressionToReadable(expr: Expression): string {
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
    case 'DurationLiteral':
      return `${expr.value}${expr.unit}`;
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
    case 'QuantifiedExpression':
      return `${expr.quantifier}(${expr.variable.name} in ${expressionToReadable(expr.collection)}: ${expressionToReadable(expr.predicate)})`;
    default:
      return '<expression>';
  }
}

/**
 * Convert type expression to string
 */
export function typeToString(type: TypeExpression): string {
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
    case 'ObjectType':
      const fields = type.fields.map(f => 
        `${f.name.name}: ${typeToString(f.type)}`
      ).join('; ');
      return `{ ${fields} }`;
    default:
      return 'unknown';
  }
}

/**
 * Generate TypeScript types from a domain for prompt context
 */
export function generateTypesFromDomain(domain: DomainDeclaration, language: string): string {
  if (language.toLowerCase() !== 'typescript' && language.toLowerCase() !== 'ts') {
    return '// Types generated from ISL specification';
  }

  const lines: string[] = [];
  
  // Custom type definitions
  for (const typeDef of domain.types) {
    lines.push(`type ${typeDef.name.name} = ${typeToTS(typeDef.baseType)};`);
  }
  if (domain.types.length > 0) lines.push('');
  
  // Enum definitions
  for (const enumDef of domain.enums) {
    lines.push(`type ${enumDef.name.name} = ${enumDef.variants.map(v => `'${v.name}'`).join(' | ')};`);
  }
  if (domain.enums.length > 0) lines.push('');
  
  // Entity interfaces
  for (const entity of domain.entities) {
    lines.push(`interface ${entity.name.name} {`);
    for (const field of entity.fields) {
      const opt = field.optional ? '?' : '';
      const tsType = typeToTS(field.type);
      lines.push(`  ${field.name.name}${opt}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }
  
  // Behavior types
  for (const behavior of domain.behaviors) {
    const name = behavior.name.name;
    
    // Input type
    if (behavior.input) {
      lines.push(`interface ${name}Input {`);
      for (const field of behavior.input.fields) {
        const opt = field.optional ? '?' : '';
        const tsType = typeToTS(field.type);
        lines.push(`  ${field.name.name}${opt}: ${tsType};`);
      }
      lines.push('}');
      lines.push('');
    }
    
    // Result type
    if (behavior.output) {
      const successType = typeToString(behavior.output.success);
      const errorCodes = behavior.output.errors.map(e => `'${e.name.name}'`);
      const errorUnion = errorCodes.length > 0 ? errorCodes.join(' | ') : 'string';
      
      lines.push(`type ${name}Result =`);
      lines.push(`  | { success: true; data: ${successType} }`);
      lines.push(`  | { success: false; error: { code: ${errorUnion}; message: string; retriable?: boolean; retryAfter?: number } };`);
      lines.push('');
    }
    
    // Function type
    lines.push(`type ${name}Function = (input: ${name}Input) => Promise<${name}Result>;`);
    lines.push('');
  }
  
  return lines.join('\n');
}

function typeToTS(type: TypeExpression): string {
  const primitiveMap: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Decimal': 'number',
    'Boolean': 'boolean',
    'UUID': 'string',
    'Email': 'string',
    'Timestamp': 'Date',
    'Duration': 'number',
  };
  
  if (type.kind === 'SimpleType') {
    return primitiveMap[type.name.name] ?? type.name.name;
  }
  
  if (type.kind === 'ArrayType') {
    return `${typeToTS(type.elementType)}[]`;
  }
  
  if (type.kind === 'GenericType') {
    if (type.name.name === 'List') {
      return `${typeToTS(type.typeArguments[0]!)}[]`;
    }
    if (type.name.name === 'Map') {
      return `Map<${typeToTS(type.typeArguments[0]!)}, ${typeToTS(type.typeArguments[1]!)}>`;
    }
    if (type.name.name === 'Optional') {
      return `${typeToTS(type.typeArguments[0]!)} | null`;
    }
  }
  
  return typeToString(type);
}
