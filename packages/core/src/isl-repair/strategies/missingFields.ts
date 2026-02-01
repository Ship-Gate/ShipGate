/**
 * Missing Fields Repair Strategy
 *
 * Adds missing required fields to AST nodes with sensible defaults.
 */

import type { Domain, SourceLocation, ASTNode, Identifier, StringLiteral } from '@isl-lang/parser';
import type {
  RepairStrategy,
  RepairContext,
  RepairStrategyResult,
  Repair,
  UnrepairedError,
} from '../types.js';

/**
 * Default source location for synthesized nodes
 */
const DEFAULT_LOCATION: SourceLocation = {
  file: '<synthesized>',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

/**
 * Create a default identifier
 */
function createIdentifier(name: string, location?: SourceLocation): Identifier {
  return {
    kind: 'Identifier',
    name,
    location: location ?? DEFAULT_LOCATION,
  };
}

/**
 * Create a default string literal
 */
function createStringLiteral(value: string, location?: SourceLocation): StringLiteral {
  return {
    kind: 'StringLiteral',
    value,
    location: location ?? DEFAULT_LOCATION,
  };
}

/**
 * Check if a value is effectively missing (undefined, null, or empty)
 */
function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * Missing Fields Repair Strategy
 *
 * Repairs:
 * - Missing domain name and version
 * - Missing required arrays (imports, types, entities, etc.)
 * - Missing entity/behavior names
 * - Missing input/output specs on behaviors
 * - Missing field types and names
 */
export const missingFieldsStrategy: RepairStrategy = {
  name: 'missing-fields',
  description: 'Adds missing required fields with sensible defaults',
  categories: ['missing-field'],

  apply(ctx: RepairContext): RepairStrategyResult {
    const repairs: Repair[] = [];
    const unrepaired: UnrepairedError[] = [];
    const ast = ctx.ast;

    // Repair domain name
    if (isMissing(ast.name) || isMissing(ast.name?.name)) {
      const oldValue = ast.name;
      ast.name = createIdentifier('UnnamedDomain', ast.location);
      repairs.push({
        id: ctx.generateId(),
        category: 'missing-field',
        path: 'domain.name',
        reason: 'Domain must have a name',
        diffSummary: `Added default domain name: "UnnamedDomain"`,
        originalValue: oldValue,
        repairedValue: ast.name,
        confidence: 'medium',
        location: ast.location,
      });
    }

    // Repair domain version
    if (isMissing(ast.version) || isMissing(ast.version?.value)) {
      const oldValue = ast.version;
      ast.version = createStringLiteral('0.1.0', ast.location);
      repairs.push({
        id: ctx.generateId(),
        category: 'missing-field',
        path: 'domain.version',
        reason: 'Domain must have a version',
        diffSummary: `Added default version: "0.1.0"`,
        originalValue: oldValue,
        repairedValue: ast.version,
        confidence: 'medium',
        location: ast.location,
      });
    }

    // Repair missing required arrays at domain level
    const requiredArrays = [
      'imports',
      'types',
      'entities',
      'behaviors',
      'invariants',
      'policies',
      'views',
      'scenarios',
      'chaos',
    ] as const;

    for (const arrayName of requiredArrays) {
      if (isMissing(ast[arrayName])) {
        const key = arrayName as keyof Domain;
        (ast as Record<string, unknown>)[key] = [];
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `domain.${arrayName}`,
          reason: `Domain requires ${arrayName} array`,
          diffSummary: `Initialized empty ${arrayName} array`,
          originalValue: undefined,
          repairedValue: [],
          confidence: 'high',
          location: ast.location,
        });
      }
    }

    // Repair entities
    for (let i = 0; i < (ast.entities?.length ?? 0); i++) {
      const entity = ast.entities[i];
      if (!entity) continue;

      const entityPath = `domain.entities[${i}]`;

      // Missing entity name
      if (isMissing(entity.name) || isMissing(entity.name?.name)) {
        const oldValue = entity.name;
        entity.name = createIdentifier(`Entity${i + 1}`, entity.location);
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${entityPath}.name`,
          reason: 'Entity must have a name',
          diffSummary: `Added default entity name: "Entity${i + 1}"`,
          originalValue: oldValue,
          repairedValue: entity.name,
          confidence: 'medium',
          location: entity.location,
        });
      }

      // Missing fields array
      if (isMissing(entity.fields)) {
        entity.fields = [];
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${entityPath}.fields`,
          reason: 'Entity requires fields array',
          diffSummary: 'Initialized empty fields array',
          originalValue: undefined,
          repairedValue: [],
          confidence: 'high',
          location: entity.location,
        });
      }

      // Missing invariants array
      if (isMissing(entity.invariants)) {
        entity.invariants = [];
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${entityPath}.invariants`,
          reason: 'Entity requires invariants array',
          diffSummary: 'Initialized empty invariants array',
          originalValue: undefined,
          repairedValue: [],
          confidence: 'high',
          location: entity.location,
        });
      }

      // Repair entity fields
      for (let j = 0; j < (entity.fields?.length ?? 0); j++) {
        const field = entity.fields[j];
        if (!field) continue;

        const fieldPath = `${entityPath}.fields[${j}]`;

        // Missing field name
        if (isMissing(field.name) || isMissing(field.name?.name)) {
          const oldValue = field.name;
          field.name = createIdentifier(`field${j + 1}`, field.location);
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${fieldPath}.name`,
            reason: 'Field must have a name',
            diffSummary: `Added default field name: "field${j + 1}"`,
            originalValue: oldValue,
            repairedValue: field.name,
            confidence: 'medium',
            location: field.location,
          });
        }

        // Missing field type - default to String
        if (isMissing(field.type)) {
          field.type = {
            kind: 'PrimitiveType',
            name: 'String',
            location: field.location ?? DEFAULT_LOCATION,
          };
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${fieldPath}.type`,
            reason: 'Field must have a type',
            diffSummary: 'Added default type: String',
            originalValue: undefined,
            repairedValue: field.type,
            confidence: 'low',
            location: field.location,
          });
        }

        // Missing optional flag
        if (isMissing(field.optional)) {
          field.optional = false;
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${fieldPath}.optional`,
            reason: 'Field requires optional flag',
            diffSummary: 'Set optional to false (required)',
            originalValue: undefined,
            repairedValue: false,
            confidence: 'high',
            location: field.location,
          });
        }

        // Missing annotations array
        if (isMissing(field.annotations)) {
          field.annotations = [];
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${fieldPath}.annotations`,
            reason: 'Field requires annotations array',
            diffSummary: 'Initialized empty annotations array',
            originalValue: undefined,
            repairedValue: [],
            confidence: 'high',
            location: field.location,
          });
        }
      }
    }

    // Repair behaviors
    for (let i = 0; i < (ast.behaviors?.length ?? 0); i++) {
      const behavior = ast.behaviors[i];
      if (!behavior) continue;

      const behaviorPath = `domain.behaviors[${i}]`;

      // Missing behavior name
      if (isMissing(behavior.name) || isMissing(behavior.name?.name)) {
        const oldValue = behavior.name;
        behavior.name = createIdentifier(`Behavior${i + 1}`, behavior.location);
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${behaviorPath}.name`,
          reason: 'Behavior must have a name',
          diffSummary: `Added default behavior name: "Behavior${i + 1}"`,
          originalValue: oldValue,
          repairedValue: behavior.name,
          confidence: 'medium',
          location: behavior.location,
        });
      }

      // Missing input spec
      if (isMissing(behavior.input)) {
        behavior.input = {
          kind: 'InputSpec',
          fields: [],
          location: behavior.location ?? DEFAULT_LOCATION,
        };
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${behaviorPath}.input`,
          reason: 'Behavior must have an input specification',
          diffSummary: 'Added empty input specification',
          originalValue: undefined,
          repairedValue: behavior.input,
          confidence: 'high',
          location: behavior.location,
        });
      } else if (isMissing(behavior.input.fields)) {
        behavior.input.fields = [];
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${behaviorPath}.input.fields`,
          reason: 'Input specification requires fields array',
          diffSummary: 'Initialized empty input fields array',
          originalValue: undefined,
          repairedValue: [],
          confidence: 'high',
          location: behavior.input.location,
        });
      }

      // Missing output spec
      if (isMissing(behavior.output)) {
        behavior.output = {
          kind: 'OutputSpec',
          success: {
            kind: 'PrimitiveType',
            name: 'Boolean',
            location: behavior.location ?? DEFAULT_LOCATION,
          },
          errors: [],
          location: behavior.location ?? DEFAULT_LOCATION,
        };
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${behaviorPath}.output`,
          reason: 'Behavior must have an output specification',
          diffSummary: 'Added default output specification (success: Boolean)',
          originalValue: undefined,
          repairedValue: behavior.output,
          confidence: 'medium',
          location: behavior.location,
        });
      } else {
        if (isMissing(behavior.output.success)) {
          behavior.output.success = {
            kind: 'PrimitiveType',
            name: 'Boolean',
            location: behavior.output.location ?? DEFAULT_LOCATION,
          };
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${behaviorPath}.output.success`,
            reason: 'Output must specify success type',
            diffSummary: 'Added default success type: Boolean',
            originalValue: undefined,
            repairedValue: behavior.output.success,
            confidence: 'low',
            location: behavior.output.location,
          });
        }
        if (isMissing(behavior.output.errors)) {
          behavior.output.errors = [];
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${behaviorPath}.output.errors`,
            reason: 'Output must have errors array',
            diffSummary: 'Initialized empty errors array',
            originalValue: undefined,
            repairedValue: [],
            confidence: 'high',
            location: behavior.output.location,
          });
        }
      }

      // Missing required arrays on behavior
      const behaviorArrays = [
        'preconditions',
        'postconditions',
        'invariants',
        'temporal',
        'security',
        'compliance',
      ] as const;

      for (const arrayName of behaviorArrays) {
        if (isMissing(behavior[arrayName])) {
          (behavior as Record<string, unknown>)[arrayName] = [];
          repairs.push({
            id: ctx.generateId(),
            category: 'missing-field',
            path: `${behaviorPath}.${arrayName}`,
            reason: `Behavior requires ${arrayName} array`,
            diffSummary: `Initialized empty ${arrayName} array`,
            originalValue: undefined,
            repairedValue: [],
            confidence: 'high',
            location: behavior.location,
          });
        }
      }
    }

    // Repair type declarations
    for (let i = 0; i < (ast.types?.length ?? 0); i++) {
      const typeDecl = ast.types[i];
      if (!typeDecl) continue;

      const typePath = `domain.types[${i}]`;

      // Missing type name
      if (isMissing(typeDecl.name) || isMissing(typeDecl.name?.name)) {
        const oldValue = typeDecl.name;
        typeDecl.name = createIdentifier(`Type${i + 1}`, typeDecl.location);
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${typePath}.name`,
          reason: 'Type declaration must have a name',
          diffSummary: `Added default type name: "Type${i + 1}"`,
          originalValue: oldValue,
          repairedValue: typeDecl.name,
          confidence: 'medium',
          location: typeDecl.location,
        });
      }

      // Missing annotations array
      if (isMissing(typeDecl.annotations)) {
        typeDecl.annotations = [];
        repairs.push({
          id: ctx.generateId(),
          category: 'missing-field',
          path: `${typePath}.annotations`,
          reason: 'Type declaration requires annotations array',
          diffSummary: 'Initialized empty annotations array',
          originalValue: undefined,
          repairedValue: [],
          confidence: 'high',
          location: typeDecl.location,
        });
      }

      // Missing type definition is unrecoverable
      if (isMissing(typeDecl.definition)) {
        unrepaired.push({
          message: 'Type declaration has no definition',
          path: `${typePath}.definition`,
          reason: 'Cannot infer type definition without more context',
          location: typeDecl.location,
        });
      }
    }

    return { repairs, unrepaired };
  },
};

export default missingFieldsStrategy;
