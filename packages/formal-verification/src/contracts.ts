/**
 * ISL Contract Translation
 * 
 * Translate ISL specifications to logical formulas.
 */

import type {
  Formula,
  Sort,
  Variable,
  VerificationContext,
  ISLBehavior,
  ISLSpecification,
} from './types';

/**
 * Translate ISL expression to formula
 */
export function translateToFormula(
  expression: string,
  context: VerificationContext
): Formula {
  // Parse and translate ISL expression to formula
  // This is a simplified parser - real implementation would be more sophisticated
  
  const expr = expression.trim();

  // Handle logical operators
  if (expr.includes(' and ')) {
    const parts = expr.split(' and ');
    return {
      kind: 'and',
      args: parts.map((p) => translateToFormula(p.trim(), context)),
    };
  }

  if (expr.includes(' or ')) {
    const parts = expr.split(' or ');
    return {
      kind: 'or',
      args: parts.map((p) => translateToFormula(p.trim(), context)),
    };
  }

  if (expr.startsWith('not ')) {
    return {
      kind: 'not',
      arg: translateToFormula(expr.substring(4), context),
    };
  }

  if (expr.includes(' implies ')) {
    const [left, right] = expr.split(' implies ');
    return {
      kind: 'implies',
      left: translateToFormula(left.trim(), context),
      right: translateToFormula(right.trim(), context),
    };
  }

  // Handle comparisons
  const comparisonOps = ['!=', '==', '>=', '<=', '>', '<'];
  for (const op of comparisonOps) {
    if (expr.includes(op)) {
      const [left, right] = expr.split(op);
      const leftFormula = translateTerm(left.trim(), context);
      const rightFormula = translateTerm(right.trim(), context);

      switch (op) {
        case '==':
          return { kind: 'eq', left: leftFormula, right: rightFormula };
        case '!=':
          return { kind: 'not', arg: { kind: 'eq', left: leftFormula, right: rightFormula } };
        case '<':
          return { kind: 'lt', left: leftFormula, right: rightFormula };
        case '<=':
          return { kind: 'le', left: leftFormula, right: rightFormula };
        case '>':
          return { kind: 'gt', left: leftFormula, right: rightFormula };
        case '>=':
          return { kind: 'ge', left: leftFormula, right: rightFormula };
      }
    }
  }

  // Handle special ISL constructs
  if (expr.includes('.exists(')) {
    return translateExistsExpression(expr, context);
  }

  if (expr.includes('.forall(')) {
    return translateForallExpression(expr, context);
  }

  // Boolean literals
  if (expr === 'true') return { kind: 'const', value: true };
  if (expr === 'false') return { kind: 'const', value: false };

  // Variable or field access
  return translateTerm(expr, context);
}

/**
 * Translate ISL term to formula
 */
function translateTerm(term: string, context: VerificationContext): Formula {
  const t = term.trim();

  // Numeric literal
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return { kind: 'const', value: parseFloat(t) };
  }

  // String literal
  if (t.startsWith('"') && t.endsWith('"')) {
    return { kind: 'const', value: t.slice(1, -1) };
  }

  // Boolean literal
  if (t === 'true') return { kind: 'const', value: true };
  if (t === 'false') return { kind: 'const', value: false };

  // Null
  if (t === 'null') return { kind: 'const', value: null as any };

  // Field access (e.g., input.email)
  if (t.includes('.')) {
    const parts = t.split('.');
    let formula: Formula = {
      kind: 'var',
      name: parts[0],
      sort: { kind: 'uninterpreted', name: 'Any' },
    };

    for (let i = 1; i < parts.length; i++) {
      formula = {
        kind: 'app',
        func: 'field',
        args: [formula, { kind: 'const', value: parts[i] }],
      };
    }

    return formula;
  }

  // Simple variable
  return {
    kind: 'var',
    name: t,
    sort: inferSort(t, context),
  };
}

/**
 * Translate ISL exists expression
 */
function translateExistsExpression(expr: string, context: VerificationContext): Formula {
  // Parse: Entity.exists(field: value)
  const match = expr.match(/(\w+)\.exists\(([^)]+)\)/);
  if (!match) {
    return { kind: 'const', value: true };
  }

  const [, entity, conditions] = match;
  const condPairs = conditions.split(',').map((c) => {
    const [key, value] = c.split(':').map((s) => s.trim());
    return { key, value };
  });

  // Create existential formula
  const boundVar: Variable = {
    name: `_${entity.toLowerCase()}`,
    sort: { kind: 'uninterpreted', name: entity },
  };

  const constraints = condPairs.map((pair) => ({
    kind: 'eq' as const,
    left: {
      kind: 'app' as const,
      func: 'field',
      args: [
        { kind: 'var' as const, name: boundVar.name, sort: boundVar.sort },
        { kind: 'const' as const, value: pair.key },
      ],
    },
    right: translateTerm(pair.value, context),
  }));

  return {
    kind: 'exists',
    vars: [boundVar],
    body: {
      kind: 'and',
      args: constraints,
    },
  };
}

/**
 * Translate ISL forall expression
 */
function translateForallExpression(expr: string, context: VerificationContext): Formula {
  // Parse: Entity.forall(condition)
  const match = expr.match(/(\w+)\.forall\(([^)]+)\)/);
  if (!match) {
    return { kind: 'const', value: true };
  }

  const [, entity, condition] = match;

  const boundVar: Variable = {
    name: `_${entity.toLowerCase()}`,
    sort: { kind: 'uninterpreted', name: entity },
  };

  return {
    kind: 'forall',
    vars: [boundVar],
    body: translateToFormula(condition, {
      ...context,
      bindings: { ...context.bindings, [entity.toLowerCase()]: boundVar.name },
    }),
  };
}

/**
 * Translate precondition
 */
export function translatePrecondition(
  precond: string,
  behavior: ISLBehavior,
  spec: ISLSpecification
): Formula {
  const context: VerificationContext = {
    domain: spec.domain,
    behavior: behavior.name,
    assumptions: [],
    bindings: {},
  };

  // Add input fields to context
  for (const field of behavior.input) {
    context.bindings[`input.${field.name}`] = field.type;
  }

  return translateToFormula(precond, context);
}

/**
 * Translate postcondition
 */
export function translatePostcondition(
  postcond: string,
  behavior: ISLBehavior,
  spec: ISLSpecification
): Formula {
  const context: VerificationContext = {
    domain: spec.domain,
    behavior: behavior.name,
    assumptions: [],
    bindings: {},
  };

  // Handle special postcondition syntax
  if (postcond.includes(' implies ')) {
    const [condition, consequence] = postcond.split(' implies ');
    return {
      kind: 'implies',
      left: translateToFormula(condition.trim(), context),
      right: translateToFormula(consequence.trim(), context),
    };
  }

  return translateToFormula(postcond, context);
}

/**
 * Infer sort from variable name and context
 */
function inferSort(name: string, context: VerificationContext): Sort {
  // Check context bindings
  const binding = context.bindings[name];
  if (binding) {
    return typeToSort(binding as string);
  }

  // Infer from name patterns
  if (name.endsWith('_id') || name === 'id') {
    return { kind: 'string' };
  }
  if (name.includes('count') || name.includes('amount') || name.includes('num')) {
    return { kind: 'int' };
  }
  if (name.includes('price') || name.includes('rate')) {
    return { kind: 'real' };
  }
  if (name.startsWith('is_') || name.startsWith('has_')) {
    return { kind: 'bool' };
  }

  // Default
  return { kind: 'uninterpreted', name: 'Any' };
}

/**
 * Convert ISL type to SMT sort
 */
function typeToSort(type: string): Sort {
  switch (type.toLowerCase()) {
    case 'string':
    case 'email':
    case 'uuid':
      return { kind: 'string' };
    case 'int':
    case 'integer':
      return { kind: 'int' };
    case 'float':
    case 'decimal':
    case 'real':
      return { kind: 'real' };
    case 'boolean':
    case 'bool':
      return { kind: 'bool' };
    default:
      return { kind: 'uninterpreted', name: type };
  }
}
