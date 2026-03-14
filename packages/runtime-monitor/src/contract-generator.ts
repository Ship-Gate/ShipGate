import { parse } from '@isl-lang/parser';
import type {
  Domain,
  Behavior,
  Expression,
  Identifier,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
  QuantifierExpr,
  SecuritySpec,
  Field,
  EndpointDecl,
  ResultExpr,
  InputExpr,
  QualifiedName,
  OldExpr,
  ConditionalExpr,
  IndexExpr,
  ListExpr,
} from '@isl-lang/parser';
import type { Contract, Assertion, HttpMethod } from './types.js';

interface EndpointMapping {
  method: HttpMethod;
  path: string;
}

export function generateContracts(specSource: string): Contract[] {
  const result = parse(specSource);
  if (!result.success || !result.domain) {
    return [];
  }
  return extractContracts(result.domain);
}

function extractContracts(domain: Domain): Contract[] {
  const contracts: Contract[] = [];
  const endpointMap = buildEndpointMap(domain);

  for (const behavior of domain.behaviors) {
    const mapping = endpointMap.get(behavior.name.name);
    const route = mapping?.path ?? `/${kebabCase(behavior.name.name)}`;
    const method = mapping?.method ?? inferMethodFromName(behavior.name.name);

    const contract: Contract = {
      id: `${domain.name.name}.${behavior.name.name}`,
      route,
      method,
      preconditions: extractPreconditions(behavior),
      postconditions: extractPostconditions(behavior),
      invariants: extractInvariants(behavior),
    };

    contracts.push(contract);
  }

  return contracts;
}

function buildEndpointMap(domain: Domain): Map<string, EndpointMapping> {
  const map = new Map<string, EndpointMapping>();
  for (const api of domain.apis) {
    const basePath = api.basePath?.value ?? '';
    for (const endpoint of api.endpoints) {
      if (endpoint.behavior) {
        const fullPath = `${basePath}${endpoint.path.value}`;
        map.set(endpoint.behavior.name, {
          method: normalizeMethod(endpoint.method),
          path: fullPath,
        });
      }
    }
  }
  return map;
}

function normalizeMethod(method: EndpointDecl['method']): HttpMethod {
  if (method === 'WEBSOCKET') return 'GET';
  return method;
}

function extractPreconditions(behavior: Behavior): Assertion[] {
  const assertions: Assertion[] = [];

  for (const expr of behavior.preconditions) {
    assertions.push({
      expression: serializeExpression(expr),
      description: `Precondition: ${serializeExpression(expr)}`,
      severity: 'critical',
      source: 'isl-spec',
    });
  }

  for (const sec of behavior.security) {
    const secAssertions = securityToAssertions(sec);
    assertions.push(...secAssertions);
  }

  for (const field of behavior.input.fields) {
    const fieldAssertions = inputFieldToAssertions(field);
    assertions.push(...fieldAssertions);
  }

  return assertions;
}

function extractPostconditions(behavior: Behavior): Assertion[] {
  const assertions: Assertion[] = [];

  for (const block of behavior.postconditions) {
    const condLabel = typeof block.condition === 'string'
      ? block.condition
      : block.condition.name;

    for (const predicate of block.predicates) {
      assertions.push({
        expression: serializeExpression(predicate),
        description: `Postcondition (${condLabel}): ${serializeExpression(predicate)}`,
        severity: condLabel === 'success' ? 'critical' : 'warning',
        source: 'isl-spec',
      });
    }
  }

  if (behavior.output.success) {
    const typeAssertions = outputTypeToAssertions(behavior.output.success);
    assertions.push(...typeAssertions);
  }

  for (const errorSpec of behavior.output.errors) {
    assertions.push({
      expression: `error.name == "${errorSpec.name.name}"`,
      description: `Error type ${errorSpec.name.name} must be a valid error response`,
      severity: 'warning',
      source: 'inferred',
    });
  }

  return assertions;
}

function extractInvariants(behavior: Behavior): Assertion[] {
  return behavior.invariants.map((expr) => ({
    expression: serializeExpression(expr),
    description: `Invariant: ${serializeExpression(expr)}`,
    severity: 'critical',
    source: 'isl-spec' as const,
  }));
}

function securityToAssertions(sec: SecuritySpec): Assertion[] {
  const assertions: Assertion[] = [];
  const detailStr = serializeExpression(sec.details);

  if (sec.type === 'requires') {
    if (detailStr.includes('authenticated') || detailStr.includes('auth')) {
      assertions.push({
        expression: 'req.user != null',
        description: 'Request must be authenticated (user must exist)',
        severity: 'critical',
        source: 'isl-spec',
      });
      assertions.push({
        expression: 'req.headers.authorization != null',
        description: 'Authorization header must be present',
        severity: 'critical',
        source: 'inferred',
      });
    }

    const roleMatch = detailStr.match(/role\s*==\s*"(\w+)"/);
    if (roleMatch) {
      assertions.push({
        expression: `req.user.role == "${roleMatch[1]}"`,
        description: `User must have role: ${roleMatch[1]}`,
        severity: 'critical',
        source: 'isl-spec',
      });
    }
  }

  if (sec.type === 'rate_limit') {
    assertions.push({
      expression: `rate_limit_check(${detailStr})`,
      description: `Rate limit: ${detailStr}`,
      severity: 'warning',
      source: 'isl-spec',
    });
  }

  return assertions;
}

function inputFieldToAssertions(field: Field): Assertion[] {
  const assertions: Assertion[] = [];
  const fieldName = field.name.name;

  if (!field.optional) {
    assertions.push({
      expression: `req.body.${fieldName} != null`,
      description: `Required field: ${fieldName}`,
      severity: 'critical',
      source: 'inferred',
    });
  }

  if (field.type.kind === 'ReferenceType') {
    const typeName = field.type.name.parts.map((p) => p.name).join('.');
    const typeValidation = inferTypeValidation(fieldName, typeName);
    if (typeValidation) {
      assertions.push(typeValidation);
    }
  }

  if (field.type.kind === 'PrimitiveType') {
    const typeCheck = primitiveTypeCheck(fieldName, field.type.name);
    if (typeCheck) {
      assertions.push(typeCheck);
    }
  }

  if (field.type.kind === 'ConstrainedType' && field.type.constraints) {
    for (const constraint of field.type.constraints) {
      const constraintStr = serializeExpression(constraint.value);
      assertions.push({
        expression: `req.body.${fieldName}.${constraint.name} == ${constraintStr}`,
        description: `Field ${fieldName} constraint: ${constraint.name} = ${constraintStr}`,
        severity: 'warning',
        source: 'isl-spec',
      });
    }
  }

  return assertions;
}

function inferTypeValidation(fieldName: string, typeName: string): Assertion | null {
  const lower = typeName.toLowerCase();

  if (lower === 'email') {
    return {
      expression: `typeof req.body.${fieldName} == "string" && req.body.${fieldName}.match(/^[^@]+@[^@]+\\.[^@]+$/)`,
      description: `Field ${fieldName} must be a valid email address`,
      severity: 'warning',
      source: 'inferred',
    };
  }

  if (lower === 'url' || lower === 'uri') {
    return {
      expression: `typeof req.body.${fieldName} == "string" && req.body.${fieldName}.match(/^https?:\\/\\//)`,
      description: `Field ${fieldName} must be a valid URL`,
      severity: 'warning',
      source: 'inferred',
    };
  }

  if (lower === 'uuid') {
    return {
      expression: `typeof req.body.${fieldName} == "string" && req.body.${fieldName}.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)`,
      description: `Field ${fieldName} must be a valid UUID`,
      severity: 'warning',
      source: 'inferred',
    };
  }

  if (lower === 'phone' || lower === 'phonenumber') {
    return {
      expression: `typeof req.body.${fieldName} == "string" && req.body.${fieldName}.match(/^\\+?[0-9\\-\\s()]+$/)`,
      description: `Field ${fieldName} must be a valid phone number`,
      severity: 'warning',
      source: 'inferred',
    };
  }

  return null;
}

function primitiveTypeCheck(fieldName: string, typeName: string): Assertion | null {
  const typeMap: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Decimal: 'number',
    Boolean: 'boolean',
  };

  const jsType = typeMap[typeName];
  if (jsType) {
    return {
      expression: `typeof req.body.${fieldName} == "${jsType}"`,
      description: `Field ${fieldName} must be of type ${typeName}`,
      severity: 'warning',
      source: 'inferred',
    };
  }

  return null;
}

function outputTypeToAssertions(typeDef: import('@isl-lang/parser').TypeDefinition): Assertion[] {
  const assertions: Assertion[] = [];

  if (typeDef.kind === 'StructType') {
    for (const field of typeDef.fields) {
      if (!field.optional) {
        assertions.push({
          expression: `res.body.${field.name.name} != null`,
          description: `Response must include field: ${field.name.name}`,
          severity: 'warning',
          source: 'inferred',
        });
      }
    }
  }

  return assertions;
}

export function serializeExpression(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return (expr as Identifier).name;

    case 'QualifiedName':
      return (expr as QualifiedName).parts.map((p) => p.name).join('.');

    case 'StringLiteral':
      return `"${(expr as StringLiteral).value}"`;

    case 'NumberLiteral':
      return String((expr as NumberLiteral).value);

    case 'BooleanLiteral':
      return String((expr as BooleanLiteral).value);

    case 'NullLiteral':
      return 'null';

    case 'BinaryExpr': {
      const bin = expr as BinaryExpr;
      return `${serializeExpression(bin.left)} ${bin.operator} ${serializeExpression(bin.right)}`;
    }

    case 'UnaryExpr': {
      const un = expr as UnaryExpr;
      return `${un.operator} ${serializeExpression(un.operand)}`;
    }

    case 'CallExpr': {
      const call = expr as CallExpr;
      const callee = serializeExpression(call.callee);
      const args = call.arguments.map(serializeExpression).join(', ');
      return `${callee}(${args})`;
    }

    case 'MemberExpr': {
      const mem = expr as MemberExpr;
      return `${serializeExpression(mem.object)}.${mem.property.name}`;
    }

    case 'IndexExpr': {
      const idx = expr as IndexExpr;
      return `${serializeExpression(idx.object)}[${serializeExpression(idx.index)}]`;
    }

    case 'QuantifierExpr': {
      const q = expr as QuantifierExpr;
      return `${q.quantifier}(${q.variable.name} in ${serializeExpression(q.collection)}, ${serializeExpression(q.predicate)})`;
    }

    case 'ConditionalExpr': {
      const c = expr as ConditionalExpr;
      return `if ${serializeExpression(c.condition)} then ${serializeExpression(c.thenBranch)} else ${serializeExpression(c.elseBranch)}`;
    }

    case 'OldExpr':
      return `old(${serializeExpression((expr as OldExpr).expression)})`;

    case 'ResultExpr': {
      const r = expr as ResultExpr;
      return r.property ? `result.${r.property.name}` : 'result';
    }

    case 'InputExpr':
      return `input.${(expr as InputExpr).property.name}`;

    case 'LambdaExpr':
      return `(${expr.params.map((p: Identifier) => p.name).join(', ')}) => ${serializeExpression(expr.body)}`;

    case 'ListExpr':
      return `[${(expr as ListExpr).elements.map(serializeExpression).join(', ')}]`;

    case 'MapExpr':
      return `{${expr.entries.map((e: { key: Expression; value: Expression }) => `${serializeExpression(e.key)}: ${serializeExpression(e.value)}`).join(', ')}}`;

    case 'DurationLiteral':
      return `${expr.value}${expr.unit}`;

    case 'RegexLiteral':
      return `/${expr.pattern}/${expr.flags}`;

    default:
      return '<unknown>';
  }
}

function inferMethodFromName(name: string): HttpMethod {
  const lower = name.toLowerCase();
  if (lower.startsWith('create') || lower.startsWith('register') || lower.startsWith('add') || lower.startsWith('submit')) return 'POST';
  if (lower.startsWith('update') || lower.startsWith('edit') || lower.startsWith('modify')) return 'PUT';
  if (lower.startsWith('patch')) return 'PATCH';
  if (lower.startsWith('delete') || lower.startsWith('remove') || lower.startsWith('cancel')) return 'DELETE';
  return 'GET';
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}
