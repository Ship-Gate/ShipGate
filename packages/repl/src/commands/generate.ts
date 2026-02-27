// ============================================================================
// Generate Command
// Generate code from the current domain
// ============================================================================

import type { Domain, CommandResult } from '../types.js';
import { formatType } from '../formatter.js';

/**
 * Generation targets
 */
export type GenerateTarget = 'types' | 'tests' | 'docs' | 'api' | 'schema';

/**
 * Generate command handler
 */
export function generateCommand(
  target: string | undefined,
  domain: Domain | null
): CommandResult {
  if (!domain) {
    return {
      success: false,
      error: 'No domain loaded. Use :load <file.isl> first.',
    };
  }

  if (!target) {
    return {
      success: false,
      error: 'Usage: :generate <types|tests|docs|api|schema>',
    };
  }

  switch (target) {
    case 'types':
      return generateTypes(domain);
    case 'tests':
      return generateTests(domain);
    case 'docs':
      return generateDocs(domain);
    case 'api':
      return generateApi(domain);
    case 'schema':
      return generateSchema(domain);
    default:
      return {
        success: false,
        error: `Unknown generate target: ${target}. Use: types, tests, docs, api, schema`,
      };
  }
}

/**
 * Generate TypeScript types
 */
function generateTypes(domain: Domain): CommandResult {
  const lines: string[] = [];
  
  lines.push('// Generated TypeScript types');
  lines.push(`// Domain: ${domain.name.name} v${domain.version.value}`);
  lines.push('');

  // Generate entity types
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name.name} {`);
    for (const field of entity.fields) {
      const optional = field.optional ? '?' : '';
      const tsType = islTypeToTs(field.type);
      lines.push(`  ${field.name.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // Generate behavior input/output types
  for (const behavior of domain.behaviors) {
    lines.push(`export interface ${behavior.name.name}Input {`);
    for (const field of behavior.input.fields) {
      const optional = field.optional ? '?' : '';
      const tsType = islTypeToTs(field.type);
      lines.push(`  ${field.name.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');

    lines.push(`export interface ${behavior.name.name}Output {`);
    lines.push(`  success: ${islTypeToTs(behavior.output.success)};`);
    lines.push('}');
    lines.push('');
  }

  // Generate custom types
  for (const type of domain.types) {
    lines.push(generateTypeDeclaration(type));
    lines.push('');
  }

  return {
    success: true,
    message: 'Generated TypeScript types:',
    data: lines.join('\n'),
  };
}

/**
 * Generate test stubs
 */
function generateTests(domain: Domain): CommandResult {
  const lines: string[] = [];
  
  lines.push('// Generated test stubs');
  lines.push(`// Domain: ${domain.name.name}`);
  lines.push('');
  lines.push("import { describe, it, expect } from 'vitest';");
  lines.push('');

  // Generate entity tests
  for (const entity of domain.entities) {
    lines.push(`describe('${entity.name.name}', () => {`);
    lines.push(`  it('should create a valid ${entity.name.name}', () => {`);
    lines.push('    // TODO: Implement test');
    lines.push('    expect(true).toBe(true);');
    lines.push('  });');
    lines.push('');
    
    if (entity.invariants.length > 0) {
      lines.push('  describe(\'invariants\', () => {');
      for (let i = 0; i < entity.invariants.length; i++) {
        lines.push(`    it('should satisfy invariant ${i + 1}', () => {`);
        lines.push('      // TODO: Test invariant');
        lines.push('      expect(true).toBe(true);');
        lines.push('    });');
      }
      lines.push('  });');
    }
    
    lines.push('});');
    lines.push('');
  }

  // Generate behavior tests
  for (const behavior of domain.behaviors) {
    lines.push(`describe('${behavior.name.name}', () => {`);
    
    lines.push(`  it('should succeed with valid input', async () => {`);
    lines.push('    // TODO: Implement test');
    lines.push('    expect(true).toBe(true);');
    lines.push('  });');
    lines.push('');

    // Tests for preconditions
    if (behavior.preconditions.length > 0) {
      lines.push('  describe(\'preconditions\', () => {');
      for (let i = 0; i < behavior.preconditions.length; i++) {
        lines.push(`    it('should fail when precondition ${i + 1} is not met', async () => {`);
        lines.push('      // TODO: Test precondition failure');
        lines.push('      expect(true).toBe(true);');
        lines.push('    });');
      }
      lines.push('  });');
      lines.push('');
    }

    // Tests for errors
    for (const error of behavior.output.errors) {
      lines.push(`  it('should return ${error.name.name} error when appropriate', async () => {`);
      lines.push('    // TODO: Test error case');
      lines.push('    expect(true).toBe(true);');
      lines.push('  });');
      lines.push('');
    }

    lines.push('});');
    lines.push('');
  }

  return {
    success: true,
    message: 'Generated test stubs:',
    data: lines.join('\n'),
  };
}

/**
 * Generate documentation
 */
function generateDocs(domain: Domain): CommandResult {
  const lines: string[] = [];
  
  lines.push(`# ${domain.name.name}`);
  lines.push('');
  lines.push(`Version: ${domain.version.value}`);
  if (domain.owner) {
    lines.push(`Owner: ${domain.owner.value}`);
  }
  lines.push('');

  // Entities
  lines.push('## Entities');
  lines.push('');
  for (const entity of domain.entities) {
    lines.push(`### ${entity.name.name}`);
    lines.push('');
    if (entity.description) {
      lines.push(entity.description.value);
      lines.push('');
    }
    
    lines.push('| Field | Type | Required |');
    lines.push('|-------|------|----------|');
    for (const field of entity.fields) {
      const type = formatType(field.type, { colors: false });
      const required = field.optional ? 'No' : 'Yes';
      lines.push(`| ${field.name.name} | ${type} | ${required} |`);
    }
    lines.push('');
  }

  // Behaviors
  lines.push('## Behaviors');
  lines.push('');
  for (const behavior of domain.behaviors) {
    lines.push(`### ${behavior.name.name}`);
    lines.push('');
    if (behavior.description) {
      lines.push(behavior.description.value);
      lines.push('');
    }

    lines.push('#### Input');
    lines.push('');
    if (behavior.input.fields.length > 0) {
      lines.push('| Field | Type | Required |');
      lines.push('|-------|------|----------|');
      for (const field of behavior.input.fields) {
        const type = formatType(field.type, { colors: false });
        const required = field.optional ? 'No' : 'Yes';
        lines.push(`| ${field.name.name} | ${type} | ${required} |`);
      }
    } else {
      lines.push('No input required.');
    }
    lines.push('');

    lines.push('#### Output');
    lines.push('');
    lines.push(`Success: ${formatType(behavior.output.success, { colors: false })}`);
    lines.push('');

    if (behavior.output.errors.length > 0) {
      lines.push('#### Errors');
      lines.push('');
      for (const error of behavior.output.errors) {
        const retriable = error.retriable ? ' (retriable)' : '';
        lines.push(`- **${error.name.name}**${retriable}`);
      }
      lines.push('');
    }
  }

  return {
    success: true,
    message: 'Generated documentation:',
    data: lines.join('\n'),
  };
}

/**
 * Generate API endpoints
 */
function generateApi(domain: Domain): CommandResult {
  const lines: string[] = [];
  
  lines.push('// Generated API endpoints');
  lines.push(`// Domain: ${domain.name.name}`);
  lines.push('');
  lines.push("import { Router } from 'express';");
  lines.push('');
  lines.push('const router = Router();');
  lines.push('');

  for (const behavior of domain.behaviors) {
    const path = `/${camelToKebab(behavior.name.name)}`;
    lines.push(`// ${behavior.name.name}`);
    lines.push(`router.post('${path}', async (req, res) => {`);
    lines.push('  try {');
    lines.push(`    // TODO: Implement ${behavior.name.name}`);
    lines.push('    const result = { success: true };');
    lines.push('    res.json(result);');
    lines.push('  } catch (error) {');
    lines.push("    res.status(500).json({ error: 'Internal server error' });");
    lines.push('  }');
    lines.push('});');
    lines.push('');
  }

  lines.push('export default router;');

  return {
    success: true,
    message: 'Generated API endpoints:',
    data: lines.join('\n'),
  };
}

/**
 * Generate database schema
 */
function generateSchema(domain: Domain): CommandResult {
  const lines: string[] = [];
  
  lines.push('-- Generated database schema');
  lines.push(`-- Domain: ${domain.name.name}`);
  lines.push('');

  for (const entity of domain.entities) {
    lines.push(`CREATE TABLE ${camelToSnake(entity.name.name)} (`);
    lines.push('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
    
    for (const field of entity.fields) {
      const sqlType = islTypeToSql(field.type);
      const nullable = field.optional ? '' : ' NOT NULL';
      lines.push(`  ${camelToSnake(field.name.name)} ${sqlType}${nullable},`);
    }
    
    lines.push('  created_at TIMESTAMP DEFAULT NOW(),');
    lines.push('  updated_at TIMESTAMP DEFAULT NOW()');
    lines.push(');');
    lines.push('');
  }

  return {
    success: true,
    message: 'Generated database schema:',
    data: lines.join('\n'),
  };
}

/**
 * Convert ISL type to TypeScript
 */
function islTypeToTs(type: Domain['types'][0]['definition']): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'Timestamp': return 'Date';
        case 'UUID': return 'string';
        case 'Duration': return 'number';
        default: return 'unknown';
      }
    case 'ReferenceType':
      return type.name.name;
    case 'ListType':
      return `${islTypeToTs(type.element)}[]`;
    case 'MapType':
      return `Record<${islTypeToTs(type.key)}, ${islTypeToTs(type.value)}>`;
    case 'OptionalType':
      return `${islTypeToTs(type.inner)} | null`;
    default:
      return 'unknown';
  }
}

/**
 * Convert ISL type to SQL
 */
function islTypeToSql(type: Domain['types'][0]['definition']): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'TEXT';
        case 'Int': return 'INTEGER';
        case 'Decimal': return 'DECIMAL';
        case 'Boolean': return 'BOOLEAN';
        case 'Timestamp': return 'TIMESTAMP';
        case 'UUID': return 'UUID';
        case 'Duration': return 'INTEGER';
        default: return 'TEXT';
      }
    case 'ReferenceType':
      return 'UUID REFERENCES ' + camelToSnake(type.name.name) + '(id)';
    default:
      return 'JSONB';
  }
}

/**
 * Generate type declaration
 */
function generateTypeDeclaration(type: Domain['types'][0]): string {
  const name = type.name.name;
  const def = type.definition;

  switch (def.kind) {
    case 'EnumType':
      const variants = def.variants.map(v => `'${v.name.name}'`).join(' | ');
      return `export type ${name} = ${variants};`;
    
    case 'StructType':
      const fields = def.fields.map(f => {
        const opt = f.optional ? '?' : '';
        return `  ${f.name.name}${opt}: ${islTypeToTs(f.type)};`;
      }).join('\n');
      return `export interface ${name} {\n${fields}\n}`;
    
    default:
      return `export type ${name} = ${islTypeToTs(def)};`;
  }
}

/**
 * Convert camelCase to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}
