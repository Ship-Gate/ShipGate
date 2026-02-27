/**
 * Shared Types
 */

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface DomainSpec {
  name: string;
  version: string;
  entities: EntitySpec[];
  behaviors: BehaviorSpec[];
  types: TypeSpec[];
}

export interface EntitySpec {
  name: string;
  fields: FieldSpec[];
}

export interface BehaviorSpec {
  name: string;
  description?: string;
  input?: { fields: FieldSpec[] };
  output?: { success: string; errors: ErrorSpec[] };
}

export interface TypeSpec {
  name: string;
  baseType: string;
  constraints: { name: string; value: unknown }[];
}

export interface FieldSpec {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface ErrorSpec {
  name: string;
  retriable: boolean;
}
