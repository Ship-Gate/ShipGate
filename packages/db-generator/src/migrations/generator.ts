/**
 * Migration Generator
 * 
 * Generates database migrations from ISL entity changes.
 */

import type { GeneratedFile, DomainSpec, EntitySpec, FieldSpec, DatabaseTable } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface MigrationOptions {
  /** Database dialect */
  dialect: 'postgres' | 'mysql' | 'sqlite';
  /** Migration format */
  format: 'sql' | 'knex' | 'typeorm';
  /** Previous schema version (for diff) */
  previousSchema?: DomainSpec;
  /** Migration name */
  name?: string;
}

export interface SchemaDiff {
  added: { type: 'table' | 'column' | 'index'; name: string; details: unknown }[];
  removed: { type: 'table' | 'column' | 'index'; name: string }[];
  modified: { type: 'column'; name: string; from: unknown; to: unknown }[];
}

// ============================================================================
// Migration Generator
// ============================================================================

export class MigrationGenerator {
  private options: MigrationOptions;

  constructor(options: MigrationOptions) {
    this.options = options;
  }

  /**
   * Generate migrations
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const timestamp = this.getTimestamp();
    const name = this.options.name || 'auto_migration';

    if (this.options.previousSchema) {
      // Generate diff-based migration
      const diff = this.calculateDiff(this.options.previousSchema, domain);
      return this.generateDiffMigration(diff, timestamp, name);
    } else {
      // Generate full schema migration
      return this.generateFullMigration(domain, timestamp, name);
    }
  }

  /**
   * Calculate schema diff
   */
  calculateDiff(previous: DomainSpec, current: DomainSpec): SchemaDiff {
    const diff: SchemaDiff = { added: [], removed: [], modified: [] };

    const prevEntities = new Map(previous.entities.map(e => [e.name, e]));
    const currEntities = new Map(current.entities.map(e => [e.name, e]));

    // Find added tables
    for (const [name, entity] of currEntities) {
      if (!prevEntities.has(name)) {
        diff.added.push({ type: 'table', name, details: entity });
      }
    }

    // Find removed tables
    for (const [name] of prevEntities) {
      if (!currEntities.has(name)) {
        diff.removed.push({ type: 'table', name });
      }
    }

    // Find modified tables (column changes)
    for (const [name, currEntity] of currEntities) {
      const prevEntity = prevEntities.get(name);
      if (!prevEntity) continue;

      const prevFields = new Map(prevEntity.fields.map(f => [f.name, f]));
      const currFields = new Map(currEntity.fields.map(f => [f.name, f]));

      // Added columns
      for (const [fieldName, field] of currFields) {
        if (!prevFields.has(fieldName)) {
          diff.added.push({ type: 'column', name: `${name}.${fieldName}`, details: field });
        }
      }

      // Removed columns
      for (const [fieldName] of prevFields) {
        if (!currFields.has(fieldName)) {
          diff.removed.push({ type: 'column', name: `${name}.${fieldName}` });
        }
      }

      // Modified columns
      for (const [fieldName, currField] of currFields) {
        const prevField = prevFields.get(fieldName);
        if (prevField && this.fieldsAreDifferent(prevField, currField)) {
          diff.modified.push({
            type: 'column',
            name: `${name}.${fieldName}`,
            from: prevField,
            to: currField,
          });
        }
      }
    }

    return diff;
  }

  /**
   * Generate diff-based migration
   */
  private generateDiffMigration(diff: SchemaDiff, timestamp: string, name: string): GeneratedFile[] {
    switch (this.options.format) {
      case 'sql':
        return this.generateSQLDiffMigration(diff, timestamp, name);
      case 'knex':
        return this.generateKnexMigration(diff, timestamp, name);
      default:
        return this.generateSQLDiffMigration(diff, timestamp, name);
    }
  }

  /**
   * Generate SQL diff migration
   */
  private generateSQLDiffMigration(diff: SchemaDiff, timestamp: string, name: string): GeneratedFile[] {
    const upLines: string[] = [
      `-- Migration: ${name}`,
      `-- Generated: ${new Date().toISOString()}`,
      '',
    ];

    const downLines: string[] = [
      `-- Rollback: ${name}`,
      '',
    ];

    // Handle additions
    for (const add of diff.added) {
      if (add.type === 'table') {
        upLines.push(`-- Create table ${add.name}`);
        upLines.push(this.generateCreateTableSQL(add.details as EntitySpec));
        downLines.push(`DROP TABLE IF EXISTS "${this.toSnakeCase(add.name)}";`);
      } else if (add.type === 'column') {
        const [table, column] = add.name.split('.');
        if (table && column) {
          const field = add.details as FieldSpec;
          upLines.push(`ALTER TABLE "${this.toSnakeCase(table)}" ADD COLUMN "${this.toSnakeCase(column)}" ${this.fieldToSQLType(field)};`);
          downLines.push(`ALTER TABLE "${this.toSnakeCase(table)}" DROP COLUMN "${this.toSnakeCase(column)}";`);
        }
      }
    }

    // Handle removals
    for (const remove of diff.removed) {
      if (remove.type === 'table') {
        upLines.push(`DROP TABLE IF EXISTS "${this.toSnakeCase(remove.name)}";`);
      } else if (remove.type === 'column') {
        const [table, column] = remove.name.split('.');
        if (table && column) {
          upLines.push(`ALTER TABLE "${this.toSnakeCase(table)}" DROP COLUMN "${this.toSnakeCase(column)}";`);
        }
      }
    }

    // Handle modifications
    for (const mod of diff.modified) {
      const [table, column] = mod.name.split('.');
      const toField = mod.to as FieldSpec;
      if (table && column) {
        upLines.push(`ALTER TABLE "${this.toSnakeCase(table)}" ALTER COLUMN "${this.toSnakeCase(column)}" TYPE ${this.fieldToSQLType(toField)};`);
      }
    }

    return [
      { path: `migrations/${timestamp}_${name}.up.sql`, content: upLines.join('\n'), type: 'migration' },
      { path: `migrations/${timestamp}_${name}.down.sql`, content: downLines.join('\n'), type: 'migration' },
    ];
  }

  /**
   * Generate Knex migration
   */
  private generateKnexMigration(diff: SchemaDiff, timestamp: string, name: string): GeneratedFile[] {
    const lines = [
      `// Migration: ${name}`,
      "import { Knex } from 'knex';",
      '',
      'export async function up(knex: Knex): Promise<void> {',
    ];

    for (const add of diff.added) {
      if (add.type === 'table') {
        const entity = add.details as EntitySpec;
        lines.push(`  await knex.schema.createTable('${this.toSnakeCase(add.name)}', (table) => {`);
        for (const field of entity.fields) {
          lines.push(`    ${this.fieldToKnex(field)};`);
        }
        lines.push('  });');
      }
    }

    lines.push('}');
    lines.push('');
    lines.push('export async function down(knex: Knex): Promise<void> {');

    for (const add of diff.added) {
      if (add.type === 'table') {
        lines.push(`  await knex.schema.dropTableIfExists('${this.toSnakeCase(add.name)}');`);
      }
    }

    lines.push('}');

    return [{
      path: `migrations/${timestamp}_${name}.ts`,
      content: lines.join('\n'),
      type: 'migration',
    }];
  }

  /**
   * Generate full schema migration
   */
  private generateFullMigration(domain: DomainSpec, timestamp: string, name: string): GeneratedFile[] {
    // Create a diff from empty to full schema
    const diff: SchemaDiff = {
      added: domain.entities.map(e => ({ type: 'table' as const, name: e.name, details: e })),
      removed: [],
      modified: [],
    };
    return this.generateDiffMigration(diff, timestamp, name);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getTimestamp(): string {
    return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  }

  private fieldsAreDifferent(a: FieldSpec, b: FieldSpec): boolean {
    return a.type !== b.type || a.optional !== b.optional;
  }

  private generateCreateTableSQL(entity: EntitySpec): string {
    const tableName = this.toSnakeCase(entity.name);
    const columns = entity.fields.map(f => {
      const colName = this.toSnakeCase(f.name);
      const type = this.fieldToSQLType(f);
      const nullable = f.optional ? '' : ' NOT NULL';
      const pk = f.name === 'id' ? ' PRIMARY KEY' : '';
      return `  "${colName}" ${type}${pk}${nullable}`;
    });

    return `CREATE TABLE "${tableName}" (\n${columns.join(',\n')}\n);`;
  }

  private fieldToSQLType(field: FieldSpec): string {
    switch (field.type) {
      case 'String': return 'TEXT';
      case 'Int': return 'INTEGER';
      case 'Decimal': return 'DECIMAL(10,2)';
      case 'Boolean': return 'BOOLEAN';
      case 'UUID': return this.options.dialect === 'postgres' ? 'UUID' : 'VARCHAR(36)';
      case 'Timestamp': return 'TIMESTAMPTZ';
      default: return 'TEXT';
    }
  }

  private fieldToKnex(field: FieldSpec): string {
    const name = this.toSnakeCase(field.name);
    switch (field.type) {
      case 'String': return `table.text('${name}')`;
      case 'Int': return `table.integer('${name}')`;
      case 'Decimal': return `table.decimal('${name}', 10, 2)`;
      case 'Boolean': return `table.boolean('${name}')`;
      case 'UUID': return field.name === 'id' ? `table.uuid('${name}').primary()` : `table.uuid('${name}')`;
      case 'Timestamp': return `table.timestamp('${name}')`;
      default: return `table.text('${name}')`;
    }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}

export function generateMigrations(domain: DomainSpec, options: MigrationOptions): GeneratedFile[] {
  return new MigrationGenerator(options).generate(domain);
}
