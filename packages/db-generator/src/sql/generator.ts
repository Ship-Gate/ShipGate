/**
 * SQL Generator
 * 
 * Generates raw SQL DDL statements from ISL entities.
 */

import type { GeneratedFile, DomainSpec, EntitySpec, FieldSpec, DatabaseTable, Column, Index, ForeignKey } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface SQLOptions {
  /** Database dialect */
  dialect: 'postgres' | 'mysql' | 'sqlite';
  /** Schema name */
  schema?: string;
  /** Include DROP statements */
  dropTables?: boolean;
  /** Output prefix */
  outputPrefix?: string;
}

// ============================================================================
// SQL Generator
// ============================================================================

export class SQLGenerator {
  private options: Required<SQLOptions>;

  constructor(options: SQLOptions) {
    this.options = {
      dialect: options.dialect,
      schema: options.schema || 'public',
      dropTables: options.dropTables ?? false,
      outputPrefix: options.outputPrefix || '',
    };
  }

  /**
   * Generate SQL from domain spec
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const tables = domain.entities.map(e => this.entityToTable(e));
    
    const createStatements = tables.map(t => this.generateCreateTable(t));
    const indexStatements = tables.flatMap(t => this.generateIndexes(t));
    const fkStatements = tables.flatMap(t => this.generateForeignKeys(t));

    const lines = [
      '-- ============================================================',
      `-- Generated SQL for ${domain.name} v${domain.version}`,
      '-- DO NOT EDIT - Auto-generated from ISL',
      '-- ============================================================',
      '',
    ];

    if (this.options.dropTables) {
      lines.push('-- Drop existing tables');
      for (const table of [...tables].reverse()) {
        lines.push(`DROP TABLE IF EXISTS ${this.quote(table.name)} CASCADE;`);
      }
      lines.push('');
    }

    lines.push('-- Create tables');
    lines.push(...createStatements);
    lines.push('');
    lines.push('-- Create indexes');
    lines.push(...indexStatements);
    lines.push('');
    lines.push('-- Create foreign keys');
    lines.push(...fkStatements);

    return [{
      path: `${this.options.outputPrefix}schema.sql`,
      content: lines.join('\n'),
      type: 'schema',
    }];
  }

  /**
   * Convert entity to database table
   */
  private entityToTable(entity: EntitySpec): DatabaseTable {
    const columns: Column[] = [];
    const foreignKeys: ForeignKey[] = [];
    const indexes: Index[] = [];

    for (const field of entity.fields) {
      const column = this.fieldToColumn(field);
      columns.push(column);

      if (field.references) {
        foreignKeys.push({
          name: `fk_${this.toSnakeCase(entity.name)}_${field.name}`,
          columns: [field.name],
          referencedTable: this.toSnakeCase(field.references.entity),
          referencedColumns: [field.references.field],
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        });
      }

      // Auto-create index for foreign keys
      if (field.references) {
        indexes.push({
          name: `idx_${this.toSnakeCase(entity.name)}_${field.name}`,
          columns: [field.name],
          unique: false,
        });
      }
    }

    // Add entity indexes
    if (entity.indexes) {
      for (const idx of entity.indexes) {
        indexes.push({
          name: idx.name || `idx_${this.toSnakeCase(entity.name)}_${idx.fields.join('_')}`,
          columns: idx.fields,
          unique: idx.unique,
        });
      }
    }

    return {
      name: this.toSnakeCase(entity.name),
      columns,
      primaryKey: columns.filter(c => c.primaryKey).map(c => c.name),
      indexes,
      foreignKeys,
    };
  }

  /**
   * Convert field to column
   */
  private fieldToColumn(field: FieldSpec): Column {
    return {
      name: this.toSnakeCase(field.name),
      type: this.fieldTypeToSQL(field),
      nullable: field.optional,
      primaryKey: field.annotations.includes('unique') && field.name === 'id',
      unique: field.annotations.includes('unique'),
      default: this.getDefaultValue(field),
      references: field.references ? {
        table: this.toSnakeCase(field.references.entity),
        column: field.references.field,
      } : undefined,
    };
  }

  /**
   * Convert ISL type to SQL type
   */
  private fieldTypeToSQL(field: FieldSpec): string {
    const maxLength = field.constraints.find(c => c.name === 'max_length')?.value as number | undefined;

    switch (field.type) {
      case 'String':
        return maxLength ? `VARCHAR(${maxLength})` : 'TEXT';
      case 'Int':
        return this.options.dialect === 'postgres' ? 'INTEGER' : 'INT';
      case 'Decimal':
        const precision = field.constraints.find(c => c.name === 'precision')?.value || 10;
        const scale = field.constraints.find(c => c.name === 'scale')?.value || 2;
        return `DECIMAL(${precision}, ${scale})`;
      case 'Boolean':
        return 'BOOLEAN';
      case 'UUID':
        return this.options.dialect === 'postgres' ? 'UUID' : 'CHAR(36)';
      case 'Timestamp':
        return this.options.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';
      default:
        return 'TEXT';
    }
  }

  /**
   * Get default value for field
   */
  private getDefaultValue(field: FieldSpec): string | undefined {
    if (field.type === 'UUID' && field.annotations.includes('immutable')) {
      return this.options.dialect === 'postgres' ? 'gen_random_uuid()' : undefined;
    }
    if (field.type === 'Timestamp' && field.name.includes('created')) {
      return this.options.dialect === 'postgres' ? 'NOW()' : 'CURRENT_TIMESTAMP';
    }
    return undefined;
  }

  /**
   * Generate CREATE TABLE statement
   */
  private generateCreateTable(table: DatabaseTable): string {
    const lines = [`CREATE TABLE ${this.quote(table.name)} (`];

    const columnDefs = table.columns.map(col => {
      let def = `  ${this.quote(col.name)} ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (!col.nullable && !col.primaryKey) def += ' NOT NULL';
      if (col.unique && !col.primaryKey) def += ' UNIQUE';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    });

    lines.push(columnDefs.join(',\n'));
    lines.push(');');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate indexes
   */
  private generateIndexes(table: DatabaseTable): string[] {
    return table.indexes.map(idx => {
      const unique = idx.unique ? 'UNIQUE ' : '';
      const columns = idx.columns.map(c => this.quote(c)).join(', ');
      return `CREATE ${unique}INDEX ${idx.name} ON ${this.quote(table.name)} (${columns});`;
    });
  }

  /**
   * Generate foreign keys
   */
  private generateForeignKeys(table: DatabaseTable): string[] {
    return table.foreignKeys.map(fk => {
      const columns = fk.columns.map(c => this.quote(c)).join(', ');
      const refColumns = fk.referencedColumns.map(c => this.quote(c)).join(', ');
      return `ALTER TABLE ${this.quote(table.name)} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${columns}) REFERENCES ${this.quote(fk.referencedTable)} (${refColumns}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`;
    });
  }

  /**
   * Quote identifier
   */
  private quote(name: string): string {
    switch (this.options.dialect) {
      case 'postgres': return `"${name}"`;
      case 'mysql': return `\`${name}\``;
      default: return `"${name}"`;
    }
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}

export function generateSQL(domain: DomainSpec, options: SQLOptions): GeneratedFile[] {
  return new SQLGenerator(options).generate(domain);
}
