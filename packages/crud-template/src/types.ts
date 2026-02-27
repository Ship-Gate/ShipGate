/**
 * CRUD Template - Entity Definition Types
 *
 * ISL-like entity definition for parameterized CRUD generation.
 */

export type FieldType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'DateTime'
  | 'UUID'
  | 'Decimal'
  | 'Json';

export type AuthRequirement = 'public' | 'authenticated' | 'role';

export interface EntityField {
  /** Field name (camelCase) */
  name: string;
  /** Prisma/ISL type */
  type: FieldType;
  /** Whether the field is required */
  required: boolean;
  /** Zod validation constraints */
  constraints?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    email?: boolean;
    uuid?: boolean;
  };
  /** Whether this field is searchable (text search) */
  searchable?: boolean;
  /** Whether this field is sortable */
  sortable?: boolean;
  /** Whether this field is filterable */
  filterable?: boolean;
  /** Whether this field is shown in list view */
  listDisplay?: boolean;
  /** Whether this field is editable in form */
  editable?: boolean;
  /** Default value for create */
  default?: string | number | boolean;
  /** For relations: referenced entity */
  entityRef?: string;
}

export interface EntityDefinition {
  /** Entity name (PascalCase) */
  name: string;
  /** Plural form for routes (e.g. "posts") */
  plural?: string;
  /** Entity fields */
  fields: EntityField[];
  /** Auth requirement for all operations */
  auth?: AuthRequirement;
  /** Required role when auth is 'role' */
  requiredRole?: string;
  /** Use soft delete (deletedAt) instead of hard delete */
  softDelete?: boolean;
  /** Fields to include in list view (default: first 5) */
  listFields?: string[];
  /** Fields to include in search (default: searchable fields) */
  searchFields?: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface EntityDefinitionInput {
  name: string;
  plural?: string;
  fields: EntityField[];
  auth?: AuthRequirement;
  requiredRole?: string;
  softDelete?: boolean;
  listFields?: string[];
  searchFields?: string[];
}
