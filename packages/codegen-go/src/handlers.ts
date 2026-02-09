// ============================================================================
// Go Handler Skeleton Generator
// Generates handler functions with precondition checks from ISL behaviors
// ============================================================================

import type {
  Behavior,
  Expression,
  BinaryExpr,
  MemberExpr,
  CallExpr,
  Identifier,
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
} from './ast-types.js';

import {
  toGoName,
  toSnakeCase,
  type GoImports,
  emptyImports,
} from './types.js';

// Generated handler result
export interface GeneratedHandler {
  name: string;
  code: string;
  imports: GoImports;
}

/**
 * Generate handler function skeletons for all behaviors in a domain
 */
export function generateHandlers(
  serviceName: string,
  behaviors: Behavior[],
): GeneratedHandler[] {
  return behaviors.map(b => generateHandlerSkeleton(serviceName, b));
}

/**
 * Generate a single handler skeleton with precondition checks
 */
export function generateHandlerSkeleton(
  serviceName: string,
  behavior: Behavior,
): GeneratedHandler {
  const imports = emptyImports();
  imports.standard.add('context');
  imports.standard.add('fmt');

  const handlerName = toGoName(behavior.name.name);
  const inputType = `${handlerName}Input`;
  const outputType = `${handlerName}Output`;
  const errorType = `${handlerName}Error`;
  const receiverName = toSnakeCase(serviceName).charAt(0);
  const structName = `${toGoName(serviceName)}ServiceImpl`;
  const lines: string[] = [];

  // Doc comment
  if (behavior.description) {
    lines.push(`// Handle${handlerName} ${behavior.description.value}`);
  } else {
    lines.push(`// Handle${handlerName} handles the ${behavior.name.name} behavior.`);
  }

  // Function signature
  lines.push(`func (${receiverName} *${structName}) ${handlerName}(ctx context.Context, input ${inputType}) (*${outputType}, error) {`);

  // Precondition checks
  if (behavior.preconditions.length > 0) {
    lines.push('\t// Precondition checks');
    for (const precondition of behavior.preconditions) {
      const check = renderPreconditionCheck(precondition, errorType);
      lines.push(...check.lines.map(l => `\t${l}`));
      mergeInto(imports, check.imports);
    }
    lines.push('');
  }

  // Validation
  lines.push('\t// Validate input');
  lines.push(`\tif err := validate.Struct(&input); err != nil {`);
  lines.push(`\t\treturn nil, fmt.Errorf("validation failed: %w", err)`);
  lines.push('\t}');
  lines.push('');

  // TODO body
  lines.push('\t// TODO: Implement business logic');
  lines.push(`\treturn nil, fmt.Errorf("${toSnakeCase(handlerName)}: not implemented")`);
  lines.push('}');

  return {
    name: `Handle${handlerName}`,
    code: lines.join('\n'),
    imports,
  };
}

/**
 * Generate the service implementation struct
 */
export function generateServiceImpl(
  serviceName: string,
  behaviors: Behavior[],
): { code: string; imports: GoImports } {
  const implName = `${toGoName(serviceName)}ServiceImpl`;
  const interfaceName = `${toGoName(serviceName)}Service`;
  const lines: string[] = [];

  lines.push(`// ${implName} implements ${interfaceName}.`);
  lines.push(`type ${implName} struct {`);
  lines.push('\t// TODO: Add dependencies (e.g., database, logger)');
  lines.push('}');
  lines.push('');

  // Constructor
  lines.push(`// New${toGoName(serviceName)}Service creates a new ${implName}.`);
  lines.push(`func New${toGoName(serviceName)}Service() *${implName} {`);
  lines.push(`\treturn &${implName}{}`);
  lines.push('}');

  // Compile-time interface check
  lines.push('');
  lines.push(`// Ensure ${implName} implements ${interfaceName}.`);
  lines.push(`var _ ${interfaceName} = (*${implName})(nil)`);

  return {
    code: lines.join('\n'),
    imports: emptyImports(),
  };
}

/**
 * Render a precondition check as Go code
 */
function renderPreconditionCheck(
  expr: Expression,
  errorType: string,
): { lines: string[]; imports: GoImports } {
  const imports = emptyImports();
  const condStr = renderExpression(expr);
  const description = describeExpression(expr);

  const lines: string[] = [];
  lines.push(`if !(${condStr}) {`);
  lines.push(`\treturn nil, &${errorType}{`);
  lines.push(`\t\tCode:    "PRECONDITION_FAILED",`);
  lines.push(`\t\tMessage: "Precondition failed: ${description}",`);
  lines.push(`\t}`);
  lines.push('}');

  return { lines, imports };
}

/**
 * Render an AST expression as Go code (best-effort)
 */
function renderExpression(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return toGoName((expr as Identifier).name);

    case 'MemberExpr': {
      const me = expr as MemberExpr;
      const obj = renderExpression(me.object);
      const prop = toGoName(me.property.name);
      return `${obj}.${prop}`;
    }

    case 'BinaryExpr': {
      const be = expr as BinaryExpr;
      const left = renderExpression(be.left);
      const right = renderExpression(be.right);
      const op = mapOperator(be.operator);
      return `${left} ${op} ${right}`;
    }

    case 'CallExpr': {
      const ce = expr as CallExpr;
      const callee = renderExpression(ce.callee);
      const args = ce.arguments.map(a => renderExpression(a)).join(', ');
      return `${callee}(${args})`;
    }

    case 'StringLiteral':
      return `"${(expr as StringLiteral).value}"`;

    case 'NumberLiteral':
      return String((expr as NumberLiteral).value);

    case 'BooleanLiteral':
      return String((expr as BooleanLiteral).value);

    case 'InputExpr':
      return `input.${toGoName((expr as { property: Identifier }).property.name)}`;

    default:
      return `true /* TODO: translate ${expr.kind} */`;
  }
}

/**
 * Map ISL operator to Go operator
 */
function mapOperator(op: string): string {
  const opMap: Record<string, string> = {
    '==': '==',
    '!=': '!=',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    'and': '&&',
    'or': '||',
    'not': '!',
    '+': '+',
    '-': '-',
    '*': '*',
    '/': '/',
  };
  return opMap[op] ?? op;
}

/**
 * Generate a human-readable description of an expression for error messages
 */
function describeExpression(expr: Expression): string {
  switch (expr.kind) {
    case 'BinaryExpr': {
      const be = expr as BinaryExpr;
      return `${describeExpression(be.left)} ${be.operator} ${describeExpression(be.right)}`;
    }
    case 'MemberExpr': {
      const me = expr as MemberExpr;
      return `${describeExpression(me.object)}.${me.property.name}`;
    }
    case 'Identifier':
      return (expr as Identifier).name;
    case 'InputExpr':
      return `input.${(expr as { property: Identifier }).property.name}`;
    case 'StringLiteral':
      return (expr as StringLiteral).value;
    case 'NumberLiteral':
      return String((expr as NumberLiteral).value);
    default:
      return expr.kind;
  }
}

/**
 * Merge imports in place
 */
function mergeInto(target: GoImports, source: GoImports): void {
  source.standard.forEach(i => target.standard.add(i));
  source.external.forEach(i => target.external.add(i));
}
