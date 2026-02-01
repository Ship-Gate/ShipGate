/**
 * Logical Mutation Operators
 * 
 * Mutates logical operators: and, or, not, implies
 */

import { MutationOperator, MutantCandidate } from '../types';

/** Logical operator replacements */
const LOGICAL_REPLACEMENTS: Record<string, string[]> = {
  'and': ['or'],
  'or': ['and'],
  '&&': ['||'],
  '||': ['&&'],
  'implies': ['and', 'or'],
};

/**
 * Logical binary operator mutation
 */
export const logicalBinaryOperator: MutationOperator = {
  name: 'LogicalBinaryOperator',
  type: 'logical',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'LogicalExpression' &&
      typeof node.operator === 'string' &&
      node.operator in LOGICAL_REPLACEMENTS
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const original = node.operator;
    const replacements = LOGICAL_REPLACEMENTS[original] || [];

    return replacements.map((replacement) => ({
      type: 'logical',
      original,
      mutated: replacement,
      description: `Replace '${original}' with '${replacement}'`,
      location: {},
    }));
  },
};

/**
 * Negation mutation (remove or add 'not')
 */
export const logicalNegationOperator: MutationOperator = {
  name: 'LogicalNegationOperator',
  type: 'logical',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      (node.type === 'UnaryExpression' || node.type === 'NegationExpression') &&
      (node.operator === 'not' || node.operator === '!')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    // Remove the negation
    return [
      {
        type: 'logical',
        original: 'not <expression>',
        mutated: '<expression>',
        description: 'Remove negation operator',
        location: {},
      },
    ];
  },
};

/**
 * ISL implies mutation
 * Special handling for ISL's 'implies' operator
 */
export const impliesOperator: MutationOperator = {
  name: 'ImpliesOperator',
  type: 'logical',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'ImpliesExpression'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // implies -> and
    candidates.push({
      type: 'logical',
      original: 'A implies B',
      mutated: 'A and B',
      description: "Replace 'implies' with 'and'",
      location: {},
    });

    // implies -> or
    candidates.push({
      type: 'logical',
      original: 'A implies B',
      mutated: 'A or B',
      description: "Replace 'implies' with 'or'",
      location: {},
    });

    // Swap operands
    candidates.push({
      type: 'logical',
      original: 'A implies B',
      mutated: 'B implies A',
      description: 'Swap implies operands',
      location: {},
    });

    // Negate antecedent
    candidates.push({
      type: 'logical',
      original: 'A implies B',
      mutated: 'not A implies B',
      description: 'Negate antecedent',
      location: {},
    });

    // Negate consequent
    candidates.push({
      type: 'logical',
      original: 'A implies B',
      mutated: 'A implies not B',
      description: 'Negate consequent',
      location: {},
    });

    return candidates;
  },
};

/**
 * ISL precondition logical mutation
 */
export const preconditionLogicalOperator: MutationOperator = {
  name: 'PreconditionLogicalOperator',
  type: 'logical',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'Precondition' &&
      (hasNegation(node) || hasLogicalOp(node))
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // Negate the entire precondition
    candidates.push({
      type: 'logical',
      original: 'precondition: <condition>',
      mutated: 'precondition: not <condition>',
      description: 'Negate precondition',
      location: {},
    });

    // Remove precondition entirely
    candidates.push({
      type: 'logical',
      original: 'precondition: <condition>',
      mutated: '// precondition removed',
      description: 'Remove precondition',
      location: {},
    });

    return candidates;
  },
};

/**
 * Condition removal mutation
 * Removes conditions from compound logical expressions
 */
export const conditionRemovalOperator: MutationOperator = {
  name: 'ConditionRemovalOperator',
  type: 'logical',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'LogicalExpression' &&
      (node.operator === 'and' || node.operator === '&&')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // Remove left operand
    candidates.push({
      type: 'logical',
      original: 'A and B',
      mutated: 'B',
      description: 'Remove left operand from AND expression',
      location: {},
    });

    // Remove right operand
    candidates.push({
      type: 'logical',
      original: 'A and B',
      mutated: 'A',
      description: 'Remove right operand from AND expression',
      location: {},
    });

    return candidates;
  },
};

/**
 * Always true/false mutation
 */
export const alwaysTrueFalseOperator: MutationOperator = {
  name: 'AlwaysTrueFalseOperator',
  type: 'logical',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      (node.type === 'BooleanLiteral' ||
       node.type === 'LogicalExpression' ||
       node.type === 'BinaryExpression')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // Replace with true
    candidates.push({
      type: 'logical',
      original: '<expression>',
      mutated: 'true',
      description: 'Replace expression with always true',
      location: {},
    });

    // Replace with false
    candidates.push({
      type: 'logical',
      original: '<expression>',
      mutated: 'false',
      description: 'Replace expression with always false',
      location: {},
    });

    return candidates;
  },
};

/** All logical operators */
export const logicalOperators: MutationOperator[] = [
  logicalBinaryOperator,
  logicalNegationOperator,
  impliesOperator,
  preconditionLogicalOperator,
  conditionRemovalOperator,
  alwaysTrueFalseOperator,
];

// Type guard helpers
function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function hasNegation(node: Record<string, unknown>): boolean {
  return 'negated' in node && node.negated === true;
}

function hasLogicalOp(node: Record<string, unknown>): boolean {
  return 'operator' in node && 
    (node.operator === 'and' || node.operator === 'or' || 
     node.operator === '&&' || node.operator === '||');
}
