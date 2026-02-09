/**
 * Domain Adapter
 *
 * Converts @isl-lang/parser's Domain to isl-core's DomainDeclaration.
 * Canonical parse path: parse() from @isl-lang/parser then this adapter.
 *
 * @see ADR-001-ast-type-unification.md
 */

import type { Domain } from '@isl-lang/parser';
import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  FieldDeclaration,
  EnumDeclaration,
  TypeDeclaration,
  ImportDeclaration,
  UseStatement,
  Identifier,
  StringLiteral,
  Expression,
  TypeExpression,
  ConditionBlock,
  InputBlock,
  OutputBlock,
  ErrorDeclaration,
  InvariantsBlock,
  InvariantStatement,
  TemporalBlock,
  TemporalRequirement,
  SecurityBlock,
  SecurityRequirement,
  ComplianceBlock,
  ActorsBlock,
  ActorDeclaration,
  BaseNode,
} from '../ast/types.js';
import type { SourceSpan } from '../lexer/tokens.js';

// ============================================================================
// Parser-compatible types (for adapter internals and re-export)
// ============================================================================

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ParserASTNode {
  kind: string;
  location: SourceLocation;
}

/** @deprecated Use Domain from @isl-lang/parser */
export type ParserDomain = Domain;

export interface ParserIdentifier extends ParserASTNode {
  kind: 'Identifier';
  name: string;
}

export interface ParserStringLiteral extends ParserASTNode {
  kind: 'StringLiteral';
  value: string;
}

export interface ParserImport extends ParserASTNode {
  kind: 'Import';
  items: ParserImportItem[];
  from: ParserStringLiteral;
}

export interface ParserImportItem extends ParserASTNode {
  kind: 'ImportItem';
  name: ParserIdentifier;
  alias?: ParserIdentifier;
}

export interface ParserTypeDeclaration extends ParserASTNode {
  kind: 'TypeDeclaration';
  name: ParserIdentifier;
  definition: unknown;
  annotations: unknown[];
}

export interface ParserEntity extends ParserASTNode {
  kind: 'Entity';
  name: ParserIdentifier;
  fields: ParserField[];
  invariants: unknown[];
  lifecycle?: unknown;
}

export interface ParserField extends ParserASTNode {
  kind: 'Field';
  name: ParserIdentifier;
  type: unknown;
  optional: boolean;
  annotations: unknown[];
  defaultValue?: unknown;
}

export interface ParserBehavior extends ParserASTNode {
  kind: 'Behavior';
  name: ParserIdentifier;
  description?: ParserStringLiteral;
  actors?: ParserActorSpec[];
  input: ParserInputSpec;
  output: ParserOutputSpec;
  preconditions: unknown[];
  postconditions: ParserPostconditionBlock[];
  invariants: unknown[];
  temporal: ParserTemporalSpec[];
  security: ParserSecuritySpec[];
  compliance: ParserComplianceSpec[];
  observability?: unknown;
}

export interface ParserActorSpec extends ParserASTNode {
  kind: 'ActorSpec';
  name: ParserIdentifier;
  constraints: unknown[];
}

export interface ParserInputSpec extends ParserASTNode {
  kind: 'InputSpec';
  fields: ParserField[];
}

export interface ParserOutputSpec extends ParserASTNode {
  kind: 'OutputSpec';
  success: unknown;
  errors: ParserErrorSpec[];
}

export interface ParserErrorSpec extends ParserASTNode {
  kind: 'ErrorSpec';
  name: ParserIdentifier;
  when?: ParserStringLiteral;
  retriable: boolean;
  retryAfter?: unknown;
  returns?: unknown;
}

export interface ParserPostconditionBlock extends ParserASTNode {
  kind: 'PostconditionBlock';
  condition: ParserIdentifier | 'success' | 'any_error';
  predicates: unknown[];
}

export interface ParserTemporalSpec extends ParserASTNode {
  kind: 'TemporalSpec';
  operator: 'eventually' | 'always' | 'within' | 'never' | 'immediately' | 'response';
  predicate: unknown;
  duration?: unknown;
  percentile?: number;
}

export interface ParserSecuritySpec extends ParserASTNode {
  kind: 'SecuritySpec';
  type: 'requires' | 'rate_limit' | 'fraud_check';
  details: unknown;
}

export interface ParserComplianceSpec extends ParserASTNode {
  kind: 'ComplianceSpec';
  standard: ParserIdentifier;
  requirements: unknown[];
}

export interface ParserInvariantBlock extends ParserASTNode {
  kind: 'InvariantBlock';
  name: ParserIdentifier;
  description?: ParserStringLiteral;
  scope: 'global' | 'transaction';
  predicates: unknown[];
}

export interface ParserPolicy extends ParserASTNode {
  kind: 'Policy';
  name: ParserIdentifier;
  appliesTo: unknown;
  rules: unknown[];
}

export interface ParserView extends ParserASTNode {
  kind: 'View';
  name: ParserIdentifier;
  forEntity: unknown;
  fields: unknown[];
  consistency: unknown;
  cache?: unknown;
}

export interface ParserScenarioBlock extends ParserASTNode {
  kind: 'ScenarioBlock';
  behaviorName: ParserIdentifier;
  scenarios: unknown[];
}

export interface ParserChaosBlock extends ParserASTNode {
  kind: 'ChaosBlock';
  behaviorName: ParserIdentifier;
  scenarios: unknown[];
}

// ============================================================================
// Adapter Functions
// ============================================================================

/**
 * Convert SourceSpan (isl-core) to SourceLocation (parser)
 */
export function spanToLocation(span: SourceSpan): SourceLocation {
  return {
    file: span.file ?? '<unknown>',
    line: span.start.line,
    column: span.start.column,
    endLine: span.end.line,
    endColumn: span.end.column,
  };
}

/**
 * Convert SourceLocation (parser) to SourceSpan (isl-core)
 */
export function locationToSpan(location: SourceLocation): SourceSpan {
  return {
    file: location.file,
    start: { line: location.line, column: location.column, offset: 0 },
    end: { line: location.endLine, column: location.endColumn, offset: 0 },
  };
}

/**
 * Create a default SourceLocation for synthetic nodes
 */
export function defaultLocation(file = '<synthetic>'): SourceLocation {
  return {
    file,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

/**
 * Convert Identifier (isl-core) to ParserIdentifier
 */
export function adaptIdentifier(id: Identifier): ParserIdentifier {
  return {
    kind: 'Identifier',
    name: id.name,
    location: spanToLocation(id.span),
  };
}

/**
 * Convert StringLiteral (isl-core) to ParserStringLiteral
 */
export function adaptStringLiteral(str: StringLiteral): ParserStringLiteral {
  return {
    kind: 'StringLiteral',
    value: str.value,
    location: spanToLocation(str.span),
  };
}

/**
 * Convert UseStatement to ParserImport
 * 
 * Note: isl-core uses UseStatement for "use" directives,
 * parser uses Import for "import { x } from y" syntax.
 * This converts UseStatement to the Import format.
 */
export function adaptUseToImport(use: UseStatement): ParserImport {
  const moduleName = use.module.kind === 'Identifier' 
    ? use.module.name 
    : (use.module as StringLiteral).value;

  const items: ParserImportItem[] = [{
    kind: 'ImportItem',
    name: {
      kind: 'Identifier',
      name: moduleName,
      location: spanToLocation(use.module.span),
    },
    alias: use.alias ? adaptIdentifier(use.alias) : undefined,
    location: spanToLocation(use.span),
  }];

  return {
    kind: 'Import',
    items,
    from: {
      kind: 'StringLiteral',
      value: moduleName,
      location: spanToLocation(use.module.span),
    },
    location: spanToLocation(use.span),
  };
}

/**
 * Convert FieldDeclaration (isl-core) to ParserField
 */
export function adaptField(field: FieldDeclaration): ParserField {
  return {
    kind: 'Field',
    name: adaptIdentifier(field.name),
    type: field.type, // Type expressions are complex - pass through for now
    optional: field.optional,
    annotations: field.annotations,
    defaultValue: field.defaultValue,
    location: spanToLocation(field.span),
  };
}

/**
 * Convert EntityDeclaration (isl-core) to ParserEntity
 */
export function adaptEntity(entity: EntityDeclaration): ParserEntity {
  return {
    kind: 'Entity',
    name: adaptIdentifier(entity.name),
    fields: entity.fields.map(adaptField),
    invariants: entity.invariants ?? [],
    lifecycle: entity.lifecycle,
    location: spanToLocation(entity.span),
  };
}

/**
 * Convert BehaviorDeclaration (isl-core) to ParserBehavior
 */
export function adaptBehavior(behavior: BehaviorDeclaration): ParserBehavior {
  // Adapt actors
  const actors = behavior.actors?.actors.map((actor): ParserActorSpec => ({
    kind: 'ActorSpec',
    name: adaptIdentifier(actor.name),
    constraints: actor.constraints.map(c => c.value),
    location: spanToLocation(actor.span),
  }));

  // Adapt input
  const input: ParserInputSpec = {
    kind: 'InputSpec',
    fields: behavior.input?.fields.map(adaptField) ?? [],
    location: behavior.input ? spanToLocation(behavior.input.span) : defaultLocation(),
  };

  // Adapt output
  const output: ParserOutputSpec = {
    kind: 'OutputSpec',
    success: behavior.output?.success ?? { kind: 'SimpleType', name: { kind: 'Identifier', name: 'void', span: { file: '', start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } } }, span: { file: '', start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } } },
    errors: behavior.output?.errors.map((err): ParserErrorSpec => ({
      kind: 'ErrorSpec',
      name: adaptIdentifier(err.name),
      when: err.when ? adaptStringLiteral(err.when) : undefined,
      retriable: err.retriable ?? false,
      retryAfter: err.retryAfter,
      returns: err.returns,
      location: spanToLocation(err.span),
    })) ?? [],
    location: behavior.output ? spanToLocation(behavior.output.span) : defaultLocation(),
  };

  // Adapt preconditions and postconditions
  const preconditions = behavior.preconditions?.conditions.flatMap(c => c.statements.map(s => s.expression)) ?? [];
  const postconditions = behavior.postconditions?.conditions.map((c): ParserPostconditionBlock => ({
    kind: 'PostconditionBlock',
    condition: c.guard === 'success' ? 'success' : c.guard === 'failure' ? 'any_error' : (c.guard ?? 'success') as ParserIdentifier | 'success' | 'any_error',
    predicates: c.statements.map(s => s.expression),
    location: spanToLocation(c.span),
  })) ?? [];

  // Adapt temporal
  const temporal = behavior.temporal?.requirements.map((req): ParserTemporalSpec => ({
    kind: 'TemporalSpec',
    operator: req.type as 'eventually' | 'always' | 'within' | 'never',
    predicate: req.condition,
    duration: req.duration,
    percentile: req.percentile ? parseFloat(req.percentile) : undefined,
    location: spanToLocation(req.span),
  })) ?? [];

  // Adapt security
  const security = behavior.security?.requirements.map((req): ParserSecuritySpec => ({
    kind: 'SecuritySpec',
    type: req.type as 'requires' | 'rate_limit' | 'fraud_check',
    details: req.expression,
    location: spanToLocation(req.span),
  })) ?? [];

  // Adapt compliance
  const compliance = behavior.compliance?.standards.map((std): ParserComplianceSpec => ({
    kind: 'ComplianceSpec',
    standard: adaptIdentifier(std.name),
    requirements: std.requirements.map(r => r.expression),
    location: spanToLocation(std.span),
  })) ?? [];

  return {
    kind: 'Behavior',
    name: adaptIdentifier(behavior.name),
    description: behavior.description ? adaptStringLiteral(behavior.description) : undefined,
    actors,
    input,
    output,
    preconditions,
    postconditions,
    invariants: behavior.invariants ?? [],
    temporal,
    security,
    compliance,
    observability: undefined, // Not in isl-core AST
    location: spanToLocation(behavior.span),
  };
}

/**
 * Convert InvariantsBlock (isl-core) to ParserInvariantBlock
 */
export function adaptInvariantsBlock(block: InvariantsBlock): ParserInvariantBlock {
  // Map isl-core scope to parser scope
  // isl-core: 'global' | 'entity' | 'behavior'
  // parser: 'global' | 'transaction'
  const mappedScope: 'global' | 'transaction' = 
    block.scope === 'global' ? 'global' : 'transaction';
  
  return {
    kind: 'InvariantBlock',
    name: adaptIdentifier(block.name),
    description: block.description ? adaptStringLiteral(block.description) : undefined,
    scope: mappedScope,
    predicates: block.invariants.map(inv => inv.expression),
    location: spanToLocation(block.span),
  };
}

/**
 * Convert DomainDeclaration (isl-core) to ParserDomain
 * 
 * This is the main adapter function that converts the entire domain.
 */
export function domainDeclarationToDomain(decl: DomainDeclaration): ParserDomain {
  // Version handling - isl-core may have optional version
  const version: ParserStringLiteral = decl.version 
    ? adaptStringLiteral(decl.version)
    : {
        kind: 'StringLiteral',
        value: '0.0.0',
        location: defaultLocation(),
      };

  // Convert uses to imports
  const imports = decl.uses.map(adaptUseToImport);

  // Add explicit imports if any
  imports.push(...decl.imports.map((imp): ParserImport => ({
    kind: 'Import',
    items: imp.names.map((name): ParserImportItem => ({
      kind: 'ImportItem',
      name: adaptIdentifier(name),
      location: spanToLocation(name.span),
    })),
    from: adaptStringLiteral(imp.from),
    location: spanToLocation(imp.span),
  })));

  // Convert type declarations (enums become TypeDeclaration with EnumType)
  const types: ParserTypeDeclaration[] = [
    ...decl.types.map((t): ParserTypeDeclaration => ({
      kind: 'TypeDeclaration',
      name: adaptIdentifier(t.name),
      definition: t.baseType,
      annotations: [],
      location: spanToLocation(t.span),
    })),
    ...decl.enums.map((e): ParserTypeDeclaration => ({
      kind: 'TypeDeclaration',
      name: adaptIdentifier(e.name),
      definition: {
        kind: 'EnumType',
        variants: e.variants.map(v => ({
          kind: 'EnumVariant',
          name: adaptIdentifier(v),
          location: spanToLocation(v.span),
        })),
        location: spanToLocation(e.span),
      },
      annotations: [],
      location: spanToLocation(e.span),
    })),
  ];

  return {
    kind: 'Domain',
    name: adaptIdentifier(decl.name),
    version,
    owner: undefined, // Not in isl-core AST
    imports,
    types,
    entities: decl.entities.map(adaptEntity),
    behaviors: decl.behaviors.map(adaptBehavior),
    invariants: decl.invariants.map(adaptInvariantsBlock),
    policies: [], // Not in isl-core AST
    views: [], // Not in isl-core AST
    scenarios: [], // Not in isl-core AST
    chaos: [], // Not in isl-core AST
    location: spanToLocation(decl.span),
  } as Domain;
}

/**
 * Validate that a DomainDeclaration has the minimum required fields
 * for conversion to Domain.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateForConversion(decl: DomainDeclaration): ValidationResult {
  const errors: string[] = [];

  if (!decl.name || !decl.name.name) {
    errors.push('Domain name is required');
  }

  if (!decl.span) {
    errors.push('Source span is required');
  }

  // Check entities have required fields
  decl.entities.forEach((entity, i) => {
    if (!entity.name || !entity.name.name) {
      errors.push(`Entity at index ${i} is missing name`);
    }
  });

  // Check behaviors have required fields
  decl.behaviors.forEach((behavior, i) => {
    if (!behavior.name || !behavior.name.name) {
      errors.push(`Behavior at index ${i} is missing name`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Reverse Adapter (Parser → isl-core)
// ============================================================================

/**
 * Convert parser's Domain to isl-core DomainDeclaration.
 * Canonical parse path: @isl-lang/parser parse() then this adapter.
 */
export function domainToDomainDeclaration(domain: Domain): DomainDeclaration {
  const span = locationToSpan(domain.location);

  // Parser use statements (canonical)
  const usesFromParser = (domain.uses ?? []).map((u): UseStatement => ({
    kind: 'UseStatement',
    module: u.module.kind === 'Identifier'
      ? { kind: 'Identifier', name: u.module.name, span: locationToSpan(u.module.location) }
      : { kind: 'StringLiteral', value: u.module.value, span: locationToSpan(u.module.location) },
    alias: u.alias ? { kind: 'Identifier', name: u.alias.name, span: locationToSpan(u.alias.location) } : undefined,
    version: u.version ? { kind: 'StringLiteral', value: u.version.value, span: locationToSpan(u.version.location) } : undefined,
    span: locationToSpan(u.location),
  }));

  // uses = only explicit "use" statements; imports block is separate (imports array)
  const uses = usesFromParser;

  const imports = domain.imports.map((imp): ImportDeclaration => ({
    kind: 'ImportDeclaration',
    names: imp.items.map((i) => ({
      kind: 'Identifier',
      name: i.name.name,
      span: locationToSpan(i.name.location),
    })),
    from: {
      kind: 'StringLiteral',
      value: imp.from.value,
      span: locationToSpan(imp.from.location),
    },
    span: locationToSpan(imp.location),
  }));

  // Create DomainDeclaration
  return {
    kind: 'DomainDeclaration',
    name: {
      kind: 'Identifier',
      name: domain.name.name,
      span: locationToSpan(domain.name.location),
    },
    version: {
      kind: 'StringLiteral',
      value: domain.version.value,
      span: locationToSpan(domain.version.location),
    },
    uses,
    imports,
    entities: domain.entities.map((entity): EntityDeclaration => ({
      kind: 'EntityDeclaration',
      name: {
        kind: 'Identifier',
        name: entity.name.name,
        span: locationToSpan(entity.name.location),
      },
      fields: entity.fields.map((field): FieldDeclaration => ({
        kind: 'FieldDeclaration',
        name: {
          kind: 'Identifier',
          name: field.name.name,
          span: locationToSpan(field.name.location),
        },
        type: field.type as unknown as TypeExpression,
        optional: field.optional,
        annotations: [],
        constraints: [],
        span: locationToSpan(field.location),
      })),
      invariants: entity.invariants as unknown as InvariantStatement[],
      span: locationToSpan(entity.location),
    })),
    types: domain.types.filter(t => (t.definition as { kind?: string }).kind !== 'EnumType').map((t): TypeDeclaration => ({
      kind: 'TypeDeclaration',
      name: {
        kind: 'Identifier',
        name: t.name.name,
        span: locationToSpan(t.name.location),
      },
      baseType: t.definition as unknown as TypeExpression,
      constraints: [],
      span: locationToSpan(t.location),
    })),
    enums: domain.types.filter(t => (t.definition as { kind?: string }).kind === 'EnumType').map((t): EnumDeclaration => ({
      kind: 'EnumDeclaration',
      name: {
        kind: 'Identifier',
        name: t.name.name,
        span: locationToSpan(t.name.location),
      },
      variants: ((t.definition as { variants?: Array<{ name: ParserIdentifier }> }).variants ?? []).map(v => ({
        kind: 'Identifier' as const,
        name: v.name.name,
        span: locationToSpan(v.name.location),
      })),
      span: locationToSpan(t.location),
    })),
    behaviors: domain.behaviors.map((b): BehaviorDeclaration => ({
      kind: 'BehaviorDeclaration',
      name: {
        kind: 'Identifier',
        name: b.name.name,
        span: locationToSpan(b.name.location),
      },
      description: b.description ? {
        kind: 'StringLiteral',
        value: b.description.value,
        span: locationToSpan(b.description.location),
      } : undefined,
      actors: b.actors ? {
        kind: 'ActorsBlock',
        actors: b.actors.map((a): ActorDeclaration => ({
          kind: 'ActorDeclaration',
          name: {
            kind: 'Identifier',
            name: a.name.name,
            span: locationToSpan(a.name.location),
          },
          constraints: [],
          span: locationToSpan(a.location),
        })),
        span,
      } : undefined,
      input: {
        kind: 'InputBlock',
        fields: b.input.fields.map((f): FieldDeclaration => ({
          kind: 'FieldDeclaration',
          name: {
            kind: 'Identifier',
            name: f.name.name,
            span: locationToSpan(f.name.location),
          },
          type: f.type as unknown as TypeExpression,
          optional: f.optional,
          annotations: [],
          constraints: [],
          span: locationToSpan(f.location),
        })),
        span: locationToSpan(b.input.location),
      },
      output: {
        kind: 'OutputBlock',
        success: b.output.success as unknown as TypeExpression,
        errors: b.output.errors.map((e): ErrorDeclaration => ({
          kind: 'ErrorDeclaration',
          name: {
            kind: 'Identifier',
            name: e.name.name,
            span: locationToSpan(e.name.location),
          },
          when: e.when ? {
            kind: 'StringLiteral',
            value: e.when.value,
            span: locationToSpan(e.when.location),
          } : undefined,
          retriable: e.retriable,
          span: locationToSpan(e.location),
        })),
        span: locationToSpan(b.output.location),
      },
      preconditions: b.preconditions.length > 0 ? {
        kind: 'ConditionBlock',
        conditions: [{
          kind: 'Condition',
          implies: false,
          statements: b.preconditions.map(p => ({
            kind: 'ConditionStatement' as const,
            expression: p as unknown as Expression,
            span,
          })),
          span,
        }],
        span,
      } : undefined,
      postconditions: b.postconditions.length > 0 ? {
        kind: 'ConditionBlock',
        conditions: b.postconditions.map(pc => ({
          kind: 'Condition' as const,
          guard: pc.condition === 'success' ? 'success' as const : pc.condition === 'any_error' ? 'failure' as const : undefined,
          implies: false,
          statements: pc.predicates.map(p => ({
            kind: 'ConditionStatement' as const,
            expression: p as unknown as Expression,
            span,
          })),
          span: locationToSpan(pc.location),
        })),
        span,
      } : undefined,
      span: locationToSpan(b.location),
    })),
    invariants: domain.invariants.map((inv): InvariantsBlock => {
      // Map parser scope to isl-core scope
      // parser: 'global' | 'transaction' -> isl-core: 'global' | 'entity' | 'behavior'
      const mappedScope: 'global' | 'entity' | 'behavior' = 
        inv.scope === 'transaction' ? 'entity' : 'global';
      
      return {
        kind: 'InvariantsBlock',
        name: {
          kind: 'Identifier',
          name: inv.name.name,
          span: locationToSpan(inv.name.location),
        },
        description: inv.description ? {
          kind: 'StringLiteral',
          value: inv.description.value,
          span: locationToSpan(inv.description.location),
        } : undefined,
        scope: mappedScope,
        invariants: inv.predicates.map(p => ({
          kind: 'InvariantStatement' as const,
          expression: p as unknown as Expression,
          span,
        })),
        span: locationToSpan(inv.location),
      };
    }),
    span,
  };
}
