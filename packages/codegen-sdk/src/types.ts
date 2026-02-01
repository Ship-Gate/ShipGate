// ============================================================================
// SDK Generator Types
// ============================================================================

export interface Domain {
  name: string;
  version?: string;
  entities: Entity[];
  behaviors: Behavior[];
  types: TypeDeclaration[];
}

export interface Entity {
  name: string;
  fields: Field[];
}

export interface Field {
  name: string;
  type: string;
  optional: boolean;
}

export interface Behavior {
  name: string;
  inputs: Field[];
  outputType: string;
  errors: string[];
}

export interface TypeDeclaration {
  name: string;
  baseType: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export type Language = 'typescript' | 'python' | 'go';

export interface SDKOptions {
  outputDir: string;
  language: Language;
  packageName?: string;
  baseUrl?: string;
}
