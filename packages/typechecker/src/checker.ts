// ============================================================================
// Main Type Checker
// ============================================================================

import type {
  ResolvedType,
  SourceLocation,
  Symbol,
  SymbolModifier,
  EntityResolvedType,
  BehaviorResolvedType,
} from './types';
import { BOOLEAN_TYPE, UNKNOWN_TYPE, typeToString } from './types';
import { SymbolTableBuilder, type Scope, type SymbolTable } from './symbols';
import { TypeResolver } from './resolver';
import { ExpressionChecker, type ExpressionContext } from './expressions';
import type { Diagnostic } from './errors';
import {
  duplicateTypeError,
  duplicateEntityError,
  duplicateBehaviorError,
  duplicateFieldError,
  undefinedTypeError,
  undefinedBehaviorError,
  invalidLifecycleStateError,
  typeMismatchError,
} from './errors';

// ============================================================================
// AST Type Interfaces (minimal interface declarations)
// ============================================================================

interface ASTNode {
  kind: string;
  location: SourceLocation;
}

interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

interface StringLiteral extends ASTNode {
  kind: 'StringLiteral';
  value: string;
}

interface Domain extends ASTNode {
  kind: 'Domain';
  name: Identifier;
  version: StringLiteral;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
  invariants: InvariantBlock[];
  policies: Policy[];
  views: View[];
  scenarios: ScenarioBlock[];
}

interface TypeDeclaration extends ASTNode {
  kind: 'TypeDeclaration';
  name: Identifier;
  definition: TypeDefinition;
  annotations: Annotation[];
}

interface TypeDefinition extends ASTNode {
  kind: string;
}

interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: Identifier;
  value?: Expression;
}

interface Entity extends ASTNode {
  kind: 'Entity';
  name: Identifier;
  fields: Field[];
  invariants: Expression[];
  lifecycle?: LifecycleSpec;
}

interface Field extends ASTNode {
  kind: 'Field';
  name: Identifier;
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
}

interface LifecycleSpec extends ASTNode {
  kind: 'LifecycleSpec';
  transitions: LifecycleTransition[];
}

interface LifecycleTransition extends ASTNode {
  kind: 'LifecycleTransition';
  from: Identifier;
  to: Identifier;
}

interface Behavior extends ASTNode {
  kind: 'Behavior';
  name: Identifier;
  description?: StringLiteral;
  input: InputSpec;
  output: OutputSpec;
  preconditions: Expression[];
  postconditions: PostconditionBlock[];
  invariants: Expression[];
  temporal: TemporalSpec[];
}

interface InputSpec extends ASTNode {
  kind: 'InputSpec';
  fields: Field[];
}

interface OutputSpec extends ASTNode {
  kind: 'OutputSpec';
  success: TypeDefinition;
  errors: ErrorSpec[];
}

interface ErrorSpec extends ASTNode {
  kind: 'ErrorSpec';
  name: Identifier;
  when?: StringLiteral;
  retriable: boolean;
}

interface PostconditionBlock extends ASTNode {
  kind: 'PostconditionBlock';
  condition: Identifier | 'success' | 'any_error';
  predicates: Expression[];
}

interface TemporalSpec extends ASTNode {
  kind: 'TemporalSpec';
  operator: string;
  predicate: Expression;
}

interface InvariantBlock extends ASTNode {
  kind: 'InvariantBlock';
  name: Identifier;
  description?: StringLiteral;
  scope: string;
  predicates: Expression[];
}

interface Policy extends ASTNode {
  kind: 'Policy';
  name: Identifier;
  appliesTo: PolicyTarget;
  rules: PolicyRule[];
}

interface PolicyTarget extends ASTNode {
  kind: 'PolicyTarget';
  target: 'all' | Identifier[];
}

interface PolicyRule extends ASTNode {
  kind: 'PolicyRule';
  condition?: Expression;
  action: Expression;
}

interface View extends ASTNode {
  kind: 'View';
  name: Identifier;
  forEntity: ReferenceType;
  fields: ViewField[];
}

interface ReferenceType extends ASTNode {
  kind: 'ReferenceType';
  name: QualifiedName;
}

interface QualifiedName extends ASTNode {
  kind: 'QualifiedName';
  parts: Identifier[];
}

interface ViewField extends ASTNode {
  kind: 'ViewField';
  name: Identifier;
  type: TypeDefinition;
  computation: Expression;
}

interface ScenarioBlock extends ASTNode {
  kind: 'ScenarioBlock';
  behaviorName: Identifier;
  scenarios: Scenario[];
}

interface Scenario extends ASTNode {
  kind: 'Scenario';
  name: StringLiteral;
  given: Statement[];
  when: Statement[];
  then: Expression[];
}

interface Statement extends ASTNode {
  kind: string;
}

type Expression = ASTNode;

// ============================================================================
// Type Check Result
// ============================================================================

export interface TypeCheckResult {
  success: boolean;
  diagnostics: Diagnostic[];
  symbolTable: SymbolTable;
  typeMap: Map<ASTNode, ResolvedType>;
}

// ============================================================================
// Type Checker Class
// ============================================================================

export class TypeChecker {
  private symbolTable: SymbolTableBuilder;
  private resolver: TypeResolver;
  private exprChecker: ExpressionChecker;
  private diagnostics: Diagnostic[] = [];
  private typeMap: Map<ASTNode, ResolvedType> = new Map();

  constructor() {
    this.symbolTable = new SymbolTableBuilder();
    this.resolver = new TypeResolver(this.symbolTable);
    this.exprChecker = new ExpressionChecker(this.symbolTable);
  }

  /**
   * Check a domain AST
   */
  check(domain: Domain): TypeCheckResult {
    this.diagnostics = [];
    this.typeMap = new Map();

    // Phase 1: Collect all type/entity/behavior declarations
    this.collectDeclarations(domain);

    // Phase 2: Resolve types and check for errors
    this.resolveTypes(domain);

    // Phase 3: Check entity invariants and lifecycle
    this.checkEntities(domain);

    // Phase 4: Check behaviors
    this.checkBehaviors(domain);

    // Phase 5: Check global invariants
    this.checkInvariants(domain);

    // Phase 6: Check policies
    this.checkPolicies(domain);

    // Phase 7: Check views
    this.checkViews(domain);

    // Phase 8: Check scenarios
    this.checkScenarios(domain);

    // Collect all diagnostics
    const allDiagnostics = [
      ...this.diagnostics,
      ...this.resolver.getDiagnostics(),
      ...this.exprChecker.getDiagnostics(),
    ];

    // Merge type maps
    const exprTypeMap = this.exprChecker.getTypeMap();
    for (const [node, type] of exprTypeMap) {
      this.typeMap.set(node, type);
    }

    return {
      success: allDiagnostics.filter(d => d.severity === 'error').length === 0,
      diagnostics: allDiagnostics,
      symbolTable: this.symbolTable,
      typeMap: this.typeMap,
    };
  }

  // ============================================================================
  // Phase 1: Collect Declarations
  // ============================================================================

  private collectDeclarations(domain: Domain): void {
    // Collect type declarations
    for (const typeDecl of domain.types) {
      this.collectTypeDeclaration(typeDecl);
    }

    // Collect entity declarations
    for (const entity of domain.entities) {
      this.collectEntityDeclaration(entity);
    }

    // Collect behavior declarations
    for (const behavior of domain.behaviors) {
      this.collectBehaviorDeclaration(behavior);
    }

    // Collect invariant declarations
    for (const invariant of domain.invariants) {
      this.collectInvariantDeclaration(invariant);
    }

    // Collect policy declarations
    for (const policy of domain.policies) {
      this.collectPolicyDeclaration(policy);
    }

    // Collect view declarations
    for (const view of domain.views) {
      this.collectViewDeclaration(view);
    }
  }

  private collectTypeDeclaration(typeDecl: TypeDeclaration): void {
    const name = typeDecl.name.name;
    const existing = this.symbolTable.getExistingInScope(name);

    if (existing) {
      this.diagnostics.push(duplicateTypeError(name, typeDecl.location, existing.location));
      return;
    }

    // Initially define with unknown type, will be resolved later
    const modifiers = this.extractModifiers(typeDecl.annotations);
    this.symbolTable.define(name, 'type', UNKNOWN_TYPE, typeDecl.location, modifiers);
  }

  private collectEntityDeclaration(entity: Entity): void {
    const name = entity.name.name;
    const existing = this.symbolTable.getExistingInScope(name);

    if (existing) {
      this.diagnostics.push(duplicateEntityError(name, entity.location, existing.location));
      return;
    }

    // Extract lifecycle states
    const lifecycleStates = this.extractLifecycleStates(entity.lifecycle);

    // Create entity type (fields will be resolved later)
    const entityType: EntityResolvedType = {
      kind: 'entity',
      name,
      fields: new Map(),
      lifecycleStates,
    };

    this.symbolTable.define(name, 'entity', entityType, entity.location);
  }

  private collectBehaviorDeclaration(behavior: Behavior): void {
    const name = behavior.name.name;
    const existing = this.symbolTable.getExistingInScope(name);

    if (existing) {
      this.diagnostics.push(duplicateBehaviorError(name, behavior.location, existing.location));
      return;
    }

    // Create behavior type (will be resolved later)
    const behaviorType: BehaviorResolvedType = {
      kind: 'behavior',
      name,
      inputFields: new Map(),
      outputType: UNKNOWN_TYPE,
      errorTypes: [],
    };

    const doc = behavior.description?.value;
    this.symbolTable.define(name, 'behavior', behaviorType, behavior.location, [], doc);
  }

  private collectInvariantDeclaration(invariant: InvariantBlock): void {
    const name = invariant.name.name;
    const doc = invariant.description?.value;
    this.symbolTable.define(name, 'invariant', BOOLEAN_TYPE, invariant.location, [], doc);
  }

  private collectPolicyDeclaration(policy: Policy): void {
    const name = policy.name.name;
    this.symbolTable.define(name, 'policy', UNKNOWN_TYPE, policy.location);
  }

  private collectViewDeclaration(view: View): void {
    const name = view.name.name;
    this.symbolTable.define(name, 'view', UNKNOWN_TYPE, view.location);
  }

  // ============================================================================
  // Phase 2: Resolve Types
  // ============================================================================

  private resolveTypes(domain: Domain): void {
    // Resolve type declarations
    for (const typeDecl of domain.types) {
      this.resolveTypeDeclaration(typeDecl);
    }

    // Resolve entity fields
    for (const entity of domain.entities) {
      this.resolveEntityFields(entity);
    }

    // Resolve behavior types
    for (const behavior of domain.behaviors) {
      this.resolveBehaviorTypes(behavior);
    }
  }

  private resolveTypeDeclaration(typeDecl: TypeDeclaration): void {
    const name = typeDecl.name.name;
    const symbol = this.symbolTable.lookup(name);

    if (!symbol) return;

    // Resolve the type definition
    const resolvedType = this.resolver.resolve(typeDecl.definition);

    // Update the symbol with the resolved type
    symbol.type = resolvedType;

    // Store in type map
    this.typeMap.set(typeDecl, resolvedType);
  }

  private resolveEntityFields(entity: Entity): void {
    const name = entity.name.name;
    const symbol = this.symbolTable.lookup(name);

    if (!symbol || symbol.type.kind !== 'entity') return;

    const entityType = symbol.type as EntityResolvedType;

    // Enter entity scope
    this.symbolTable.enterScope(name, entity.location);

    // Check for duplicate fields and resolve types
    const fieldLocations = new Map<string, SourceLocation>();

    for (const field of entity.fields) {
      const fieldName = field.name.name;

      // Check for duplicate
      const existingLoc = fieldLocations.get(fieldName);
      if (existingLoc) {
        this.diagnostics.push(duplicateFieldError(fieldName, name, field.location, existingLoc));
        continue;
      }
      fieldLocations.set(fieldName, field.location);

      // Resolve field type
      let fieldType = this.resolver.resolve(field.type);
      if (field.optional) {
        fieldType = { kind: 'optional', inner: fieldType };
      }

      // Add to entity type
      entityType.fields.set(fieldName, fieldType);

      // Define field symbol
      const modifiers = this.extractModifiers(field.annotations);
      this.symbolTable.define(fieldName, 'field', fieldType, field.location, modifiers);
    }

    this.symbolTable.exitScope();
  }

  private resolveBehaviorTypes(behavior: Behavior): void {
    const name = behavior.name.name;
    const symbol = this.symbolTable.lookup(name);

    if (!symbol || symbol.type.kind !== 'behavior') return;

    const behaviorType = symbol.type as BehaviorResolvedType;

    // Enter behavior scope
    this.symbolTable.enterScope(name, behavior.location);

    // Resolve input fields
    const inputFieldLocations = new Map<string, SourceLocation>();

    for (const field of behavior.input.fields) {
      const fieldName = field.name.name;

      // Check for duplicate
      const existingLoc = inputFieldLocations.get(fieldName);
      if (existingLoc) {
        this.diagnostics.push(duplicateFieldError(fieldName, `${name}.input`, field.location, existingLoc));
        continue;
      }
      inputFieldLocations.set(fieldName, field.location);

      // Resolve field type
      let fieldType = this.resolver.resolve(field.type);
      if (field.optional) {
        fieldType = { kind: 'optional', inner: fieldType };
      }

      behaviorType.inputFields.set(fieldName, fieldType);

      // Define as parameter in scope
      const modifiers = this.extractModifiers(field.annotations);
      this.symbolTable.define(fieldName, 'parameter', fieldType, field.location, modifiers);
    }

    // Resolve output type
    behaviorType.outputType = this.resolver.resolve(behavior.output.success);

    // Collect error types
    behaviorType.errorTypes = behavior.output.errors.map(e => e.name.name);

    // Define error types
    for (const errorSpec of behavior.output.errors) {
      this.symbolTable.define(errorSpec.name.name, 'error', UNKNOWN_TYPE, errorSpec.location);
    }

    this.symbolTable.exitScope();
  }

  // ============================================================================
  // Phase 3: Check Entities
  // ============================================================================

  private checkEntities(domain: Domain): void {
    for (const entity of domain.entities) {
      this.checkEntity(entity);
    }
  }

  private checkEntity(entity: Entity): void {
    const name = entity.name.name;
    const symbol = this.symbolTable.lookup(name);

    if (!symbol || symbol.type.kind !== 'entity') return;

    const entityType = symbol.type as EntityResolvedType;

    // Enter entity scope for invariant checking
    this.symbolTable.enterScope(name, entity.location);

    // Define 'this' or allow direct field access
    for (const [fieldName, fieldType] of entityType.fields) {
      this.symbolTable.define(fieldName, 'field', fieldType, entity.location);
    }

    // Check entity invariants
    const ctx: ExpressionContext = {
      inPostcondition: false,
      locals: new Map(),
    };

    for (const invariant of entity.invariants) {
      const type = this.exprChecker.infer(invariant, ctx);
      if (type.kind !== 'primitive' || type.name !== 'Boolean') {
        this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), invariant.location));
      }
    }

    // Check lifecycle transitions
    if (entity.lifecycle) {
      this.checkLifecycle(entity, entityType);
    }

    this.symbolTable.exitScope();
  }

  private checkLifecycle(entity: Entity, entityType: EntityResolvedType): void {
    if (!entity.lifecycle || !entityType.lifecycleStates) return;

    const validStates = new Set(entityType.lifecycleStates);

    for (const transition of entity.lifecycle.transitions) {
      const fromState = transition.from.name;
      const toState = transition.to.name;

      if (!validStates.has(fromState)) {
        this.diagnostics.push(invalidLifecycleStateError(
          fromState,
          entity.name.name,
          entityType.lifecycleStates,
          transition.from.location
        ));
      }

      if (!validStates.has(toState)) {
        this.diagnostics.push(invalidLifecycleStateError(
          toState,
          entity.name.name,
          entityType.lifecycleStates,
          transition.to.location
        ));
      }
    }
  }

  // ============================================================================
  // Phase 4: Check Behaviors
  // ============================================================================

  private checkBehaviors(domain: Domain): void {
    for (const behavior of domain.behaviors) {
      this.checkBehavior(behavior);
    }
  }

  private checkBehavior(behavior: Behavior): void {
    const name = behavior.name.name;
    const symbol = this.symbolTable.lookup(name);

    if (!symbol || symbol.type.kind !== 'behavior') return;

    const behaviorType = symbol.type as BehaviorResolvedType;

    // Enter behavior scope
    this.symbolTable.enterScope(name, behavior.location);

    // Define input fields
    for (const [fieldName, fieldType] of behaviorType.inputFields) {
      this.symbolTable.define(fieldName, 'parameter', fieldType, behavior.location);
    }

    // Check preconditions
    const preCtx: ExpressionContext = {
      inPostcondition: false,
      currentBehavior: behaviorType,
      locals: new Map(),
    };

    for (const precond of behavior.preconditions) {
      const type = this.exprChecker.infer(precond, preCtx);
      if (type.kind !== 'primitive' || type.name !== 'Boolean') {
        this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), precond.location));
      }
    }

    // Check postconditions
    const postCtx: ExpressionContext = {
      inPostcondition: true,
      currentBehavior: behaviorType,
      outputType: behaviorType.outputType,
      locals: new Map(),
    };

    for (const postBlock of behavior.postconditions) {
      for (const predicate of postBlock.predicates) {
        const type = this.exprChecker.infer(predicate, postCtx);
        if (type.kind !== 'primitive' || type.name !== 'Boolean') {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), predicate.location));
        }
      }
    }

    // Check behavior invariants
    for (const invariant of behavior.invariants) {
      const type = this.exprChecker.infer(invariant, preCtx);
      if (type.kind !== 'primitive' || type.name !== 'Boolean') {
        this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), invariant.location));
      }
    }

    // Check temporal specs
    for (const temporal of behavior.temporal) {
      const type = this.exprChecker.infer(temporal.predicate, preCtx);
      if (type.kind !== 'primitive' || type.name !== 'Boolean') {
        this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), temporal.predicate.location));
      }
    }

    this.symbolTable.exitScope();
  }

  // ============================================================================
  // Phase 5: Check Global Invariants
  // ============================================================================

  private checkInvariants(domain: Domain): void {
    const ctx: ExpressionContext = {
      inPostcondition: false,
      locals: new Map(),
    };

    for (const invariant of domain.invariants) {
      for (const predicate of invariant.predicates) {
        const type = this.exprChecker.infer(predicate, ctx);
        if (type.kind !== 'primitive' || type.name !== 'Boolean') {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), predicate.location));
        }
      }
    }
  }

  // ============================================================================
  // Phase 6: Check Policies
  // ============================================================================

  private checkPolicies(domain: Domain): void {
    for (const policy of domain.policies) {
      this.checkPolicy(policy);
    }
  }

  private checkPolicy(policy: Policy): void {
    const ctx: ExpressionContext = {
      inPostcondition: false,
      locals: new Map(),
    };

    // Validate policy targets
    if (policy.appliesTo.target !== 'all' && Array.isArray(policy.appliesTo.target)) {
      for (const target of policy.appliesTo.target) {
        const symbol = this.symbolTable.lookup(target.name);
        if (!symbol || symbol.kind !== 'behavior') {
          this.diagnostics.push(undefinedBehaviorError(target.name, target.location));
        }
      }
    }

    // Check policy rules
    for (const rule of policy.rules) {
      if (rule.condition) {
        const condType = this.exprChecker.infer(rule.condition, ctx);
        if (condType.kind !== 'primitive' || condType.name !== 'Boolean') {
          this.diagnostics.push(typeMismatchError('Boolean', typeToString(condType), rule.condition.location));
        }
      }

      // Action expressions are checked
      this.exprChecker.infer(rule.action, ctx);
    }
  }

  // ============================================================================
  // Phase 7: Check Views
  // ============================================================================

  private checkViews(domain: Domain): void {
    for (const view of domain.views) {
      this.checkView(view);
    }
  }

  private checkView(view: View): void {
    // Resolve the entity reference
    const entityName = view.forEntity.name.parts.map(p => p.name).join('.');
    const entitySymbol = this.symbolTable.lookup(entityName);

    if (!entitySymbol || entitySymbol.type.kind !== 'entity') {
      this.diagnostics.push(undefinedTypeError(entityName, view.forEntity.location));
      return;
    }

    const entityType = entitySymbol.type as EntityResolvedType;

    // Enter view scope
    this.symbolTable.enterScope(view.name.name, view.location);

    // Make entity fields available
    for (const [fieldName, fieldType] of entityType.fields) {
      this.symbolTable.define(fieldName, 'field', fieldType, view.location);
    }

    // Check view field computations
    const ctx: ExpressionContext = {
      inPostcondition: false,
      locals: new Map(),
    };

    for (const field of view.fields) {
      // Resolve declared type
      const declaredType = this.resolver.resolve(field.type);

      // Infer computation type
      const computedType = this.exprChecker.infer(field.computation, ctx);

      // Check type compatibility (warn if mismatch)
      // Note: we don't strictly enforce because computation might be valid
      this.typeMap.set(field, declaredType);
    }

    this.symbolTable.exitScope();
  }

  // ============================================================================
  // Phase 8: Check Scenarios
  // ============================================================================

  private checkScenarios(domain: Domain): void {
    for (const scenarioBlock of domain.scenarios) {
      this.checkScenarioBlock(scenarioBlock);
    }
  }

  private checkScenarioBlock(block: ScenarioBlock): void {
    // Verify the behavior exists
    const behaviorSymbol = this.symbolTable.lookup(block.behaviorName.name);

    if (!behaviorSymbol || behaviorSymbol.type.kind !== 'behavior') {
      this.diagnostics.push(undefinedBehaviorError(block.behaviorName.name, block.behaviorName.location));
      return;
    }

    const behaviorType = behaviorSymbol.type as BehaviorResolvedType;

    // Check each scenario
    for (const scenario of block.scenarios) {
      this.checkScenario(scenario, behaviorType);
    }
  }

  private checkScenario(scenario: Scenario, behaviorType: BehaviorResolvedType): void {
    // Create context for scenario
    this.symbolTable.enterScope(`scenario_${scenario.name.value}`, scenario.location);

    const ctx: ExpressionContext = {
      inPostcondition: false,
      currentBehavior: behaviorType,
      locals: new Map(),
    };

    // Check 'then' assertions
    for (const assertion of scenario.then) {
      const type = this.exprChecker.infer(assertion, ctx);
      if (type.kind !== 'primitive' || type.name !== 'Boolean') {
        this.diagnostics.push(typeMismatchError('Boolean', typeToString(type), assertion.location));
      }
    }

    this.symbolTable.exitScope();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private extractModifiers(annotations: Annotation[]): SymbolModifier[] {
    const modifiers: SymbolModifier[] = [];

    for (const ann of annotations) {
      const name = ann.name.name.toLowerCase();
      switch (name) {
        case 'immutable':
          modifiers.push('immutable');
          break;
        case 'unique':
          modifiers.push('unique');
          break;
        case 'indexed':
          modifiers.push('indexed');
          break;
        case 'pii':
          modifiers.push('pii');
          break;
        case 'secret':
          modifiers.push('secret');
          break;
        case 'sensitive':
          modifiers.push('sensitive');
          break;
        case 'computed':
          modifiers.push('computed');
          break;
        case 'optional':
          modifiers.push('optional');
          break;
        case 'deprecated':
          modifiers.push('deprecated');
          break;
      }
    }

    return modifiers;
  }

  private extractLifecycleStates(lifecycle?: LifecycleSpec): string[] | undefined {
    if (!lifecycle) return undefined;

    const states = new Set<string>();
    for (const transition of lifecycle.transitions) {
      states.add(transition.from.name);
      states.add(transition.to.name);
    }

    return Array.from(states);
  }
}
