/**
 * AST Adapters
 * 
 * Provides adapter functions to convert between different AST representations:
 * - Parser AST (Domain with location: SourceLocation)
 * - Legacy AST (DomainDeclaration with span: SourceSpan)
 * 
 * This enables packages using different AST versions to interoperate.
 */

import type { SourceSpan } from '../lexer/tokens.js';
import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  FieldDeclaration,
  EnumDeclaration,
  InvariantsBlock,
  ImportDeclaration,
  UseStatement,
  ConditionBlock,
  TemporalBlock,
  SecurityBlock,
  ComplianceBlock,
  ChaosBlock,
  UIBlueprintDeclaration,
  ActorsBlock,
  InputBlock,
  OutputBlock,
  Expression,
  TypeExpression,
  Identifier,
  BaseNode,
} from './types.js';

/**
 * SourceLocation as used in the parser package
 * (imported from lexer for consistency, but defining locally for adapters)
 */
interface AdapterSourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/**
 * Parser Domain type (canonical type)
 */
export interface ParserDomain {
  kind: 'Domain';
  name: { kind: 'Identifier'; name: string; location: AdapterSourceLocation };
  version: { kind: 'StringLiteral'; value: string; location: AdapterSourceLocation };
  owner?: { kind: 'StringLiteral'; value: string; location: AdapterSourceLocation };
  imports: Array<{
    kind: 'Import';
    items: Array<{ kind: 'ImportItem'; name: { name: string }; alias?: { name: string } }>;
    from: { value: string };
    location: AdapterSourceLocation;
  }>;
  types: ParserTypeDeclaration[];
  entities: ParserEntity[];
  behaviors: ParserBehavior[];
  invariants: ParserInvariantBlock[];
  policies: unknown[];
  views: unknown[];
  scenarios: unknown[];
  chaos: unknown[];
  location: AdapterSourceLocation;
}

export interface ParserEntity {
  kind: 'Entity';
  name: { kind: 'Identifier'; name: string; location: AdapterSourceLocation };
  fields: ParserField[];
  invariants: Expression[];
  lifecycle?: unknown;
  location: AdapterSourceLocation;
}

export interface ParserBehavior {
  kind: 'Behavior';
  name: { kind: 'Identifier'; name: string; location: AdapterSourceLocation };
  description?: { kind: 'StringLiteral'; value: string; location: AdapterSourceLocation };
  actors?: unknown[];
  input: { kind: 'InputSpec'; fields: ParserField[]; location: AdapterSourceLocation };
  output: { kind: 'OutputSpec'; success: unknown; errors: unknown[]; location: AdapterSourceLocation };
  preconditions: Expression[];
  postconditions: Array<{
    kind: 'PostconditionBlock';
    condition: unknown;
    predicates: Expression[];
    location: AdapterSourceLocation;
  }>;
  invariants: Expression[];
  temporal: unknown[];
  security: unknown[];
  compliance: unknown[];
  observability?: unknown;
  location: AdapterSourceLocation;
}

export interface ParserField {
  kind: 'Field';
  name: { kind: 'Identifier'; name: string; location: AdapterSourceLocation };
  type: unknown;
  optional: boolean;
  annotations: unknown[];
  defaultValue?: Expression;
  location: AdapterSourceLocation;
}

export interface ParserTypeDeclaration {
  kind: 'TypeDeclaration';
  name: { kind: 'Identifier'; name: string; location: AdapterSourceLocation };
  definition: unknown;
  annotations: unknown[];
  location: AdapterSourceLocation;
}

export interface ParserInvariantBlock {
  kind: 'InvariantBlock';
  name: { kind: 'Identifier'; name: string; location: AdapterSourceLocation };
  description?: { kind: 'StringLiteral'; value: string; location: AdapterSourceLocation };
  scope: 'global' | 'transaction';
  predicates: Expression[];
  location: AdapterSourceLocation;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert SourceLocation to SourceSpan
 */
export function locationToSpan(loc: AdapterSourceLocation): SourceSpan {
  return {
    file: loc.file,
    start: {
      line: loc.line,
      column: loc.column,
      offset: 0, // Offset not available from location
    },
    end: {
      line: loc.endLine,
      column: loc.endColumn,
      offset: 0,
    },
  };
}

/**
 * Convert SourceSpan to SourceLocation
 */
export function spanToLocation(span: SourceSpan | undefined, file: string = ''): AdapterSourceLocation {
  if (!span) {
    return { file, line: 1, column: 1, endLine: 1, endColumn: 1 };
  }
  return {
    file: span.file || file,
    line: span.start?.line || 1,
    column: span.start?.column || 1,
    endLine: span.end?.line || span.start?.line || 1,
    endColumn: span.end?.column || span.start?.column || 1,
  };
}

/**
 * Convert Parser Domain to DomainDeclaration (legacy format)
 * 
 * This allows packages expecting DomainDeclaration to work with
 * the parser's output.
 */
export function domainToDeclaration(domain: ParserDomain): DomainDeclaration {
  const span = locationToSpan(domain.location);
  
  return {
    kind: 'DomainDeclaration',
    name: {
      kind: 'Identifier',
      name: domain.name.name,
      span: locationToSpan(domain.name.location),
    },
    version: domain.version ? {
      kind: 'StringLiteral',
      value: domain.version.value,
      span: locationToSpan(domain.version.location),
    } : undefined,
    uses: [], // Parser doesn't have 'uses', only imports
    imports: domain.imports.map(imp => ({
      kind: 'ImportDeclaration' as const,
      names: imp.items.map(item => ({
        kind: 'Identifier' as const,
        name: item.name.name,
        span,
      })),
      from: {
        kind: 'StringLiteral' as const,
        value: imp.from.value,
        span: locationToSpan(imp.location),
      },
      span: locationToSpan(imp.location),
    })),
    entities: domain.entities.map(e => entityToDeclaration(e)),
    types: domain.types.map(t => typeToDeclaration(t)),
    enums: [], // Parser includes enums in types
    behaviors: domain.behaviors.map(b => behaviorToDeclaration(b)),
    invariants: domain.invariants.map(i => invariantBlockToInvariantsBlock(i)),
    uiBlueprints: undefined,
    span,
  };
}

/**
 * Convert Parser Entity to EntityDeclaration
 */
export function entityToDeclaration(entity: ParserEntity): EntityDeclaration {
  const span = locationToSpan(entity.location);
  
  return {
    kind: 'EntityDeclaration',
    name: {
      kind: 'Identifier',
      name: entity.name.name,
      span: locationToSpan(entity.name.location),
    },
    fields: entity.fields.map(f => fieldToDeclaration(f)),
    invariants: entity.invariants.map(inv => ({
      kind: 'InvariantStatement',
      expression: inv,
      span,
    })) as any[], // Type assertion needed due to structural differences
    lifecycle: undefined, // Map lifecycle if needed
    span,
  };
}

/**
 * Convert Parser Field to FieldDeclaration
 */
export function fieldToDeclaration(field: ParserField): FieldDeclaration {
  const span = locationToSpan(field.location);
  
  return {
    kind: 'FieldDeclaration',
    name: {
      kind: 'Identifier',
      name: field.name.name,
      span: locationToSpan(field.name.location),
    },
    type: field.type as TypeExpression, // Direct mapping, may need conversion
    optional: field.optional,
    annotations: [],
    constraints: [],
    defaultValue: field.defaultValue,
    span,
  };
}

/**
 * Convert Parser TypeDeclaration to TypeDeclaration (legacy)
 */
export function typeToDeclaration(type: ParserTypeDeclaration): TypeDeclaration {
  const span = locationToSpan(type.location);
  
  return {
    kind: 'TypeDeclaration',
    name: {
      kind: 'Identifier',
      name: type.name.name,
      span: locationToSpan(type.name.location),
    },
    baseType: type.definition as TypeExpression,
    constraints: [],
    span,
  };
}

/**
 * Convert Parser Behavior to BehaviorDeclaration
 */
export function behaviorToDeclaration(behavior: ParserBehavior): BehaviorDeclaration {
  const span = locationToSpan(behavior.location);
  
  return {
    kind: 'BehaviorDeclaration',
    name: {
      kind: 'Identifier',
      name: behavior.name.name,
      span: locationToSpan(behavior.name.location),
    },
    description: behavior.description ? {
      kind: 'StringLiteral',
      value: behavior.description.value,
      span: locationToSpan(behavior.description.location),
    } : undefined,
    actors: undefined, // Map if needed
    input: behavior.input ? {
      kind: 'InputBlock',
      fields: behavior.input.fields.map(f => fieldToDeclaration(f)),
      span: locationToSpan(behavior.input.location),
    } : undefined,
    output: undefined, // Complex mapping needed
    preconditions: behavior.preconditions.length > 0 ? {
      kind: 'ConditionBlock',
      conditions: behavior.preconditions.map(p => ({
        kind: 'Condition' as const,
        guard: undefined,
        implies: false,
        statements: [{
          kind: 'ConditionStatement' as const,
          expression: p,
          span,
        }],
        span,
      })),
      span,
    } : undefined,
    postconditions: behavior.postconditions.length > 0 ? {
      kind: 'ConditionBlock',
      conditions: behavior.postconditions.flatMap(pc => 
        pc.predicates.map(p => ({
          kind: 'Condition' as const,
          guard: undefined,
          implies: false,
          statements: [{
            kind: 'ConditionStatement' as const,
            expression: p,
            span,
          }],
          span,
        }))
      ),
      span,
    } : undefined,
    invariants: behavior.invariants.map(inv => ({
      kind: 'InvariantStatement',
      expression: inv,
      span,
    })) as any[],
    temporal: undefined,
    security: undefined,
    compliance: undefined,
    chaos: undefined,
    span,
  };
}

/**
 * Convert Parser InvariantBlock to InvariantsBlock
 */
export function invariantBlockToInvariantsBlock(block: ParserInvariantBlock): InvariantsBlock {
  const span = locationToSpan(block.location);
  
  return {
    kind: 'InvariantsBlock',
    name: {
      kind: 'Identifier',
      name: block.name.name,
      span: locationToSpan(block.name.location),
    },
    description: block.description ? {
      kind: 'StringLiteral',
      value: block.description.value,
      span: locationToSpan(block.description.location),
    } : undefined,
    scope: block.scope === 'transaction' ? 'entity' : 'global',
    invariants: block.predicates.map(p => ({
      kind: 'InvariantStatement',
      expression: p,
      span,
    })) as any[],
    span,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an AST is in Parser format (has location property)
 */
export function isParserAST(ast: unknown): ast is ParserDomain {
  return ast !== null && 
         typeof ast === 'object' && 
         'kind' in ast && 
         (ast as { kind: string }).kind === 'Domain' && 
         'location' in ast;
}

/**
 * Check if an AST is in legacy format (has span property)
 */
export function isLegacyAST(ast: unknown): ast is DomainDeclaration {
  return ast !== null && 
         typeof ast === 'object' && 
         'kind' in ast && 
         (ast as { kind: string }).kind === 'DomainDeclaration' && 
         'span' in ast;
}

/**
 * Normalize an AST to DomainDeclaration format
 * Accepts either Parser Domain or legacy DomainDeclaration
 */
export function normalizeToDeclaration(ast: ParserDomain | DomainDeclaration): DomainDeclaration {
  if (isParserAST(ast)) {
    return domainToDeclaration(ast);
  }
  return ast as DomainDeclaration;
}
