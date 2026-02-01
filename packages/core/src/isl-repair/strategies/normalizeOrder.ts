/**
 * Normalize Order Repair Strategy
 *
 * Normalizes the ordering of AST elements for consistency.
 */

import type { Domain, Entity, Behavior, TypeDeclaration, Field } from '@isl-lang/parser';
import type {
  RepairStrategy,
  RepairContext,
  RepairStrategyResult,
  Repair,
  UnrepairedError,
} from '../types.js';

/**
 * Sort items by their name property
 */
function sortByName<T extends { name?: { name?: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = a.name?.name ?? '';
    const nameB = b.name?.name ?? '';
    return nameA.localeCompare(nameB);
  });
}

/**
 * Check if two arrays have the same order
 */
function hasSameOrder<T>(original: T[], sorted: T[]): boolean {
  if (original.length !== sorted.length) return false;
  for (let i = 0; i < original.length; i++) {
    if (original[i] !== sorted[i]) return false;
  }
  return true;
}

/**
 * Get names from an array of named items
 */
function getNames<T extends { name?: { name?: string } }>(items: T[]): string[] {
  return items.map((item) => item.name?.name ?? '<unnamed>');
}

/**
 * Normalize Order Repair Strategy
 *
 * Normalizes:
 * - Types are sorted alphabetically by name
 * - Entities are sorted alphabetically by name
 * - Behaviors are sorted alphabetically by name
 * - Entity fields maintain declaration order but can be normalized
 * - Imports are sorted by source path
 */
export const normalizeOrderStrategy: RepairStrategy = {
  name: 'normalize-order',
  description: 'Normalizes ordering of AST elements for consistency',
  categories: ['normalize-order'],

  apply(ctx: RepairContext): RepairStrategyResult {
    const repairs: Repair[] = [];
    const unrepaired: UnrepairedError[] = [];
    const ast = ctx.ast;

    // Normalize types order
    if (ast.types && ast.types.length > 1) {
      const originalOrder = getNames(ast.types);
      const sorted = sortByName(ast.types);

      if (!hasSameOrder(ast.types, sorted)) {
        const newOrder = getNames(sorted);
        ast.types = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.types',
          reason: 'Types should be sorted alphabetically for consistency',
          diffSummary: `Reordered types: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Normalize entities order
    if (ast.entities && ast.entities.length > 1) {
      const originalOrder = getNames(ast.entities);
      const sorted = sortByName(ast.entities);

      if (!hasSameOrder(ast.entities, sorted)) {
        const newOrder = getNames(sorted);
        ast.entities = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.entities',
          reason: 'Entities should be sorted alphabetically for consistency',
          diffSummary: `Reordered entities: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Normalize behaviors order
    if (ast.behaviors && ast.behaviors.length > 1) {
      const originalOrder = getNames(ast.behaviors);
      const sorted = sortByName(ast.behaviors);

      if (!hasSameOrder(ast.behaviors, sorted)) {
        const newOrder = getNames(sorted);
        ast.behaviors = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.behaviors',
          reason: 'Behaviors should be sorted alphabetically for consistency',
          diffSummary: `Reordered behaviors: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Normalize imports order (by source path)
    if (ast.imports && ast.imports.length > 1) {
      const originalOrder = ast.imports.map((imp) => imp.from?.value ?? '<unknown>');
      const sorted = [...ast.imports].sort((a, b) => {
        const pathA = a.from?.value ?? '';
        const pathB = b.from?.value ?? '';
        return pathA.localeCompare(pathB);
      });

      const newOrder = sorted.map((imp) => imp.from?.value ?? '<unknown>');
      if (!hasSameOrder(ast.imports, sorted)) {
        ast.imports = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.imports',
          reason: 'Imports should be sorted by source path for consistency',
          diffSummary: `Reordered imports: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Normalize invariant blocks order
    if (ast.invariants && ast.invariants.length > 1) {
      const originalOrder = getNames(ast.invariants);
      const sorted = sortByName(ast.invariants);

      if (!hasSameOrder(ast.invariants, sorted)) {
        const newOrder = getNames(sorted);
        ast.invariants = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.invariants',
          reason: 'Invariant blocks should be sorted alphabetically',
          diffSummary: `Reordered invariants: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Normalize policies order
    if (ast.policies && ast.policies.length > 1) {
      const originalOrder = getNames(ast.policies);
      const sorted = sortByName(ast.policies);

      if (!hasSameOrder(ast.policies, sorted)) {
        const newOrder = getNames(sorted);
        ast.policies = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.policies',
          reason: 'Policies should be sorted alphabetically',
          diffSummary: `Reordered policies: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Normalize views order
    if (ast.views && ast.views.length > 1) {
      const originalOrder = getNames(ast.views);
      const sorted = sortByName(ast.views);

      if (!hasSameOrder(ast.views, sorted)) {
        const newOrder = getNames(sorted);
        ast.views = sorted;
        repairs.push({
          id: ctx.generateId(),
          category: 'normalize-order',
          path: 'domain.views',
          reason: 'Views should be sorted alphabetically',
          diffSummary: `Reordered views: [${originalOrder.join(', ')}] -> [${newOrder.join(', ')}]`,
          originalValue: originalOrder,
          repairedValue: newOrder,
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    return { repairs, unrepaired };
  },
};

export default normalizeOrderStrategy;
