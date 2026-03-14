import { parse, type Diagnostic } from '@isl-lang/parser';
import type {
  Domain,
  Behavior,
  EndpointDecl,
  Entity,
  Field,
  TypeDefinition,
  ConstrainedType,
  Constraint,
  Expression,
  PrimitiveType,
  ReferenceType,
  EnumType,
  OptionalType,
} from '@isl-lang/parser';
import type { TestSuite, TestCase, GeneratorConfig, FieldConstraints, FieldTypeKind } from './types.js';
import { generateValidValue, generateInvalidValue, generateBoundaryValues } from './value-generator.js';

interface EndpointBehaviorPair {
  endpoint: EndpointDecl;
  behavior?: Behavior;
  basePath: string;
}

export function generateTests(specSource: string, config: GeneratorConfig): TestSuite {
  const result = parse(specSource);

  if (!result.success || !result.domain) {
    throw new Error(
      `Failed to parse ISL spec: ${result.errors.map((e: Diagnostic) => e.message).join('; ')}`,
    );
  }

  const domain = result.domain;
  const pairs = collectEndpointBehaviorPairs(domain);
  const entityMap = buildEntityMap(domain);
  const tests: TestCase[] = [];

  for (const pair of pairs) {
    tests.push(...generateEndpointTests(pair, entityMap, config));
  }

  return {
    name: domain.name.name,
    baseUrl: config.baseUrl,
    tests,
  };
}

function collectEndpointBehaviorPairs(domain: Domain): EndpointBehaviorPair[] {
  const behaviorMap = new Map<string, Behavior>();
  for (const b of domain.behaviors) {
    behaviorMap.set(b.name.name, b);
  }

  const pairs: EndpointBehaviorPair[] = [];

  for (const api of domain.apis) {
    const basePath = api.basePath?.value ?? '';
    for (const ep of api.endpoints) {
      const behavior = ep.behavior ? behaviorMap.get(ep.behavior.name) : undefined;
      pairs.push({ endpoint: ep, behavior, basePath });
    }
  }

  return pairs;
}

function buildEntityMap(domain: Domain): Map<string, Entity> {
  const map = new Map<string, Entity>();
  for (const e of domain.entities) {
    map.set(e.name.name, e);
  }
  return map;
}

function generateEndpointTests(
  pair: EndpointBehaviorPair,
  entityMap: Map<string, Entity>,
  config: GeneratorConfig,
): TestCase[] {
  const { endpoint, behavior, basePath } = pair;
  if (endpoint.method === 'WEBSOCKET') return [];
  const method = endpoint.method as TestCase['method'];

  const fullPath = `${basePath}${endpoint.path.value}`;
  const tests: TestCase[] = [];
  const authRequired = detectAuthRequired(endpoint, behavior);
  const inputFields = behavior?.input?.fields ?? endpoint.params ?? [];
  const responseType = endpoint.response;

  tests.push(createHappyPathTest(method, fullPath, inputFields, authRequired, responseType, entityMap, config));

  if (authRequired) {
    tests.push(createAuthFailureTest(method, fullPath));
  }

  if (inputFields.length > 0) {
    tests.push(...createValidationErrorTests(method, fullPath, inputFields, authRequired, config));
    tests.push(...createBoundaryTests(method, fullPath, inputFields, authRequired, config));
  }

  if (behavior?.postconditions && behavior.postconditions.length > 0) {
    tests.push(...createPostconditionTests(method, fullPath, behavior, inputFields, authRequired, config));
  }

  return tests;
}

function detectAuthRequired(endpoint: EndpointDecl, behavior?: Behavior): boolean {
  if (endpoint.auth) return true;

  if (behavior?.preconditions) {
    for (const pre of behavior.preconditions) {
      if (expressionContainsAuth(pre)) return true;
    }
  }

  if (behavior?.security && behavior.security.length > 0) return true;

  return false;
}

function expressionContainsAuth(expr: Expression): boolean {
  if (expr.kind === 'Identifier') {
    const lower = expr.name.toLowerCase();
    return lower.includes('auth') || lower.includes('authenticated') || lower.includes('logged_in');
  }
  if (expr.kind === 'MemberExpr') {
    return expressionContainsAuth(expr.object) || expressionContainsAuth(expr.property);
  }
  if (expr.kind === 'BinaryExpr') {
    return expressionContainsAuth(expr.left) || expressionContainsAuth(expr.right);
  }
  if (expr.kind === 'CallExpr') {
    return expressionContainsAuth(expr.callee);
  }
  return false;
}

function resolveFieldType(typeDef: TypeDefinition): { kind: FieldTypeKind; constraints: FieldConstraints } {
  const result: FieldConstraints = {};
  let kind: FieldTypeKind = 'String';

  switch (typeDef.kind) {
    case 'PrimitiveType': {
      const prim = typeDef as PrimitiveType;
      kind = mapPrimitiveToFieldType(prim.name);
      break;
    }

    case 'ConstrainedType': {
      const ct = typeDef as ConstrainedType;
      const base = resolveFieldType(ct.base);
      kind = base.kind;
      Object.assign(result, base.constraints);
      for (const c of ct.constraints) {
        applyConstraint(result, c);
      }
      break;
    }

    case 'ReferenceType': {
      const ref = typeDef as ReferenceType;
      const name = ref.name.parts.map((p: { name: string }) => p.name).join('.');
      const lower = name.toLowerCase();
      if (lower.includes('email')) kind = 'Email';
      else if (lower.includes('url') || lower.includes('uri')) kind = 'URL';
      else if (lower.includes('phone')) kind = 'Phone';
      else if (lower.includes('uuid') || lower.includes('id')) kind = 'UUID';
      else kind = 'String';
      break;
    }

    case 'EnumType': {
      const et = typeDef as EnumType;
      kind = 'enum';
      result.enumValues = et.variants.map((v: { name: { name: string } }) => v.name.name);
      break;
    }

    case 'OptionalType': {
      const ot = typeDef as OptionalType;
      return resolveFieldType(ot.inner);
    }

    default:
      kind = 'String';
  }

  return { kind, constraints: result };
}

function mapPrimitiveToFieldType(name: string): FieldTypeKind {
  switch (name) {
    case 'String': return 'String';
    case 'Int': return 'Int';
    case 'Decimal': return 'Decimal';
    case 'Boolean': return 'Boolean';
    case 'Timestamp': return 'Timestamp';
    case 'UUID': return 'UUID';
    case 'Duration': return 'Duration';
    default: return 'String';
  }
}

function applyConstraint(result: FieldConstraints, constraint: Constraint): void {
  const name = constraint.name.toLowerCase();
  const value = extractNumberFromExpr(constraint.value);

  if (name === 'min' || name === 'minlength' || name === 'min_length') {
    if (name.includes('length') || name.includes('len')) {
      result.minLength = value;
    } else {
      result.min = value;
    }
  } else if (name === 'max' || name === 'maxlength' || name === 'max_length') {
    if (name.includes('length') || name.includes('len')) {
      result.maxLength = value;
    } else {
      result.max = value;
    }
  } else if (name === 'pattern' || name === 'regex') {
    if (constraint.value.kind === 'StringLiteral') {
      result.pattern = constraint.value.value;
    } else if (constraint.value.kind === 'RegexLiteral') {
      result.pattern = constraint.value.pattern;
    }
  }
}

function extractNumberFromExpr(expr: Expression): number {
  if (expr.kind === 'NumberLiteral') return expr.value;
  if (expr.kind === 'StringLiteral') return parseFloat(expr.value) || 0;
  return 0;
}

function buildRequestBody(
  fields: Field[],
  config: GeneratorConfig,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const field of fields) {
    const fieldName = field.name.name;
    if (overrides && fieldName in overrides) {
      body[fieldName] = overrides[fieldName];
      continue;
    }
    if (field.optional) continue;

    const { kind, constraints } = resolveFieldType(field.type);
    body[fieldName] = generateValidValue(kind, constraints);
  }

  return body;
}

function buildAuthHeaders(config: GeneratorConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.authToken ?? '{{AUTH_TOKEN}}'}`,
  };
}

function buildExpectedShape(
  responseType: TypeDefinition | undefined,
  entityMap: Map<string, Entity>,
): Record<string, string> | undefined {
  if (!responseType) return undefined;

  const shape: Record<string, string> = {};

  if (responseType.kind === 'ReferenceType') {
    const refName = responseType.name.parts.map((p: { name: string }) => p.name).join('.');
    const entity = entityMap.get(refName);
    if (entity) {
      for (const field of entity.fields) {
        const { kind } = resolveFieldType(field.type);
        shape[field.name.name] = typeToJsonType(kind);
      }
      return Object.keys(shape).length > 0 ? shape : undefined;
    }
  }

  if (responseType.kind === 'StructType') {
    for (const field of responseType.fields) {
      const { kind } = resolveFieldType(field.type);
      shape[field.name.name] = typeToJsonType(kind);
    }
    return Object.keys(shape).length > 0 ? shape : undefined;
  }

  return undefined;
}

function typeToJsonType(kind: FieldTypeKind): string {
  switch (kind) {
    case 'Int':
    case 'Decimal':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'String':
    case 'Email':
    case 'URL':
    case 'UUID':
    case 'Phone':
    case 'Date':
    case 'Timestamp':
    case 'Duration':
    case 'enum':
      return 'string';
    default:
      return 'string';
  }
}

function createHappyPathTest(
  method: TestCase['method'],
  path: string,
  inputFields: Field[],
  authRequired: boolean,
  responseType: TypeDefinition | undefined,
  entityMap: Map<string, Entity>,
  config: GeneratorConfig,
): TestCase {
  const body = (method !== 'GET' && inputFields.length > 0)
    ? buildRequestBody(inputFields, config)
    : undefined;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authRequired) Object.assign(headers, buildAuthHeaders(config));

  return {
    name: `${method} ${path} - success`,
    method,
    path,
    headers,
    body,
    expectedStatus: method === 'POST' ? 201 : 200,
    expectedShape: buildExpectedShape(responseType, entityMap),
    authRequired,
    description: `Happy path: ${method} ${path} with valid data returns success`,
  };
}

function createAuthFailureTest(method: TestCase['method'], path: string): TestCase {
  return {
    name: `${method} ${path} - unauthorized`,
    method,
    path,
    headers: { 'Content-Type': 'application/json' },
    expectedStatus: 401,
    authRequired: true,
    description: `Auth failure: ${method} ${path} without credentials returns 401`,
  };
}

function createValidationErrorTests(
  method: TestCase['method'],
  path: string,
  inputFields: Field[],
  authRequired: boolean,
  config: GeneratorConfig,
): TestCase[] {
  if (method === 'GET') return [];

  const tests: TestCase[] = [];
  const requiredFields = inputFields.filter(f => !f.optional);

  for (const field of requiredFields) {
    const { kind, constraints } = resolveFieldType(field.type);
    const invalidVal = generateInvalidValue(kind, constraints);
    const body = buildRequestBody(inputFields, config, { [field.name.name]: invalidVal });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authRequired) Object.assign(headers, buildAuthHeaders(config));

    tests.push({
      name: `${method} ${path} - invalid ${field.name.name}`,
      method,
      path,
      headers,
      body,
      expectedStatus: 400,
      authRequired,
      description: `Validation: ${method} ${path} with invalid ${field.name.name} (${kind}) returns 400`,
    });
  }

  if (requiredFields.length > 0) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authRequired) Object.assign(headers, buildAuthHeaders(config));

    tests.push({
      name: `${method} ${path} - empty body`,
      method,
      path,
      headers,
      body: {},
      expectedStatus: 422,
      authRequired,
      description: `Validation: ${method} ${path} with empty body returns 422`,
    });
  }

  return tests;
}

function createBoundaryTests(
  method: TestCase['method'],
  path: string,
  inputFields: Field[],
  authRequired: boolean,
  config: GeneratorConfig,
): TestCase[] {
  if (method === 'GET') return [];

  const tests: TestCase[] = [];

  for (const field of inputFields) {
    if (field.optional) continue;

    const { kind, constraints } = resolveFieldType(field.type);
    const boundaries = generateBoundaryValues(kind, constraints);

    for (const boundary of boundaries) {
      const body = buildRequestBody(inputFields, config, { [field.name.name]: boundary.value });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authRequired) Object.assign(headers, buildAuthHeaders(config));

      tests.push({
        name: `${method} ${path} - ${field.name.name} ${boundary.label}`,
        method,
        path,
        headers,
        body,
        expectedStatus: boundary.shouldFail ? 400 : (method === 'POST' ? 201 : 200),
        authRequired,
        description: `Boundary: ${field.name.name} with ${boundary.label} ${boundary.shouldFail ? 'should be rejected' : 'should be accepted'}`,
      });
    }
  }

  return tests;
}

function createPostconditionTests(
  method: TestCase['method'],
  path: string,
  behavior: Behavior,
  inputFields: Field[],
  authRequired: boolean,
  config: GeneratorConfig,
): TestCase[] {
  const tests: TestCase[] = [];

  for (const pc of behavior.postconditions) {
    const conditionLabel = typeof pc.condition === 'string' ? pc.condition : pc.condition.name;

    if (conditionLabel === 'success') {
      const body = (method !== 'GET' && inputFields.length > 0)
        ? buildRequestBody(inputFields, config)
        : undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authRequired) Object.assign(headers, buildAuthHeaders(config));

      const expectedFields: Record<string, unknown> = {};
      for (const pred of pc.predicates) {
        extractExpectedFields(pred, expectedFields);
      }

      if (Object.keys(expectedFields).length > 0) {
        tests.push({
          name: `${method} ${path} - postcondition: ${conditionLabel}`,
          method,
          path,
          headers,
          body,
          expectedStatus: method === 'POST' ? 201 : 200,
          expectedFields,
          authRequired,
          description: `Postcondition (${conditionLabel}): validates response fields match spec`,
        });
      }
    }
  }

  return tests;
}

function extractExpectedFields(expr: Expression, result: Record<string, unknown>): void {
  if (expr.kind === 'BinaryExpr' && expr.operator === '==') {
    const left = expr.left;
    const right = expr.right;

    if (left.kind === 'MemberExpr' && left.object.kind === 'ResultExpr') {
      const fieldName = left.property.name;
      if (right.kind === 'StringLiteral') result[fieldName] = right.value;
      else if (right.kind === 'NumberLiteral') result[fieldName] = right.value;
      else if (right.kind === 'BooleanLiteral') result[fieldName] = right.value;
    }
  }

  if (expr.kind === 'BinaryExpr' && (expr.operator === 'and' || expr.operator === 'or')) {
    extractExpectedFields(expr.left, result);
    extractExpectedFields(expr.right, result);
  }
}
