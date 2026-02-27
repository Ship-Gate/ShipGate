/**
 * Drizzle Schema Generator
 * 
 * Generates Drizzle ORM schema from ISL entities.
 */

import type { GeneratedFile, DomainSpec, EntitySpec, FieldSpec } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface DrizzleOptions {
  /** Database dialect */
  dialect: 'postgres' | 'mysql' | 'sqlite';
  /** Output prefix */
  outputPrefix?: string;
}

// ============================================================================
// Drizzle Generator
// ============================================================================

export class DrizzleGenerator {
  private options: Required<DrizzleOptions>;

  constructor(options: DrizzleOptions) {
    this.options = {
      dialect: options.dialect,
      outputPrefix: options.outputPrefix || '',
    };
  }

  /**
   * Generate Drizzle schema
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const dialectModule = this.getDialectModule();
    const columnTypes = this.getColumnTypes();

    const lines = [
      '/**',
      ` * Generated Drizzle Schema for ${domain.name}`,
      ' * DO NOT EDIT - Auto-generated from ISL',
      ' */',
      '',
      `import { ${dialectModule} } from 'drizzle-orm/${this.options.dialect}-core';`,
      `import { ${columnTypes.join(', ')} } from 'drizzle-orm/${this.options.dialect}-core';`,
      "import { relations } from 'drizzle-orm';",
      '',
    ];

    // Generate tables
    for (const entity of domain.entities) {
      lines.push(...this.generateTable(entity));
      lines.push('');
    }

    // Generate relations
    for (const entity of domain.entities) {
      const relations = this.generateRelations(entity, domain.entities);
      if (relations.length > 0) {
        lines.push(...relations);
        lines.push('');
      }
    }

    // Export all tables
    lines.push('// Export all tables');
    lines.push('export const tables = {');
    for (const entity of domain.entities) {
      lines.push(`  ${this.toCamelCase(entity.name)}: ${this.toCamelCase(entity.name)},`);
    }
    lines.push('};');

    return [{
      path: `${this.options.outputPrefix}schema.ts`,
      content: lines.join('\n'),
      type: 'schema',
    }];
  }

  /**
   * Generate Drizzle table
   */
  private generateTable(entity: EntitySpec): string[] {
    const tableName = this.toSnakeCase(entity.name);
    const varName = this.toCamelCase(entity.name);

    const lines = [
      `export const ${varName} = ${this.getDialectModule()}('${tableName}', {`,
    ];

    for (const field of entity.fields) {
      lines.push(`  ${this.generateColumn(field)},`);
    }

    lines.push('});');

    return lines;
  }

  /**
   * Generate Drizzle column
   */
  private generateColumn(field: FieldSpec): string {
    const columnName = this.toSnakeCase(field.name);
    const parts: string[] = [];

    // Column definition
    let def = this.getColumnDefinition(field, columnName);
    parts.push(`${field.name}: ${def}`);

    // Add constraints
    const constraints: string[] = [];

    if (field.name === 'id' && field.type === 'UUID') {
      constraints.push('primaryKey()');
      constraints.push('defaultRandom()');
    }

    if (field.annotations.includes('unique')) {
      constraints.push('unique()');
    }

    if (!field.optional && field.name !== 'id') {
      constraints.push('notNull()');
    }

    if (field.type === 'Timestamp' && field.name.includes('created')) {
      constraints.push('defaultNow()');
    }

    if (constraints.length > 0) {
      return `${parts[0]}.${constraints.join('.')}`;
    }

    return parts[0] || '';
  }

  /**
   * Get column definition based on type
   */
  private getColumnDefinition(field: FieldSpec, columnName: string): string {
    switch (field.type) {
      case 'String':
        const maxLen = field.constraints.find(c => c.name === 'max_length')?.value as number | undefined;
        return maxLen ? `varchar('${columnName}', { length: ${maxLen} })` : `text('${columnName}')`;
      case 'Int':
        return `integer('${columnName}')`;
      case 'Decimal':
        const precision = field.constraints.find(c => c.name === 'precision')?.value || 10;
        const scale = field.constraints.find(c => c.name === 'scale')?.value || 2;
        return `decimal('${columnName}', { precision: ${precision}, scale: ${scale} })`;
      case 'Boolean':
        return `boolean('${columnName}')`;
      case 'UUID':
        return this.options.dialect === 'postgres' ? `uuid('${columnName}')` : `varchar('${columnName}', { length: 36 })`;
      case 'Timestamp':
        return this.options.dialect === 'postgres' ? `timestamp('${columnName}', { withTimezone: true })` : `timestamp('${columnName}')`;
      default:
        return `text('${columnName}')`;
    }
  }

  /**
   * Generate relations
   */
  private generateRelations(entity: EntitySpec, allEntities: EntitySpec[]): string[] {
    const refs = entity.fields.filter(f => f.references);
    if (refs.length === 0) return [];

    const varName = this.toCamelCase(entity.name);
    const lines = [
      `export const ${varName}Relations = relations(${varName}, ({ one, many }) => ({`,
    ];

    for (const field of refs) {
      if (!field.references) continue;
      const refVar = this.toCamelCase(field.references.entity);
      lines.push(`  ${field.name.replace('_id', '').replace('Id', '')}: one(${refVar}, {`);
      lines.push(`    fields: [${varName}.${field.name}],`);
      lines.push(`    references: [${refVar}.${field.references.field}],`);
      lines.push('  }),');
    }

    lines.push('}));');
    return lines;
  }

  /**
   * Get dialect module name
   */
  private getDialectModule(): string {
    switch (this.options.dialect) {
      case 'postgres': return 'pgTable';
      case 'mysql': return 'mysqlTable';
      case 'sqlite': return 'sqliteTable';
    }
  }

  /**
   * Get column type imports
   */
  private getColumnTypes(): string[] {
    switch (this.options.dialect) {
      case 'postgres':
        return ['uuid', 'varchar', 'text', 'integer', 'decimal', 'boolean', 'timestamp'];
      case 'mysql':
        return ['varchar', 'text', 'int', 'decimal', 'boolean', 'timestamp', 'datetime'];
      case 'sqlite':
        return ['text', 'integer', 'real', 'blob'];
      default:
        return [];
    }
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}

export function generateDrizzleSchema(domain: DomainSpec, options: DrizzleOptions): GeneratedFile[] {
  return new DrizzleGenerator(options).generate(domain);
}
