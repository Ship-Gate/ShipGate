/**
 * Null/Optional Mutation Operators
 * 
 * Mutates optional handling: ?, null checks, default values
 */

import { MutationOperator, MutantCandidate } from '../types';

/**
 * Optional field mutation
 * Changes required to optional and vice versa
 */
export const optionalFieldOperator: MutationOperator = {
  name: 'OptionalFieldOperator',
  type: 'null',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'FieldDefinition' &&
      typeof node.optional === 'boolean'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const isOptional = node.optional === true;
    const fieldName = (node.name as string) || 'field';

    if (isOptional) {
      // Make required
      return [
        {
          type: 'null',
          original: `${fieldName}?`,
          mutated: fieldName,
          description: `Make optional field '${fieldName}' required`,
          location: {},
        },
      ];
    } else {
      // Make optional
      return [
        {
          type: 'null',
          original: fieldName,
          mutated: `${fieldName}?`,
          description: `Make required field '${fieldName}' optional`,
          location: {},
        },
      ];
    }
  },
};

/**
 * Null check removal mutation
 */
export const nullCheckRemovalOperator: MutationOperator = {
  name: 'NullCheckRemovalOperator',
  type: 'null',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'BinaryExpression' &&
      (node.operator === '!=' || node.operator === '==') &&
      (node.right === null || node.right === 'null')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node) || typeof node.operator !== 'string') {
      return [];
    }

    const candidates: MutantCandidate[] = [];

    if (node.operator === '!=') {
      // x != null -> true (remove null check)
      candidates.push({
        type: 'null',
        original: '!= null',
        mutated: 'true',
        description: 'Remove null check (assume not null)',
        location: {},
      });

      // x != null -> x == null (invert)
      candidates.push({
        type: 'null',
        original: '!= null',
        mutated: '== null',
        description: 'Invert null check',
        location: {},
      });
    } else if (node.operator === '==') {
      // x == null -> false (remove null check)
      candidates.push({
        type: 'null',
        original: '== null',
        mutated: 'false',
        description: 'Remove null check (assume not null)',
        location: {},
      });

      // x == null -> x != null (invert)
      candidates.push({
        type: 'null',
        original: '== null',
        mutated: '!= null',
        description: 'Invert null check',
        location: {},
      });
    }

    return candidates;
  },
};

/**
 * Default value mutation
 */
export const defaultValueOperator: MutationOperator = {
  name: 'DefaultValueOperator',
  type: 'null',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'FieldModifier' &&
      hasProperty(node, 'default')
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const defaultValue = node.default;
    const candidates: MutantCandidate[] = [];

    // Remove default
    candidates.push({
      type: 'null',
      original: `[default: ${defaultValue}]`,
      mutated: '// default removed',
      description: 'Remove default value',
      location: {},
    });

    // Change default based on type
    if (typeof defaultValue === 'number') {
      candidates.push({
        type: 'null',
        original: `[default: ${defaultValue}]`,
        mutated: '[default: 0]',
        description: 'Change default to 0',
        location: {},
      });
    } else if (typeof defaultValue === 'boolean') {
      candidates.push({
        type: 'null',
        original: `[default: ${defaultValue}]`,
        mutated: `[default: ${!defaultValue}]`,
        description: `Change default from ${defaultValue} to ${!defaultValue}`,
        location: {},
      });
    } else if (typeof defaultValue === 'string') {
      candidates.push({
        type: 'null',
        original: `[default: "${defaultValue}"]`,
        mutated: '[default: ""]',
        description: 'Change default to empty string',
        location: {},
      });
    }

    return candidates;
  },
};

/**
 * ISL implies null mutation
 * Mutates patterns like: status == X implies field != null
 */
export const impliesNullOperator: MutationOperator = {
  name: 'ImpliesNullOperator',
  type: 'null',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'ImpliesExpression' &&
      hasNullCheck(node)
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // Remove the implies entirely
    candidates.push({
      type: 'null',
      original: 'status == X implies field != null',
      mutated: '// invariant removed',
      description: 'Remove null check invariant',
      location: {},
    });

    // Invert the null check
    candidates.push({
      type: 'null',
      original: 'implies field != null',
      mutated: 'implies field == null',
      description: 'Invert null check in invariant',
      location: {},
    });

    return candidates;
  },
};

/**
 * Optional chaining mutation
 */
export const optionalChainingOperator: MutationOperator = {
  name: 'OptionalChainingOperator',
  type: 'null',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'OptionalMemberExpression'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    return [
      {
        type: 'null',
        original: 'object?.property',
        mutated: 'object.property',
        description: 'Remove optional chaining (assume not null)',
        location: {},
      },
    ];
  },
};

/**
 * Nullish coalescing mutation
 */
export const nullishCoalescingOperator: MutationOperator = {
  name: 'NullishCoalescingOperator',
  type: 'null',

  canApply(node: unknown): boolean {
    return (
      isNode(node) &&
      node.type === 'BinaryExpression' &&
      node.operator === '??'
    );
  },

  apply(node: unknown): MutantCandidate[] {
    if (!isNode(node)) return [];

    const candidates: MutantCandidate[] = [];

    // Always use left (assume not null)
    candidates.push({
      type: 'null',
      original: 'value ?? default',
      mutated: 'value',
      description: 'Remove nullish coalescing (assume not null)',
      location: {},
    });

    // Always use right (assume null)
    candidates.push({
      type: 'null',
      original: 'value ?? default',
      mutated: 'default',
      description: 'Always use default (assume null)',
      location: {},
    });

    return candidates;
  },
};

/** All null operators */
export const nullOperators: MutationOperator[] = [
  optionalFieldOperator,
  nullCheckRemovalOperator,
  defaultValueOperator,
  impliesNullOperator,
  optionalChainingOperator,
  nullishCoalescingOperator,
];

// Type guard helpers
function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

function hasNullCheck(node: Record<string, unknown>): boolean {
  const consequent = node.consequent as Record<string, unknown> | undefined;
  return (
    consequent !== undefined &&
    typeof consequent === 'object' &&
    consequent !== null &&
    (consequent.operator === '!=' || consequent.operator === '==') &&
    (consequent.right === null || consequent.right === 'null')
  );
}
