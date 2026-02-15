// ============================================================================
// Parser AST Adapter
// Normalizes @isl-lang/parser Domain AST to the format expected by the generator
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
// Parser types - use any when parser dist has no d.ts
type Domain = any;
type TypeDefinition = any;
type Field = any;
type InputSpec = any;
type OutputSpec = any;
type ErrorSpec = any;
type TypeDeclaration = any;
type ApiBlock = any;
type EndpointDecl = any;
type ActorSpec = any;
type Entity = any;
type Behavior = any;

// Normalized format for the generator
export interface NormalizedDomain {
  name: string;
  version: string;
  entities: NormalizedEntity[];
  types: NormalizedTypeDeclaration[];
  behaviors: NormalizedBehavior[];
  apis?: NormalizedApiBlock[];
  scenarios?: unknown[];
  policies?: unknown[];
}

export interface NormalizedEntity {
  name: string;
  fields: NormalizedField[];
  invariants?: unknown[];
}

export interface NormalizedField {
  name: string;
  type: NormalizedTypeExpr;
  optional: boolean;
  annotations?: { name: string }[];
  constraints?: { name: string; value: unknown }[];
}

export interface NormalizedTypeDeclaration {
  name: string;
  definition?: {
    kind: 'enum' | 'struct' | 'primitive';
    name?: string;
    values?: { name: string }[];
    fields?: NormalizedField[];
  };
  constraints?: { name: string; value: unknown }[];
}

export type NormalizedTypeExpr =
  | { kind: 'primitive'; name: string }
  | { kind: 'reference'; name: string }
  | { kind: 'list'; elementType: NormalizedTypeExpr }
  | { kind: 'map'; valueType: NormalizedTypeExpr }
  | { kind: 'optional'; innerType: NormalizedTypeExpr }
  | { kind: 'SimpleType'; name: string }
  | { kind: 'GenericType'; name: string; typeArguments: NormalizedTypeExpr[] }
  | { kind: 'ObjectType'; fields: NormalizedField[] };

export interface NormalizedBehavior {
  name: string;
  description?: string;
  actors?: { name: string; constraints: unknown[] }[];
  input?: { fields: NormalizedField[] };
  output?: {
    success?: NormalizedTypeExpr;
    errors?: { name: string; when?: string; retriable?: boolean; fields?: NormalizedField[] }[];
  };
}

export interface NormalizedApiBlock {
  basePath?: string;
  endpoints: NormalizedEndpoint[];
}

export interface NormalizedEndpoint {
  method: string;
  path: string;
  behavior?: string;
  description?: string;
  auth?: boolean;
  params?: NormalizedField[];
  body?: NormalizedTypeExpr;
  response?: NormalizedTypeExpr;
}

function idName(node: { name?: string } | { name?: { name: string } }): string {
  if (!node?.name) return '';
  const n = node.name;
  return typeof n === 'string' ? n : n.name;
}

function extractConstraintValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function normalizeTypeDef(type: TypeDefinition): NormalizedTypeExpr {
  switch (type.kind) {
    case 'PrimitiveType':
      return { kind: 'primitive', name: type.name };
    case 'ReferenceType':
      return { kind: 'reference', name: type.name.parts.map((p: any) => p.name).join('.') };
    case 'ListType':
      return { kind: 'list', elementType: normalizeTypeDef(type.element) };
    case 'MapType':
      return { kind: 'map', valueType: normalizeTypeDef(type.value) };
    case 'OptionalType':
      return { kind: 'optional', innerType: normalizeTypeDef(type.inner) };
    case 'EnumType':
      return {
        kind: 'reference',
        name: type.variants.map((v: any) => idName(v)).join('|'),
      };
    case 'StructType': {
      const fields = type.fields.map((f: any) => normalizeField(f));
      return { kind: 'ObjectType', fields };
    }
    case 'UnionType':
      return {
        kind: 'reference',
        name: type.variants.map((v: any) => idName(v)).join('|'),
      };
    case 'ConstrainedType':
      return normalizeTypeDef(type.base);
    default:
      return { kind: 'primitive', name: 'String' };
  }
}

function normalizeField(field: Field): NormalizedField {
  const annotations = (field.annotations || []).map((a: any) => ({
    name: typeof a.name === 'string' ? a.name : a.name?.name ?? '',
  }));
  const constraints =
    field.type?.kind === 'ConstrainedType' && field.type.constraints
      ? field.type.constraints.map((c: any) => ({
          name: typeof c.name === 'string' ? c.name : c.name ?? '',
          value: extractConstraintValue(c.value),
        }))
      : undefined;
  return {
    name: idName(field.name),
    type: normalizeTypeDef(field.type),
    optional: field.optional ?? false,
    annotations: annotations.length ? annotations : undefined,
    constraints,
  };
}

function normalizeInput(input: InputSpec): { fields: NormalizedField[] } {
  return {
    fields: (input.fields || []).map((f: any) => normalizeField(f)),
  };
}

function normalizeOutput(output: OutputSpec): NormalizedBehavior['output'] {
  if (!output) return undefined;
  const errs = (output.errors || []).map((e: any) => ({
    name: idName(e.name),
    when: e.when?.value,
    retriable: e.retriable,
    fields: e.returns ? [] : undefined,
  }));
  return {
    success: output.success ? normalizeTypeDef(output.success) : undefined,
    errors: errs.length ? errs : undefined,
  };
}

/**
 * Normalize parser Domain AST to generator format
 */
export function normalizeDomain(domain: Domain & { name?: { name: string }; version?: { kind?: string; value?: string }; entities?: any[]; types?: any[]; behaviors?: any[]; apis?: any[] }): NormalizedDomain {
  const version =
    domain.version?.kind === 'StringLiteral' ? domain.version.value : '1.0.0';

  const entities: NormalizedEntity[] = (domain.entities || []).map((e: any) => ({
    name: idName(e.name),
    fields: (e.fields || []).map((f: any) => normalizeField(f)),
    invariants: e.invariants,
  }));

  const types: NormalizedTypeDeclaration[] = (domain.types || []).map((t: any) => {
    const def = t.definition;
    let definition: NormalizedTypeDeclaration['definition'];
    let constraints: { name: string; value: unknown }[] = [];

    function unwrap(defn: any): any {
      if (defn.kind === 'ConstrainedType') {
        constraints = defn.constraints.map((c: any) => ({
          name: c.name,
          value: extractConstraintValue(c.value),
        }));
        return unwrap(defn.base);
      }
      return defn;
    }

    const unwrapped = def ? unwrap(def) : null;
    if (unwrapped) {
      if (unwrapped.kind === 'EnumType') {
        definition = {
          kind: 'enum',
          values: unwrapped.variants.map((v: any) => ({ name: idName(v.name) })),
        };
      } else if (unwrapped.kind === 'StructType') {
        definition = {
          kind: 'struct',
          fields: unwrapped.fields.map((f: any) => normalizeField(f)),
        };
      } else if (unwrapped.kind === 'PrimitiveType') {
        definition = { kind: 'primitive', name: unwrapped.name };
      }
    }
    return {
      name: idName(t.name),
      definition,
      constraints: constraints.length ? constraints : undefined,
    };
  });

  const behaviors: NormalizedBehavior[] = (domain.behaviors || []).map((b: any) => ({
    name: idName(b.name),
    description: b.description?.value,
    actors: (b.actors || []).map((a: any) => ({
      name: idName(a.name),
      constraints: a.constraints || [],
    })),
    input: b.input ? normalizeInput(b.input) : undefined,
    output: b.output ? normalizeOutput(b.output) : undefined,
  }));

  const apis: NormalizedApiBlock[] | undefined = (domain.apis || []).map((api: any) => ({
    basePath: api.basePath?.value,
    endpoints: (api.endpoints || []).map((ep: any) => ({
      method: ep.method,
      path: ep.path?.value ?? '',
      behavior: ep.behavior ? idName(ep.behavior) : undefined,
      description: ep.description?.value,
      auth: !!ep.auth,
      params: (ep.params || []).map((p: any) => normalizeField(p)),
      body: ep.body ? normalizeTypeDef(ep.body) : undefined,
      response: ep.response ? normalizeTypeDef(ep.response) : undefined,
    })),
  }));

  return {
    name: idName(domain.name),
    version,
    entities,
    types,
    behaviors,
    apis: apis?.length ? apis : undefined,
  };
}
