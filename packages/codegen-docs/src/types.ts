// ============================================================================
// Documentation Generator Types
// ============================================================================

export interface Domain {
  name: string;
  version?: string;
  description?: string;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
  invariants: Invariant[];
  policies: Policy[];
}

export interface TypeDeclaration {
  name: string;
  baseType: string;
  description?: string;
  constraints: string[];
}

export interface Entity {
  name: string;
  description?: string;
  fields: Field[];
  invariants: string[];
  lifecycleStates?: string[];
}

export interface Field {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  annotations: string[];
}

export interface Behavior {
  name: string;
  description?: string;
  inputs: Field[];
  outputType: string;
  errors: string[];
  preconditions: string[];
  postconditions: string[];
  temporal?: TemporalSpec;
}

export interface TemporalSpec {
  responseTime?: { value: number; unit: string; percentile: number }[];
  rateLimit?: { count: number; period: string; scope?: string };
}

export interface Invariant {
  name: string;
  description?: string;
  scope: 'global' | 'transaction';
  predicates: string[];
}

export interface Policy {
  name: string;
  description?: string;
  appliesTo: string[];
  rules: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface DocOptions {
  format: 'markdown' | 'html' | 'openapi' | 'all';
  outputDir: string;
  title?: string;
  includeExamples?: boolean;
  includeDiagrams?: boolean;
  theme?: 'light' | 'dark';
}
