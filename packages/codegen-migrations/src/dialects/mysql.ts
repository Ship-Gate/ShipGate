// ============================================================================
// MySQL Dialect
// ============================================================================

import type {
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  EnumDefinition,
  ConstraintDefinition,
  GenerateOptions,
} from '../types';

/**
 * Generate MySQL CREATE TABLE statement
 */
export function generateCreateTable(table: TableDefinition, options: GenerateOptions): string {
  const lines: string[] = [];

  lines.push(`CREATE TABLE \`${table.name}\` (`);

  // Columns
  const columnDefs: string[] = [];
  for (const column of table.columns) {
    columnDefs.push(`  ${generateColumnDefinition(column, options)}`);
  }

  // Primary key
  if (table.primaryKey && table.primaryKey.length > 0) {
    columnDefs.push(`  PRIMARY KEY (${table.primaryKey.map((c) => `\`${c}\``).join(', ')})`);
  }

  // Indexes (inline)
  for (const index of table.indexes || []) {
    if (index.unique) {
      columnDefs.push(
        `  UNIQUE KEY \`${index.name}\` (${index.columns.map((c) => `\`${c}\``).join(', ')})`
      );
    } else {
      columnDefs.push(
        `  KEY \`${index.name}\` (${index.columns.map((c) => `\`${c}\``).join(', ')})`
      );
    }
  }

  // Unique constraints
  for (const constraint of table.constraints || []) {
    if (constraint.type === 'unique') {
      columnDefs.push(
        `  UNIQUE KEY \`${constraint.name}\` (${constraint.columns.map((c) => `\`${c}\``).join(', ')})`
      );
    }
  }

  lines.push(columnDefs.join(',\n'));
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;');

  // Foreign key constraints (separate statements)
  for (const constraint of table.constraints || []) {
    if (constraint.type === 'foreign_key' && constraint.references) {
      lines.push('');
      lines.push(generateForeignKey(table.name, constraint, options));
    }
  }

  return lines.join('\n');
}

/**
 * Generate column definition
 */
export function generateColumnDefinition(column: ColumnDefinition, options: GenerateOptions): string {
  const parts: string[] = [`\`${column.name}\``, mapTypeToMySQL(column.type)];

  if (!column.nullable) {
    parts.push('NOT NULL');
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  return parts.join(' ');
}

/**
 * Generate CREATE INDEX statement
 */
export function generateCreateIndex(index: IndexDefinition, options: GenerateOptions): string {
  const unique = index.unique ? 'UNIQUE ' : '';

  return `CREATE ${unique}INDEX \`${index.name}\` ON \`${index.table}\` (${index.columns
    .map((c) => `\`${c}\``)
    .join(', ')});`;
}

/**
 * Generate foreign key constraint
 */
export function generateForeignKey(
  tableName: string,
  constraint: ConstraintDefinition,
  options: GenerateOptions
): string {
  const ref = constraint.references!;

  const onDelete = ref.onDelete ? ` ON DELETE ${ref.onDelete}` : '';
  const onUpdate = ref.onUpdate ? ` ON UPDATE ${ref.onUpdate}` : '';

  return `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraint.name}\` ` +
    `FOREIGN KEY (${constraint.columns.map((c) => `\`${c}\``).join(', ')}) ` +
    `REFERENCES \`${ref.table}\` (\`${ref.column}\`)${onDelete}${onUpdate};`;
}

/**
 * MySQL doesn't have native ENUM types in CREATE TYPE
 * Enums are defined inline in columns
 */
export function generateEnumType(enumDef: EnumDefinition): string {
  return `ENUM(${enumDef.values.map((v) => `'${v}'`).join(', ')})`;
}

/**
 * Generate DROP TABLE statement
 */
export function generateDropTable(tableName: string, options: GenerateOptions): string {
  return `DROP TABLE IF EXISTS \`${tableName}\`;`;
}

/**
 * Generate ADD COLUMN statement
 */
export function generateAddColumn(
  tableName: string,
  column: ColumnDefinition,
  options: GenerateOptions
): string {
  return `ALTER TABLE \`${tableName}\` ADD COLUMN ${generateColumnDefinition(column, options)};`;
}

/**
 * Generate DROP COLUMN statement
 */
export function generateDropColumn(
  tableName: string,
  columnName: string,
  options: GenerateOptions
): string {
  return `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\`;`;
}

/**
 * Generate MODIFY COLUMN statement
 */
export function generateAlterColumn(
  tableName: string,
  column: ColumnDefinition,
  options: GenerateOptions
): string {
  return `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${generateColumnDefinition(column, options)};`;
}

/**
 * Map ISL type to MySQL type
 */
export function mapTypeToMySQL(islType: string): string {
  const typeMap: Record<string, string> = {
    // Primitives
    'String': 'VARCHAR(255)',
    'Int': 'INT',
    'Integer': 'INT',
    'Float': 'FLOAT',
    'Double': 'DOUBLE',
    'Decimal': 'DECIMAL(19, 4)',
    'Boolean': 'TINYINT(1)',
    'Bool': 'TINYINT(1)',
    'UUID': 'CHAR(36)',
    'Timestamp': 'DATETIME(6)',
    'Date': 'DATE',
    'DateTime': 'DATETIME(6)',
    'Time': 'TIME',
    'Money': 'DECIMAL(19, 4)',
    'JSON': 'JSON',
    'Binary': 'BLOB',
    'Text': 'TEXT',
    // Special types
    'Email': 'VARCHAR(254)',
    'URL': 'TEXT',
    'Phone': 'VARCHAR(20)',
  };

  return typeMap[islType] || 'VARCHAR(255)';
}
