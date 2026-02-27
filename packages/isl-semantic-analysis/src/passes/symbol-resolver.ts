/**
 * Symbol Resolver Semantic Pass
 * 
 * Validates that all type, entity, behavior, and field references
 * in an ISL spec resolve to declared symbols.
 * 
 * Reports diagnostics with:
 * - Precise source spans
 * - "Did you mean?" suggestions for typos
 * - Related information pointing to similar declarations
 * - Scope validation (result/old only in postconditions)
 */

import type { Domain, ASTNode, Expression, TypeDefinition, ReferenceType, Identifier, QualifiedName, MemberExpr, Behavior, Entity, PostconditionBlock } from '@isl-lang/parser';
import type { Diagnostic } from '@isl-lang/errors';
import { diagnostic, findSimilar } from '@isl-lang/errors';
import type { SemanticPass } from '../framework.js';
import { SymbolTable, BUILTIN_TYPES } from './symbol-table.js';

// ============================================================================
// Types
// ============================================================================

/** Scope context for tracking where we are in the spec */
type ScopeContext = 'precondition' | 'postcondition' | 'invariant' | 'scenario' | 'other';

interface ResolverContext {
  /** Current behavior being analyzed (for input/output scoping) */
  currentBehavior?: Behavior;
  /** Current entity being analyzed (for field scoping) */
  currentEntity?: Entity;
  /** Variables in scope (from quantifiers, scenarios, etc.) */
  scopedVariables: Set<string>;
  /** Current scope context for result/old validation */
  scope: ScopeContext;
}

// ============================================================================
// Symbol Resolver Pass
// ============================================================================

export class SymbolResolverPass implements SemanticPass {
  id = 'symbol-resolver';
  name = 'Symbol Resolver';
  description = 'Validates that all references resolve to declared symbols and are used in correct scopes';

  private symbolTable!: SymbolTable;
  private diagnostics: Diagnostic[] = [];
  private context: ResolverContext = { scopedVariables: new Set(), scope: 'other' };

  analyze(domain: Domain): Diagnostic[] {
    // Reset state
    this.diagnostics = [];
    this.context = { scopedVariables: new Set(), scope: 'other' };
    
    // Build symbol table
    this.symbolTable = SymbolTable.fromDomain(domain);

    // Validate all references
    this.validateTypes(domain);
    this.validateEntities(domain);
    this.validateBehaviors(domain);
    this.validateViews(domain);
    this.validateScenarios(domain);
    this.validateChaos(domain);

    return this.diagnostics;
  }

  // ==========================================================================
  // Type Validation
  // ==========================================================================

  private validateTypes(domain: Domain): void {
    for (const typeDecl of domain.types) {
      this.validateTypeDefinition(typeDecl.definition);
    }
  }

  private validateTypeDefinition(typeDef: TypeDefinition): void {
    switch (typeDef.kind) {
      case 'ReferenceType':
        this.validateTypeReference(typeDef);
        break;
      case 'ListType':
        this.validateTypeDefinition(typeDef.element);
        break;
      case 'MapType':
        this.validateTypeDefinition(typeDef.key);
        this.validateTypeDefinition(typeDef.value);
        break;
      case 'OptionalType':
        this.validateTypeDefinition(typeDef.inner);
        break;
      case 'ConstrainedType':
        this.validateTypeDefinition(typeDef.base);
        for (const constraint of typeDef.constraints) {
          this.validateExpression(constraint.value);
        }
        break;
      case 'StructType':
        for (const field of typeDef.fields) {
          this.validateTypeDefinition(field.type);
        }
        break;
      case 'UnionType':
        for (const variant of typeDef.variants) {
          for (const field of variant.fields) {
            this.validateTypeDefinition(field.type);
          }
        }
        break;
      // PrimitiveType and EnumType don't need validation
    }
  }

  private validateTypeReference(ref: ReferenceType): void {
    const name = this.qualifiedNameToString(ref.name);
    
    // Check if it's a known type
    if (!this.symbolTable.has(name)) {
      this.reportUndefinedType(name, ref.location);
    }
  }

  // ==========================================================================
  // Entity Validation
  // ==========================================================================

  private validateEntities(domain: Domain): void {
    for (const entity of domain.entities) {
      this.context.currentEntity = entity;
      
      // Validate field types
      for (const field of entity.fields) {
        this.validateTypeDefinition(field.type);
      }

      // Validate invariants
      for (const invariant of entity.invariants) {
        this.validateExpression(invariant);
      }

      this.context.currentEntity = undefined;
    }
  }

  // ==========================================================================
  // Behavior Validation
  // ==========================================================================

  private validateBehaviors(domain: Domain): void {
    for (const behavior of domain.behaviors) {
      this.context.currentBehavior = behavior;
      
      // Validate input types
      for (const field of behavior.input.fields) {
        this.validateTypeDefinition(field.type);
      }

      // Validate output types
      this.validateTypeDefinition(behavior.output.success);
      for (const errorSpec of behavior.output.errors) {
        if (errorSpec.returns) {
          this.validateTypeDefinition(errorSpec.returns);
        }
      }

      // Validate preconditions - result/old are NOT valid here
      this.context.scope = 'precondition';
      for (const precond of behavior.preconditions) {
        this.validateExpression(precond);
      }

      // Validate postconditions - result/old ARE valid here
      this.context.scope = 'postcondition';
      for (const postcond of behavior.postconditions) {
        this.validatePostconditionBlock(postcond);
      }

      // Validate invariants - old is NOT valid here (result is debatable)
      this.context.scope = 'invariant';
      for (const invariant of behavior.invariants) {
        this.validateExpression(invariant);
      }

      // Reset scope for other validations
      this.context.scope = 'other';

      // Validate actor constraints
      if (behavior.actors) {
        for (const actor of behavior.actors) {
          for (const constraint of actor.constraints) {
            this.validateExpression(constraint);
          }
        }
      }

      // Validate temporal specs
      for (const temporal of behavior.temporal) {
        this.validateExpression(temporal.predicate);
      }

      // Validate security specs
      for (const security of behavior.security) {
        this.validateExpression(security.details);
      }

      // Validate compliance specs
      for (const compliance of behavior.compliance) {
        for (const req of compliance.requirements) {
          this.validateExpression(req);
        }
      }

      this.context.currentBehavior = undefined;
    }
  }

  private validatePostconditionBlock(block: PostconditionBlock): void {
    // Validate the condition reference if it's an identifier (error name)
    if (typeof block.condition !== 'string' && block.condition.kind === 'Identifier') {
      // Check if it's a declared error in the current behavior
      const behavior = this.context.currentBehavior;
      if (behavior) {
        const errorNames = behavior.output.errors.map(e => e.name.name);
        const condName = block.condition.name;
        if (condName !== 'success' && condName !== 'any_error' && !errorNames.includes(condName)) {
          this.reportUndefinedBehavior(condName, block.condition.location);
        }
      }
    }

    for (const predicate of block.predicates) {
      this.validateExpression(predicate);
    }
  }

  // ==========================================================================
  // View Validation
  // ==========================================================================

  private validateViews(domain: Domain): void {
    for (const view of domain.views) {
      // Validate forEntity reference
      this.validateTypeReference(view.forEntity);

      // Validate field types and computations
      for (const field of view.fields) {
        this.validateTypeDefinition(field.type);
        this.validateExpression(field.computation);
      }

      // Validate cache invalidation expressions
      if (view.cache) {
        for (const expr of view.cache.invalidateOn) {
          this.validateExpression(expr);
        }
      }
    }
  }

  // ==========================================================================
  // Scenario Validation
  // ==========================================================================

  private validateScenarios(domain: Domain): void {
    for (const scenarioBlock of domain.scenarios) {
      // Validate behavior reference
      const behaviorName = scenarioBlock.behaviorName.name;
      if (!this.symbolTable.has(behaviorName)) {
        this.reportUndefinedBehavior(behaviorName, scenarioBlock.behaviorName.location);
      }

      this.context.scope = 'scenario';

      for (const scenario of scenarioBlock.scenarios) {
        // given/when/then may introduce scoped variables
        const scopedVars = new Set<string>();
        
        for (const stmt of scenario.given) {
          if (stmt.kind === 'AssignmentStmt') {
            scopedVars.add(stmt.target.name);
          }
          this.validateStatement(stmt);
        }

        this.context.scopedVariables = scopedVars;

        for (const stmt of scenario.when) {
          if (stmt.kind === 'AssignmentStmt') {
            scopedVars.add(stmt.target.name);
          }
          this.validateStatement(stmt);
        }

        for (const assertion of scenario.then) {
          this.validateExpression(assertion);
        }

        this.context.scopedVariables = new Set();
      }

      this.context.scope = 'other';
    }
  }

  // ==========================================================================
  // Chaos Validation
  // ==========================================================================

  private validateChaos(domain: Domain): void {
    for (const chaosBlock of domain.chaos) {
      // Validate behavior reference
      const behaviorName = chaosBlock.behaviorName.name;
      if (!this.symbolTable.has(behaviorName)) {
        this.reportUndefinedBehavior(behaviorName, chaosBlock.behaviorName.location);
      }

      for (const scenario of chaosBlock.scenarios) {
        // Validate injections
        for (const injection of scenario.inject) {
          this.validateExpression(injection.target);
          for (const param of injection.parameters) {
            this.validateExpression(param.value);
          }
        }

        for (const stmt of scenario.when) {
          this.validateStatement(stmt);
        }

        for (const assertion of scenario.then) {
          this.validateExpression(assertion);
        }
      }
    }
  }

  // ==========================================================================
  // Statement Validation
  // ==========================================================================

  private validateStatement(stmt: ASTNode): void {
    switch (stmt.kind) {
      case 'AssignmentStmt':
        this.validateExpression((stmt as any).value);
        break;
      case 'CallStmt':
        this.validateExpression((stmt as any).call);
        break;
      case 'LoopStmt':
        this.validateExpression((stmt as any).count);
        for (const bodyStmt of (stmt as any).body) {
          this.validateStatement(bodyStmt);
        }
        break;
    }
  }

  // ==========================================================================
  // Expression Validation
  // ==========================================================================

  private validateExpression(expr: Expression): void {
    switch (expr.kind) {
      case 'Identifier':
        this.validateIdentifierReference(expr);
        break;
      case 'QualifiedName':
        this.validateQualifiedName(expr);
        break;
      case 'MemberExpr':
        this.validateMemberExpression(expr);
        break;
      case 'CallExpr':
        this.validateExpression(expr.callee);
        for (const arg of expr.arguments) {
          this.validateExpression(arg);
        }
        break;
      case 'BinaryExpr':
        this.validateExpression(expr.left);
        this.validateExpression(expr.right);
        break;
      case 'UnaryExpr':
        this.validateExpression(expr.operand);
        break;
      case 'IndexExpr':
        this.validateExpression(expr.object);
        this.validateExpression(expr.index);
        break;
      case 'QuantifierExpr':
        // Add bound variable to scope
        const prevScoped = new Set(this.context.scopedVariables);
        this.context.scopedVariables.add(expr.variable.name);
        this.validateExpression(expr.collection);
        this.validateExpression(expr.predicate);
        this.context.scopedVariables = prevScoped;
        break;
      case 'ConditionalExpr':
        this.validateExpression(expr.condition);
        this.validateExpression(expr.thenBranch);
        this.validateExpression(expr.elseBranch);
        break;
      case 'OldExpr':
        // old() is only valid in postconditions
        if (this.context.scope === 'precondition') {
          this.reportOldInPrecondition(expr.location);
        } else if (this.context.scope === 'invariant') {
          this.reportOldInInvariant(expr.location);
        }
        this.validateExpression(expr.expression);
        break;
      case 'ResultExpr':
        // result is only valid in postconditions
        if (this.context.scope === 'precondition') {
          this.reportResultInPrecondition(expr.location);
        } else if (this.context.scope === 'invariant') {
          // result in invariants is a warning - might be valid in some contexts
          this.reportResultInInvariant(expr.location);
        }
        break;
      case 'InputExpr':
        // Validate that input.property exists
        if (this.context.currentBehavior) {
          const fieldNames = this.context.currentBehavior.input.fields.map(f => f.name.name);
          if (!fieldNames.includes(expr.property.name)) {
            this.reportUndefinedField(
              expr.property.name,
              'input',
              expr.property.location,
              fieldNames
            );
          }
        }
        break;
      case 'LambdaExpr':
        const prevLambdaScoped = new Set(this.context.scopedVariables);
        for (const param of expr.params) {
          this.context.scopedVariables.add(param.name);
        }
        this.validateExpression(expr.body);
        this.context.scopedVariables = prevLambdaScoped;
        break;
      case 'ListExpr':
        for (const elem of expr.elements) {
          this.validateExpression(elem);
        }
        break;
      case 'MapExpr':
        for (const entry of expr.entries) {
          this.validateExpression(entry.key);
          this.validateExpression(entry.value);
        }
        break;
      // Literals don't need validation
    }
  }

  private validateIdentifierReference(id: Identifier): void {
    const name = id.name;

    // Skip keywords and built-in functions
    if (this.isBuiltinFunction(name)) {
      // Special check for 'result' - only valid in postconditions
      if (name === 'result' && this.context.scope === 'precondition') {
        this.reportResultInPrecondition(id.location);
      }
      return;
    }

    // Check scoped variables first (from quantifiers, scenarios, lambdas)
    if (this.context.scopedVariables.has(name)) {
      return;
    }

    // Check if it's a known type, entity, or behavior
    if (this.symbolTable.has(name)) {
      return;
    }

    // Check if it's an input field in current behavior context
    if (this.context.currentBehavior) {
      const inputFields = this.context.currentBehavior.input.fields.map(f => f.name.name);
      if (inputFields.includes(name)) {
        return;
      }
    }

    // Check if it's a field in current entity context
    if (this.context.currentEntity) {
      const entityFields = this.context.currentEntity.fields.map(f => f.name.name);
      if (entityFields.includes(name)) {
        return;
      }
    }

    // Determine what kind of symbol this likely is based on context
    const allTypes = this.symbolTable.getTypeNames();
    const allEntities = this.symbolTable.getEntityNames();
    const allBehaviors = this.symbolTable.getBehaviorNames();
    
    // Check for similar types (might be a typo)
    const typeSuggestions = findSimilar(name, allTypes);
    if (typeSuggestions.length > 0 && typeSuggestions[0]!.distance <= 2) {
      this.reportUndefinedType(name, id.location);
      return;
    }

    // Check for similar entities
    const entitySuggestions = findSimilar(name, allEntities);
    if (entitySuggestions.length > 0 && entitySuggestions[0]!.distance <= 2) {
      this.reportUndefinedEntity(name, id.location);
      return;
    }

    // Check for similar behaviors
    const behaviorSuggestions = findSimilar(name, allBehaviors);
    if (behaviorSuggestions.length > 0 && behaviorSuggestions[0]!.distance <= 2) {
      this.reportUndefinedBehavior(name, id.location);
      return;
    }

    // Generic undefined variable error
    this.reportUndefinedVariable(name, id.location);
  }

  private validateQualifiedName(qn: QualifiedName): void {
    if (qn.parts.length === 0) return;

    // First part should be a known type/entity
    const firstName = qn.parts[0]!.name;
    if (!this.symbolTable.has(firstName) && !this.context.scopedVariables.has(firstName)) {
      this.reportUndefinedType(firstName, qn.parts[0]!.location);
    }
  }

  private validateMemberExpression(expr: MemberExpr): void {
    // Check for special cases: input.field and result.field
    if (expr.object.kind === 'Identifier') {
      const objName = expr.object.name;
      const propName = expr.property.name;
      
      // Handle input.field - validate against behavior input fields
      if (objName === 'input' && this.context.currentBehavior) {
        const fieldNames = this.context.currentBehavior.input.fields.map(f => f.name.name);
        if (!fieldNames.includes(propName)) {
          this.reportUndefinedField(propName, 'input', expr.property.location, fieldNames);
        }
        return; // Don't validate 'input' as an identifier
      }
      
      // Handle result.field - only valid in postconditions
      if (objName === 'result') {
        // Check scope - result.* is only valid in postconditions
        if (this.context.scope === 'precondition') {
          this.reportResultInPrecondition(expr.object.location);
        } else if (this.context.scope === 'invariant') {
          this.reportResultInInvariant(expr.object.location);
        }
        return; // result properties are validated at type-check time
      }
      
      // Check if object is an entity and property is a valid field
      const entity = this.symbolTable.get(objName);
      if (entity?.kind === 'entity') {
        const fields = this.symbolTable.getEntityFields(objName);
        if (!fields.includes(propName)) {
          this.reportUndefinedField(propName, objName, expr.property.location, fields);
        }
      }
    }
    
    // Validate the object expression (but not for input/result builtins)
    if (expr.object.kind !== 'Identifier' || 
        (expr.object.name !== 'input' && expr.object.name !== 'result')) {
      this.validateExpression(expr.object);
    }
  }

  // ==========================================================================
  // Error Reporting
  // ==========================================================================

  private reportUndefinedType(name: string, location: any): void {
    const allTypes = this.symbolTable.getTypeNames();
    const builder = diagnostic()
      .error('E0201')
      .message(`Type '${name}' is not defined`)
      .at(location)
      .from('typechecker');

    // Add suggestions
    const suggestions = findSimilar(name, allTypes, { maxDistance: 3, maxSuggestions: 3 });
    if (suggestions.length > 0) {
      builder.suggestSimilar(name, allTypes);
    }

    // Check if it's a lowercase version of a builtin
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    if (BUILTIN_TYPES.has(capitalizedName)) {
      builder.help(`Type names start with uppercase. Did you mean '${capitalizedName}'?`);
    }

    this.diagnostics.push(builder.build());
  }

  private reportUndefinedEntity(name: string, location: any): void {
    const allEntities = this.symbolTable.getEntityNames();
    const builder = diagnostic()
      .error('E0301')
      .message(`Entity '${name}' is not defined`)
      .at(location)
      .from('typechecker')
      .suggestSimilar(name, allEntities);

    this.diagnostics.push(builder.build());
  }

  private reportUndefinedBehavior(name: string, location: any): void {
    const allBehaviors = this.symbolTable.getBehaviorNames();
    const builder = diagnostic()
      .error('E0302')
      .message(`Behavior '${name}' is not defined`)
      .at(location)
      .from('typechecker')
      .suggestSimilar(name, allBehaviors);

    this.diagnostics.push(builder.build());
  }

  private reportUndefinedField(fieldName: string, parentName: string, location: any, availableFields: string[]): void {
    const builder = diagnostic()
      .error('E0202')
      .message(`Field '${fieldName}' does not exist on type '${parentName}'`)
      .at(location)
      .from('typechecker')
      .suggestSimilar(fieldName, availableFields);

    if (availableFields.length > 0 && availableFields.length <= 5) {
      builder.note(`Available fields: ${availableFields.join(', ')}`);
    }

    this.diagnostics.push(builder.build());
  }

  private reportUndefinedVariable(name: string, location: any): void {
    const builder = diagnostic()
      .error('E0300')
      .message(`Variable '${name}' is not defined`)
      .at(location)
      .from('typechecker');

    // Collect all possible suggestions
    const allSymbols = [
      ...this.symbolTable.getTypeNames(),
      ...this.symbolTable.getEntityNames(),
      ...this.symbolTable.getBehaviorNames(),
    ];

    builder.suggestSimilar(name, allSymbols);

    this.diagnostics.push(builder.build());
  }

  private reportOldInPrecondition(location: any): void {
    const builder = diagnostic()
      .error('E0304')
      .message(`'old()' cannot be used in preconditions`)
      .at(location)
      .from('typechecker')
      .help('old() captures pre-execution state and only makes sense in postconditions')
      .help('In preconditions, reference values directly without old()');

    this.diagnostics.push(builder.build());
  }

  private reportOldInInvariant(location: any): void {
    const builder = diagnostic()
      .error('E0304')
      .message(`'old()' cannot be used in invariants`)
      .at(location)
      .from('typechecker')
      .help('old() captures pre-execution state and only makes sense in postconditions')
      .help('Invariants describe properties that are always true');

    this.diagnostics.push(builder.build());
  }

  private reportResultInPrecondition(location: any): void {
    const builder = diagnostic()
      .error('E0311')
      .message(`'result' cannot be referenced in preconditions`)
      .at(location)
      .from('typechecker')
      .help('result refers to the return value of a behavior, which does not exist until after execution')
      .help('Preconditions are checked BEFORE execution - use input fields instead');

    this.diagnostics.push(builder.build());
  }

  private reportResultInInvariant(location: any): void {
    const builder = diagnostic()
      .warning('W0311')
      .message(`'result' referenced in invariant - this may not be valid`)
      .at(location)
      .from('typechecker')
      .help('result refers to the behavior return value, which may not be available in invariant context')
      .help('Consider moving this check to a postcondition');

    this.diagnostics.push(builder.build());
  }


  // ==========================================================================
  // Helpers
  // ==========================================================================

  private qualifiedNameToString(qn: QualifiedName): string {
    return qn.parts.map(p => p.name).join('.');
  }

  private isBuiltinFunction(name: string): boolean {
    const builtins = new Set([
      // Boolean
      'true', 'false',
      // Null
      'null',
      // Aggregations
      'sum', 'count', 'min', 'max', 'avg',
      // Collections
      'length', 'size', 'contains', 'isEmpty', 'first', 'last',
      // String
      'toLowerCase', 'toUpperCase', 'trim', 'substring', 'startsWith', 'endsWith', 'matches',
      // Math
      'abs', 'floor', 'ceil', 'round', 'sqrt', 'pow',
      // Type checks
      'isNull', 'isPresent', 'isValid',
      // Time
      'now', 'today', 'duration',
      // Special ISL functions
      'old', 'result', 'input', 'sender', 'receiver',
    ]);
    return builtins.has(name);
  }
}

/**
 * Singleton instance of the symbol resolver pass
 */
export const symbolResolverPass = new SymbolResolverPass();
