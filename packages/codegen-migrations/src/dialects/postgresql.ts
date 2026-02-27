// ============================================================================
// PostgreSQL Dialect
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
 * Generate PostgreSQL CREATE TABLE statement
 */
export function generateCreateTable(table: TableDefinition, options: GenerateOptions): string {
  const lines: string[] = [];
  const schema = options.schemaName ? `${options.schemaName}.` : '';

  lines.push(`CREATE TABLE ${schema}"${table.name}" (`);

  // Columns
  const columnDefs: string[] = [];
  for (const column of table.columns) {
    columnDefs.push(`  ${generateColumnDefinition(column, options)}`);
  }

  // Primary key
  if (table.primaryKey && table.primaryKey.length > 0) {
    columnDefs.push(`  PRIMARY KEY (${table.primaryKey.map((c) => `"${c}"`).join(', ')})`);
  }

  // Inline constraints
  for (const constraint of table.constraints || []) {
    if (constraint.type === 'unique') {
      columnDefs.push(
        `  CONSTRAINT "${constraint.name}" UNIQUE (${constraint.columns.map((c) => `"${c}"`).join(', ')})`
      );
    } else if (constraint.type === 'check') {
      columnDefs.push(`  CONSTRAINT "${constraint.name}" CHECK (${constraint.expression})`);
    }
  }

  lines.push(columnDefs.join(',\n'));
  lines.push(');');

  // Indexes
  for (const index of table.indexes || []) {
    lines.push('');
    lines.push(generateCreateIndex(index, options));
  }

  // Foreign key constraints (separate statements for better control)
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
  const parts: string[] = [`"${column.name}"`, mapTypeToPostgres(column.type)];

  if (!column.nullable) {
    parts.push('NOT NULL');
  }

  if (column.default !== undefined) {
    parts.push(`DEFAULT ${column.default}`);
  }

  if (column.unique && !column.primaryKey) {
    parts.push('UNIQUE');
  }

  return parts.join(' ');
}

/**
 * Generate CREATE INDEX statement
 */
export function generateCreateIndex(index: IndexDefinition, options: GenerateOptions): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  const unique = index.unique ? 'UNIQUE ' : '';
  const using = index.type ? ` USING ${index.type}` : '';
  const where = index.where ? ` WHERE ${index.where}` : '';

  return `CREATE ${unique}INDEX "${index.name}" ON ${schema}"${index.table}"${using} (${index.columns
    .map((c) => `"${c}"`)
    .join(', ')})${where};`;
}

/**
 * Generate foreign key constraint
 */
export function generateForeignKey(
  tableName: string,
  constraint: ConstraintDefinition,
  options: GenerateOptions
): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  const ref = constraint.references!;

  const onDelete = ref.onDelete ? ` ON DELETE ${ref.onDelete}` : '';
  const onUpdate = ref.onUpdate ? ` ON UPDATE ${ref.onUpdate}` : '';

  return `ALTER TABLE ${schema}"${tableName}" ADD CONSTRAINT "${constraint.name}" ` +
    `FOREIGN KEY (${constraint.columns.map((c) => `"${c}"`).join(', ')}) ` +
    `REFERENCES ${schema}"${ref.table}" ("${ref.column}")${onDelete}${onUpdate};`;
}

/**
 * Generate CREATE TYPE for enum
 */
export function generateCreateEnum(enumDef: EnumDefinition, options: GenerateOptions): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  const values = enumDef.values.map((v) => `'${v}'`).join(', ');

  return `CREATE TYPE ${schema}"${enumDef.name}" AS ENUM (${values});`;
}

/**
 * Generate DROP TABLE statement
 */
export function generateDropTable(tableName: string, options: GenerateOptions): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  return `DROP TABLE IF EXISTS ${schema}"${tableName}" CASCADE;`;
}

/**
 * Generate ADD COLUMN statement
 */
export function generateAddColumn(
  tableName: string,
  column: ColumnDefinition,
  options: GenerateOptions
): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  return `ALTER TABLE ${schema}"${tableName}" ADD COLUMN ${generateColumnDefinition(column, options)};`;
}

/**
 * Generate DROP COLUMN statement
 */
export function generateDropColumn(
  tableName: string,
  columnName: string,
  options: GenerateOptions
): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  return `ALTER TABLE ${schema}"${tableName}" DROP COLUMN "${columnName}";`;
}

/**
 * Generate ALTER COLUMN statement
 */
export function generateAlterColumn(
  tableName: string,
  columnName: string,
  changes: Partial<ColumnDefinition>,
  options: GenerateOptions
): string[] {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  const statements: string[] = [];

  if (changes.type) {
    statements.push(
      `ALTER TABLE ${schema}"${tableName}" ALTER COLUMN "${columnName}" TYPE ${mapTypeToPostgres(changes.type)};`
    );
  }

  if (changes.nullable !== undefined) {
    statements.push(
      `ALTER TABLE ${schema}"${tableName}" ALTER COLUMN "${columnName}" ${changes.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'};`
    );
  }

  if (changes.default !== undefined) {
    if (changes.default === null) {
      statements.push(
        `ALTER TABLE ${schema}"${tableName}" ALTER COLUMN "${columnName}" DROP DEFAULT;`
      );
    } else {
      statements.push(
        `ALTER TABLE ${schema}"${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${changes.default};`
      );
    }
  }

  return statements;
}

/**
 * Map ISL type to PostgreSQL type
 */
export function mapTypeToPostgres(islType: string): string {
  const typeMap: Record<string, string> = {
    // Primitives
    'String': 'TEXT',
    'Int': 'INTEGER',
    'Integer': 'INTEGER',
    'Float': 'REAL',
    'Double': 'DOUBLE PRECISION',
    'Decimal': 'NUMERIC',
    'Boolean': 'BOOLEAN',
    'Bool': 'BOOLEAN',
    'UUID': 'UUID',
    'Timestamp': 'TIMESTAMPTZ',
    'Date': 'DATE',
    'DateTime': 'TIMESTAMPTZ',
    'Time': 'TIME',
    'Money': 'NUMERIC(19, 4)',
    'JSON': 'JSONB',
    'Binary': 'BYTEA',
    'Text': 'TEXT',
    // Special types
    'Email': 'VARCHAR(254)',
    'URL': 'TEXT',
    'Phone': 'VARCHAR(20)',
  };

  return typeMap[islType] || 'TEXT';
}

/**
 * Generate comment on table
 */
export function generateTableComment(
  tableName: string,
  comment: string,
  options: GenerateOptions
): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  return `COMMENT ON TABLE ${schema}"${tableName}" IS '${comment.replace(/'/g, "''")}';`;
}

/**
 * Generate comment on column
 */
export function generateColumnComment(
  tableName: string,
  columnName: string,
  comment: string,
  options: GenerateOptions
): string {
  const schema = options.schemaName ? `${options.schemaName}.` : '';
  return `COMMENT ON COLUMN ${schema}"${tableName}"."${columnName}" IS '${comment.replace(/'/g, "''")}';`;
}
