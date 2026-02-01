// ============================================================================
// ISL REPL Types
// ============================================================================

export interface REPLContext {
  domain: Domain | null;
  entities: Map<string, EntityDefinition>;
  behaviors: Map<string, BehaviorDefinition>;
  types: Map<string, TypeDefinition>;
  variables: Map<string, unknown>;
  history: string[];
}

export interface Domain {
  name: string;
  version?: string;
}

export interface EntityDefinition {
  name: string;
  fields: FieldDefinition[];
  instances: Map<string, Record<string, unknown>>;
}

export interface FieldDefinition {
  name: string;
  type: string;
  optional: boolean;
}

export interface BehaviorDefinition {
  name: string;
  inputs: FieldDefinition[];
  outputType: string;
  preconditions: string[];
  postconditions: string[];
}

export interface TypeDefinition {
  name: string;
  baseType: string;
  constraints: string[];
}

export interface EvalResult {
  success: boolean;
  value?: unknown;
  type?: string;
  error?: string;
  output?: string;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string[], context: REPLContext) => EvalResult;
}
