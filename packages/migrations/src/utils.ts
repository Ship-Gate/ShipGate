/**
 * Migration Utilities
 * 
 * Helper functions for type serialization, naming conventions, and SQL generation.
 */

import type {
  TypeExpression,
  Expression,
  FieldDeclaration,
  TypeConstraint,
  Annotation,
} from '@isl-lang/isl-core';

import type { SqlDialect, SerializedValue, NamingConvention } from './types.js';

// ============================================
// Naming Conventions
// ============================================

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/^([A-Z])/, (_, letter) => letter.toLowerCase());
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Apply naming convention to identifier
 */
export function applyNamingConvention(
  str: string, 
  convention: 'snake_case' | 'camelCase' | 'PascalCase'
): string {
  switch (convention) {
    case 'snake_case':
      return toSnakeCase(str);
    case 'camelCase':
      return toCamelCase(str);
    case 'PascalCase':
      return toPascalCase(str);
  }
}

/**
 * Default naming convention
 */
export const defaultNamingConvention: NamingConvention = {
  table: 'snake_case',
  column: 'snake_case',
  index: 'snake_case',
  foreignKey: 'snake_case',
};

// ============================================
// Type Serialization
// ============================================

/**
 * Serialize ISL type expression to string
 */
export function serializeType(type: TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      return type.name.name;
    
    case 'GenericType':
      const args = type.typeArguments.map(serializeType).join(', ');
      return `${type.name.name}<${args}>`;
    
    case 'UnionType':
      return type.variants.map(v => v.name.name).join(' | ');
    
    case 'ObjectType':
      const fields = type.fields.map(f => 
        `${f.name.name}: ${serializeType(f.type)}`
      ).join(', ');
      return `{ ${fields} }`;
    
    case 'ArrayType':
      return `${serializeType(type.elementType)}[]`;
    
    default:
      return 'unknown';
  }
}

/**
 * Extract base type name from type expression
 */
export function getBaseTypeName(type: TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      return type.name.name;
    case 'GenericType':
      return type.name.name;
    case 'ArrayType':
      return 'Array';
    case 'UnionType':
      return 'Union';
    case 'ObjectType':
      return 'Object';
    default:
      return 'unknown';
  }
}

/**
 * Check if type is a primitive ISL type
 */
export function isPrimitiveType(typeName: string): boolean {
  const primitives = [
    'String', 'Int', 'Float', 'Boolean', 'DateTime', 
    'Date', 'Time', 'UUID', 'Email', 'URL', 'JSON',
    'Money', 'Decimal', 'BigInt', 'Bytes',
  ];
  return primitives.includes(typeName);
}

// ============================================
// SQL Type Mapping
// ============================================

/**
 * ISL to SQL type mapping by dialect
 */
const TYPE_MAPPINGS: Record<SqlDialect, Record<string, string>> = {
  postgresql: {
    String: 'TEXT',
    Int: 'INTEGER',
    Float: 'DOUBLE PRECISION',
    Boolean: 'BOOLEAN',
    DateTime: 'TIMESTAMP WITH TIME ZONE',
    Date: 'DATE',
    Time: 'TIME',
    UUID: 'UUID',
    Email: 'TEXT',
    URL: 'TEXT',
    JSON: 'JSONB',
    Money: 'DECIMAL(19,4)',
    Decimal: 'DECIMAL',
    BigInt: 'BIGINT',
    Bytes: 'BYTEA',
  },
  mysql: {
    String: 'VARCHAR(255)',
    Int: 'INT',
    Float: 'DOUBLE',
    Boolean: 'TINYINT(1)',
    DateTime: 'DATETIME',
    Date: 'DATE',
    Time: 'TIME',
    UUID: 'CHAR(36)',
    Email: 'VARCHAR(255)',
    URL: 'TEXT',
    JSON: 'JSON',
    Money: 'DECIMAL(19,4)',
    Decimal: 'DECIMAL',
    BigInt: 'BIGINT',
    Bytes: 'BLOB',
  },
  sqlite: {
    String: 'TEXT',
    Int: 'INTEGER',
    Float: 'REAL',
    Boolean: 'INTEGER',
    DateTime: 'TEXT',
    Date: 'TEXT',
    Time: 'TEXT',
    UUID: 'TEXT',
    Email: 'TEXT',
    URL: 'TEXT',
    JSON: 'TEXT',
    Money: 'REAL',
    Decimal: 'REAL',
    BigInt: 'INTEGER',
    Bytes: 'BLOB',
  },
  mssql: {
    String: 'NVARCHAR(255)',
    Int: 'INT',
    Float: 'FLOAT',
    Boolean: 'BIT',
    DateTime: 'DATETIME2',
    Date: 'DATE',
    Time: 'TIME',
    UUID: 'UNIQUEIDENTIFIER',
    Email: 'NVARCHAR(255)',
    URL: 'NVARCHAR(MAX)',
    JSON: 'NVARCHAR(MAX)',
    Money: 'DECIMAL(19,4)',
    Decimal: 'DECIMAL',
    BigInt: 'BIGINT',
    Bytes: 'VARBINARY(MAX)',
  },
};

/**
 * Convert ISL type to SQL type
 */
export function islTypeToSql(
  islType: string, 
  dialect: SqlDialect = 'postgresql',
  customMapping?: Record<string, string>
): string {
  // Check custom mapping first
  if (customMapping && customMapping[islType]) {
    return customMapping[islType];
  }
  
  // Handle array types
  if (islType.endsWith('[]')) {
    const baseType = islType.slice(0, -2);
    const sqlBase = islTypeToSql(baseType, dialect, customMapping);
    
    switch (dialect) {
      case 'postgresql':
        return `${sqlBase}[]`;
      case 'mysql':
      case 'sqlite':
      case 'mssql':
        return 'JSON'; // Arrays stored as JSON in non-PostgreSQL
    }
  }
  
  // Handle generic types
  const genericMatch = islType.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, baseName, typeArg] = genericMatch;
    
    switch (baseName) {
      case 'List':
      case 'Set':
        return dialect === 'postgresql' 
          ? `${islTypeToSql(typeArg, dialect, customMapping)}[]`
          : 'JSON';
      case 'Map':
        return dialect === 'postgresql' ? 'JSONB' : 'JSON';
      case 'Optional':
        return islTypeToSql(typeArg, dialect, customMapping);
    }
  }
  
  // Standard type mapping
  const mapping = TYPE_MAPPINGS[dialect];
  return mapping[islType] || 'TEXT';
}

/**
 * Check if SQL type change is safe (no data loss)
 */
export function isTypeSafeChange(
  oldType: string, 
  newType: string, 
  dialect: SqlDialect = 'postgresql'
): boolean {
  const safeUpgrades: Record<string, string[]> = {
    'INT': ['BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE PRECISION'],
    'INTEGER': ['BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE PRECISION', 'REAL'],
    'SMALLINT': ['INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT'],
    'FLOAT': ['DOUBLE PRECISION', 'DECIMAL'],
    'REAL': ['DOUBLE PRECISION', 'FLOAT'],
    'VARCHAR': ['TEXT'],
    'CHAR': ['VARCHAR', 'TEXT'],
  };
  
  const oldNormalized = oldType.toUpperCase().split('(')[0];
  const newNormalized = newType.toUpperCase().split('(')[0];
  
  if (oldNormalized === newNormalized) {
    return true;
  }
  
  return safeUpgrades[oldNormalized]?.includes(newNormalized) ?? false;
}

// ============================================
// Expression Serialization
// ============================================

/**
 * Serialize ISL expression to serialized value
 */
export function serializeExpression(expr: Expression): SerializedValue {
  switch (expr.kind) {
    case 'StringLiteral':
      return { kind: 'string', value: expr.value };
    
    case 'NumberLiteral':
      return { kind: 'number', value: expr.value };
    
    case 'BooleanLiteral':
      return { kind: 'boolean', value: expr.value };
    
    case 'NullLiteral':
      return { kind: 'null' };
    
    default:
      return { kind: 'expression', value: expressionToString(expr) };
  }
}

/**
 * Convert expression to string representation
 */
export function expressionToString(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    
    case 'StringLiteral':
      return `'${expr.value}'`;
    
    case 'NumberLiteral':
      return expr.value.toString();
    
    case 'BooleanLiteral':
      return expr.value ? 'true' : 'false';
    
    case 'NullLiteral':
      return 'null';
    
    case 'BinaryExpression':
      return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
    
    case 'MemberExpression':
      return `${expressionToString(expr.object)}.${expr.property.name}`;
    
    case 'CallExpression':
      const args = expr.arguments.map(expressionToString).join(', ');
      return `${expressionToString(expr.callee)}(${args})`;
    
    default:
      return '<expression>';
  }
}

/**
 * Serialize value to SQL default
 */
export function serializeDefault(
  value: SerializedValue, 
  dialect: SqlDialect = 'postgresql'
): string {
  switch (value.kind) {
    case 'string':
      return `'${escapeString(value.value)}'`;
    
    case 'number':
      return value.value.toString();
    
    case 'boolean':
      switch (dialect) {
        case 'postgresql':
        case 'sqlite':
          return value.value ? 'TRUE' : 'FALSE';
        case 'mysql':
          return value.value ? '1' : '0';
        case 'mssql':
          return value.value ? '1' : '0';
      }
      break;
    
    case 'null':
      return 'NULL';
    
    case 'expression':
      return value.value;
  }
  
  return 'NULL';
}

/**
 * Escape string for SQL
 */
export function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

// ============================================
// Constraint Serialization
// ============================================

/**
 * Serialize constraints to string array
 */
export function serializeConstraints(constraints: TypeConstraint[]): string[] {
  return constraints.map(c => {
    if (c.value) {
      return `${c.name.name}(${expressionToString(c.value)})`;
    }
    return c.name.name;
  });
}

/**
 * Serialize annotations to string array
 */
export function serializeAnnotations(annotations: Annotation[]): string[] {
  return annotations.map(a => {
    if (a.value) {
      return `@${a.name.name}(${expressionToString(a.value)})`;
    }
    return `@${a.name.name}`;
  });
}

/**
 * Check if field has specific annotation
 */
export function hasAnnotation(field: FieldDeclaration, name: string): boolean {
  return field.annotations.some(a => a.name.name === name);
}

/**
 * Get annotation value
 */
export function getAnnotationValue(
  field: FieldDeclaration, 
  name: string
): Expression | undefined {
  const annotation = field.annotations.find(a => a.name.name === name);
  return annotation?.value;
}

// ============================================
// SQL Generation Helpers
// ============================================

/**
 * Quote identifier for SQL dialect
 */
export function quoteIdentifier(name: string, dialect: SqlDialect = 'postgresql'): string {
  switch (dialect) {
    case 'postgresql':
      return `"${name}"`;
    case 'mysql':
      return `\`${name}\``;
    case 'mssql':
      return `[${name}]`;
    case 'sqlite':
      return `"${name}"`;
  }
}

/**
 * Generate qualified table name
 */
export function qualifiedTableName(
  tableName: string, 
  schema?: string, 
  dialect: SqlDialect = 'postgresql'
): string {
  const quoted = quoteIdentifier(tableName, dialect);
  if (schema) {
    return `${quoteIdentifier(schema, dialect)}.${quoted}`;
  }
  return quoted;
}

/**
 * Generate index name
 */
export function generateIndexName(
  tableName: string, 
  columns: string[], 
  unique: boolean = false
): string {
  const prefix = unique ? 'uix' : 'idx';
  const columnPart = columns.map(toSnakeCase).join('_');
  return `${prefix}_${toSnakeCase(tableName)}_${columnPart}`;
}

/**
 * Generate foreign key name
 */
export function generateForeignKeyName(
  tableName: string, 
  columnName: string, 
  referencedTable: string
): string {
  return `fk_${toSnakeCase(tableName)}_${toSnakeCase(columnName)}_${toSnakeCase(referencedTable)}`;
}

/**
 * Generate constraint name
 */
export function generateConstraintName(
  tableName: string, 
  type: 'pk' | 'uk' | 'ck' | 'fk', 
  columns: string[]
): string {
  const columnPart = columns.map(toSnakeCase).join('_');
  return `${type}_${toSnakeCase(tableName)}_${columnPart}`;
}

// ============================================
// Migration Name Generation
// ============================================

/**
 * Generate migration timestamp
 */
export function generateTimestamp(): string {
  const now = new Date();
  return now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .split('.')[0];
}

/**
 * Generate migration name
 */
export function generateMigrationName(description: string): string {
  const timestamp = generateTimestamp();
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${timestamp}_${slug}`;
}

// ============================================
// Diff Helpers
// ============================================

/**
 * Check if two arrays have the same elements (order independent)
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Get added elements between two arrays
 */
export function getAdded<T>(oldArr: T[], newArr: T[]): T[] {
  return newArr.filter(item => !oldArr.includes(item));
}

/**
 * Get removed elements between two arrays
 */
export function getRemoved<T>(oldArr: T[], newArr: T[]): T[] {
  return oldArr.filter(item => !newArr.includes(item));
}
