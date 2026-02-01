/**
 * Database Types
 */

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'schema' | 'migration' | 'types' | 'seeds';
}

export interface DomainSpec {
  name: string;
  version: string;
  entities: EntitySpec[];
  types: TypeSpec[];
}

export interface EntitySpec {
  name: string;
  fields: FieldSpec[];
  indexes?: IndexSpec[];
  lifecyle?: string[];
}

export interface FieldSpec {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
  constraints: { name: string; value: unknown }[];
  references?: { entity: string; field: string };
}

export interface TypeSpec {
  name: string;
  baseType: string;
  constraints: { name: string; value: unknown }[];
}

export interface IndexSpec {
  fields: string[];
  unique: boolean;
  name?: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  enums: DatabaseEnum[];
}

export interface DatabaseTable {
  name: string;
  columns: Column[];
  primaryKey: string[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

export interface DatabaseEnum {
  name: string;
  values: string[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  primaryKey: boolean;
  unique: boolean;
  references?: { table: string; column: string };
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}
