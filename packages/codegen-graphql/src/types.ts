// ============================================================================
// GraphQL Generator Types
// ============================================================================

export interface Domain {
  name: string;
  version?: string;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
}

export interface TypeDeclaration {
  name: string;
  baseType: string;
  constraints: string[];
}

export interface Entity {
  name: string;
  fields: Field[];
  relations?: Relation[];
}

export interface Field {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
}

export interface Relation {
  name: string;
  target: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface Behavior {
  name: string;
  inputs: Field[];
  outputType: string;
  errors: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GraphQLOptions {
  outputDir: string;
  generateResolvers?: boolean;
  generateTypes?: boolean;
  federation?: boolean;
  subscriptions?: boolean;
}
