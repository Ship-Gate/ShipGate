/**
 * Consistency Checker Pass
 * 
 * Semantic pass that detects contract consistency issues:
 * - Unsatisfiable preconditions (e.g., x > 5 && x < 2)
 * - Output referenced in preconditions
 * - Postconditions referencing undefined result fields
 * - Invariants referencing missing variables
 */

import type { Diagnostic, SourceLocation } from '@isl-lang/errors';
import type {
  Domain,
  Expression,
  Behavior,
  BinaryExpr,
  MemberExpr,
  Identifier,
  InvariantBlock,
  Entity,
  NumberLiteral,
  ResultExpr,
  OldExpr,
  QuantifierExpr,
  CallExpr,
  UnaryExpr,
  Field,
  TypeDefinition,
  StructType,
} from '@isl-lang/parser';

// ============================================================================
// Types
// ============================================================================

interface ConsistencyDiagnostic extends Omit<Diagnostic, 'source'> {
  source: 'consistency-checker';
}

interface BoundInfo {
  lower?: number;
  lowerInclusive?: boolean;
  upper?: number;
  upperInclusive?: boolean;
}

interface VariableScope {
  inputs: Set<string>;
  outputs: Set<string>;
  entities: Map<string, Set<string>>; // entity name -> field names
  types: Map<string, TypeDefinition>; // type name -> type def
  quantifiedVars: Set<string>;
}

// ============================================================================
// Error Code Constants
// ============================================================================

const ERRORS = {
  UNSATISFIABLE_PRECONDITION: 'E0310',
  OUTPUT_IN_PRECONDITION: 'E0311',
  UNDEFINED_RESULT_FIELD: 'E0312',
  UNDEFINED_INVARIANT_VARIABLE: 'E0313',
  CONTRADICTORY_BOUNDS: 'E0314',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

function locationFromNode(node: { location: SourceLocation }): SourceLocation {
  return node.location;
}

function createDiagnostic(
  code: string,
  severity: 'error' | 'warning',
  message: string,
  location: SourceLocation,
  notes?: string[],
  help?: string[]
): ConsistencyDiagnostic {
  return {
    code,
    category: 'semantic',
    severity,
    message,
    location,
    source: 'consistency-checker',
    notes,
    help,
  };
}

// ============================================================================
// Expression Variable Extraction
// ============================================================================

/**
 * Extract all variable names referenced in an expression
 */
function extractVariables(expr: Expression): Set<string> {
  const vars = new Set<string>();
  
  function walk(e: Expression): void {
    switch (e.kind) {
      case 'Identifier':
        vars.add((e as Identifier).name);
        break;
      case 'MemberExpr': {
        const mem = e as MemberExpr;
        walk(mem.object);
        break;
      }
      case 'BinaryExpr': {
        const bin = e as BinaryExpr;
        walk(bin.left);
        walk(bin.right);
        break;
      }
      case 'UnaryExpr': {
        const un = e as UnaryExpr;
        walk(un.operand);
        break;
      }
      case 'CallExpr': {
        const call = e as CallExpr;
        walk(call.callee);
        call.arguments.forEach(walk);
        break;
      }
      case 'QuantifierExpr': {
        const q = e as QuantifierExpr;
        walk(q.collection);
        // Don't include the bound variable in the required variables
        const innerVars = extractVariables(q.predicate);
        innerVars.delete(q.variable.name);
        innerVars.forEach(v => vars.add(v));
        break;
      }
      case 'OldExpr': {
        const old = e as OldExpr;
        walk(old.expression);
        break;
      }
      case 'ResultExpr': {
        // Result is a special variable
        vars.add('result');
        break;
      }
      case 'ConditionalExpr': {
        const cond = e as { condition: Expression; thenBranch: Expression; elseBranch: Expression };
        walk(cond.condition);
        walk(cond.thenBranch);
        walk(cond.elseBranch);
        break;
      }
      case 'IndexExpr': {
        const idx = e as { object: Expression; index: Expression };
        walk(idx.object);
        walk(idx.index);
        break;
      }
      case 'ListExpr': {
        const list = e as { elements: Expression[] };
        list.elements.forEach(walk);
        break;
      }
      case 'MapExpr': {
        const map = e as { entries: Array<{ key: Expression; value: Expression }> };
        map.entries.forEach(entry => {
          walk(entry.key);
          walk(entry.value);
        });
        break;
      }
      case 'LambdaExpr': {
        const lambda = e as { params: Identifier[]; body: Expression };
        const bodyVars = extractVariables(lambda.body);
        lambda.params.forEach(p => bodyVars.delete(p.name));
        bodyVars.forEach(v => vars.add(v));
        break;
      }
      // Literals don't have variables
      case 'StringLiteral':
      case 'NumberLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
      case 'DurationLiteral':
      case 'RegexLiteral':
        break;
      default:
        // Handle any other expression types
        break;
    }
  }
  
  walk(expr);
  return vars;
}

/**
 * Check if expression references 'result' or any output-related constructs
 */
function referencesOutput(expr: Expression): { found: boolean; location?: SourceLocation } {
  let result: { found: boolean; location?: SourceLocation } = { found: false };
  
  function walk(e: Expression): void {
    if (result.found) return;
    
    switch (e.kind) {
      case 'ResultExpr':
        result = { found: true, location: locationFromNode(e as ResultExpr) };
        break;
      case 'Identifier': {
        const id = e as Identifier;
        if (id.name === 'result' || id.name === 'output') {
          result = { found: true, location: locationFromNode(id) };
        }
        break;
      }
      case 'MemberExpr': {
        const mem = e as MemberExpr;
        walk(mem.object);
        break;
      }
      case 'BinaryExpr': {
        const bin = e as BinaryExpr;
        walk(bin.left);
        walk(bin.right);
        break;
      }
      case 'UnaryExpr': {
        const un = e as UnaryExpr;
        walk(un.operand);
        break;
      }
      case 'CallExpr': {
        const call = e as CallExpr;
        walk(call.callee);
        call.arguments.forEach(walk);
        break;
      }
      case 'QuantifierExpr': {
        const q = e as QuantifierExpr;
        walk(q.collection);
        walk(q.predicate);
        break;
      }
      case 'OldExpr': {
        const old = e as OldExpr;
        walk(old.expression);
        break;
      }
      default:
        // Recursively check other expression types
        if ('left' in e && 'right' in e) {
          walk((e as { left: Expression }).left);
          walk((e as { right: Expression }).right);
        }
        if ('operand' in e) {
          walk((e as { operand: Expression }).operand);
        }
        break;
    }
  }
  
  walk(expr);
  return result;
}

// ============================================================================
// Unsatisfiability Detection
// ============================================================================

/**
 * Analyze bounds constraints on a variable to detect contradictions
 * E.g., x > 5 && x < 2 is unsatisfiable
 */
function analyzeNumericBounds(expressions: Expression[]): Map<string, BoundInfo[]> {
  const bounds = new Map<string, BoundInfo[]>();
  
  function addBound(varName: string, bound: BoundInfo): void {
    if (!bounds.has(varName)) {
      bounds.set(varName, []);
    }
    bounds.get(varName)!.push(bound);
  }
  
  function analyzeComparison(expr: BinaryExpr): void {
    const { left, right, operator } = expr;
    
    // Handle: variable < number, variable > number, etc.
    if (left.kind === 'Identifier' && right.kind === 'NumberLiteral') {
      const varName = (left as Identifier).name;
      const value = (right as NumberLiteral).value;
      
      switch (operator) {
        case '<':
          addBound(varName, { upper: value, upperInclusive: false });
          break;
        case '<=':
          addBound(varName, { upper: value, upperInclusive: true });
          break;
        case '>':
          addBound(varName, { lower: value, lowerInclusive: false });
          break;
        case '>=':
          addBound(varName, { lower: value, lowerInclusive: true });
          break;
      }
    }
    
    // Handle: number < variable, etc.
    if (right.kind === 'Identifier' && left.kind === 'NumberLiteral') {
      const varName = (right as Identifier).name;
      const value = (left as NumberLiteral).value;
      
      switch (operator) {
        case '<':
          addBound(varName, { lower: value, lowerInclusive: false });
          break;
        case '<=':
          addBound(varName, { lower: value, lowerInclusive: true });
          break;
        case '>':
          addBound(varName, { upper: value, upperInclusive: false });
          break;
        case '>=':
          addBound(varName, { upper: value, upperInclusive: true });
          break;
      }
    }
    
    // Handle member expressions like account.balance > 0
    if (left.kind === 'MemberExpr' && right.kind === 'NumberLiteral') {
      const mem = left as MemberExpr;
      if (mem.object.kind === 'Identifier') {
        const varName = `${(mem.object as Identifier).name}.${mem.property.name}`;
        const value = (right as NumberLiteral).value;
        
        switch (operator) {
          case '<':
            addBound(varName, { upper: value, upperInclusive: false });
            break;
          case '<=':
            addBound(varName, { upper: value, upperInclusive: true });
            break;
          case '>':
            addBound(varName, { lower: value, lowerInclusive: false });
            break;
          case '>=':
            addBound(varName, { lower: value, lowerInclusive: true });
            break;
        }
      }
    }
  }
  
  function walkConjunction(expr: Expression): void {
    if (expr.kind === 'BinaryExpr') {
      const bin = expr as BinaryExpr;
      
      // Check for AND conjunctions
      if (bin.operator === 'and') {
        walkConjunction(bin.left);
        walkConjunction(bin.right);
      } else if (['<', '<=', '>', '>='].includes(bin.operator)) {
        analyzeComparison(bin);
      }
    }
  }
  
  for (const expr of expressions) {
    walkConjunction(expr);
  }
  
  return bounds;
}

/**
 * Check if bounds for a variable are satisfiable
 */
function checkBoundsSatisfiability(bounds: BoundInfo[]): { satisfiable: boolean; reason?: string } {
  let effectiveLower = -Infinity;
  let lowerInclusive = true;
  let effectiveUpper = Infinity;
  let upperInclusive = true;
  
  for (const bound of bounds) {
    if (bound.lower !== undefined) {
      if (bound.lower > effectiveLower || 
          (bound.lower === effectiveLower && !bound.lowerInclusive)) {
        effectiveLower = bound.lower;
        lowerInclusive = bound.lowerInclusive ?? true;
      }
    }
    if (bound.upper !== undefined) {
      if (bound.upper < effectiveUpper || 
          (bound.upper === effectiveUpper && !bound.upperInclusive)) {
        effectiveUpper = bound.upper;
        upperInclusive = bound.upperInclusive ?? true;
      }
    }
  }
  
  // Check if bounds conflict
  if (effectiveLower > effectiveUpper) {
    return {
      satisfiable: false,
      reason: `lower bound ${effectiveLower} > upper bound ${effectiveUpper}`
    };
  }
  
  if (effectiveLower === effectiveUpper) {
    if (!lowerInclusive || !upperInclusive) {
      return {
        satisfiable: false,
        reason: `bounds ${lowerInclusive ? '>=' : '>'} ${effectiveLower} and ${upperInclusive ? '<=' : '<'} ${effectiveUpper} exclude all values`
      };
    }
  }
  
  return { satisfiable: true };
}

/**
 * Check if a variable name is bound in an expression via an 'in' operator.
 * When the parser doesn't fully recognize quantifiers in domain invariant blocks,
 * it may parse `all a in Account (pred)` as separate expressions where `a` appears
 * as the left operand of an `in` BinaryExpr. In that case, `a` is a bound variable.
 */
function isVariableBoundInExpression(expr: Expression, varName: string): boolean {
  if (expr.kind === 'BinaryExpr') {
    const bin = expr as BinaryExpr;
    if (bin.operator === 'in') {
      // Left side of 'in' is a bound variable
      if (bin.left.kind === 'Identifier' && (bin.left as Identifier).name === varName) {
        return true;
      }
    }
    // Check sub-expressions
    return isVariableBoundInExpression(bin.left, varName) || isVariableBoundInExpression(bin.right, varName);
  }
  if (expr.kind === 'QuantifierExpr') {
    const q = expr as QuantifierExpr;
    if (q.variable.name === varName) return true;
  }
  return false;
}

// ============================================================================
// Result Field Extraction
// ============================================================================

/**
 * Extract result fields referenced in an expression
 */
function extractResultFields(expr: Expression): Set<string> {
  const fields = new Set<string>();
  
  function walk(e: Expression): void {
    switch (e.kind) {
      case 'ResultExpr': {
        // Parser represents result.field as ResultExpr { property: Identifier { name: 'field' } }
        const res = e as ResultExpr;
        if (res.property) {
          fields.add(res.property.name);
        }
        break;
      }
      case 'MemberExpr': {
        const mem = e as MemberExpr;
        // Check if this is result.field or result.nested.field
        if (mem.object.kind === 'ResultExpr' || 
            (mem.object.kind === 'Identifier' && (mem.object as Identifier).name === 'result')) {
          fields.add(mem.property.name);
        } else if (mem.object.kind === 'MemberExpr') {
          // Nested: might be result.something.field
          const inner = mem.object as MemberExpr;
          if (inner.object.kind === 'ResultExpr' ||
              (inner.object.kind === 'Identifier' && (inner.object as Identifier).name === 'result')) {
            fields.add(inner.property.name);
          }
        }
        walk(mem.object);
        break;
      }
      case 'BinaryExpr': {
        const bin = e as BinaryExpr;
        walk(bin.left);
        walk(bin.right);
        break;
      }
      case 'UnaryExpr': {
        const un = e as UnaryExpr;
        walk(un.operand);
        break;
      }
      case 'CallExpr': {
        const call = e as CallExpr;
        walk(call.callee);
        call.arguments.forEach(walk);
        break;
      }
      case 'QuantifierExpr': {
        const q = e as QuantifierExpr;
        walk(q.collection);
        walk(q.predicate);
        break;
      }
      case 'OldExpr': {
        const old = e as OldExpr;
        walk(old.expression);
        break;
      }
      case 'ConditionalExpr': {
        const cond = e as { condition: Expression; thenBranch: Expression; elseBranch: Expression };
        walk(cond.condition);
        walk(cond.thenBranch);
        walk(cond.elseBranch);
        break;
      }
      default:
        break;
    }
  }
  
  walk(expr);
  return fields;
}

/**
 * Get output success type fields
 */
function getOutputFields(output: Behavior['output']): Set<string> {
  const fields = new Set<string>();
  
  if (output.success.kind === 'StructType') {
    const struct = output.success as StructType;
    for (const field of struct.fields) {
      fields.add(field.name.name);
    }
  } else if (output.success.kind === 'ReferenceType') {
    // For reference types, we can't easily know the fields
    // So we return an empty set (no validation possible without type resolution)
  }
  
  return fields;
}

// ============================================================================
// Main Checker Functions
// ============================================================================

/**
 * Check for unsatisfiable preconditions
 */
function checkUnsatisfiablePreconditions(
  behavior: Behavior,
  diagnostics: ConsistencyDiagnostic[]
): void {
  if (behavior.preconditions.length === 0) return;
  
  const bounds = analyzeNumericBounds(behavior.preconditions);
  
  for (const [varName, varBounds] of bounds) {
    const result = checkBoundsSatisfiability(varBounds);
    if (!result.satisfiable) {
      diagnostics.push(createDiagnostic(
        ERRORS.UNSATISFIABLE_PRECONDITION,
        'error',
        `Preconditions for '${varName}' are unsatisfiable: ${result.reason}`,
        behavior.location,
        [
          `The constraints on '${varName}' cannot all be satisfied simultaneously.`,
          `This means the behavior '${behavior.name.name}' can never be called.`
        ],
        [
          'Review the preconditions and remove or adjust contradictory constraints.',
          'Consider if some constraints should be OR-ed instead of AND-ed.'
        ]
      ));
    }
  }
}

/**
 * Check for output references in preconditions
 */
function checkOutputInPreconditions(
  behavior: Behavior,
  diagnostics: ConsistencyDiagnostic[]
): void {
  for (const precond of behavior.preconditions) {
    const outputRef = referencesOutput(precond);
    if (outputRef.found) {
      diagnostics.push(createDiagnostic(
        ERRORS.OUTPUT_IN_PRECONDITION,
        'error',
        `Precondition references output/result, which doesn't exist before behavior execution`,
        outputRef.location ?? locationFromNode(precond),
        [
          'Preconditions are checked BEFORE the behavior executes.',
          'At that point, no output or result exists yet.'
        ],
        [
          'Move this condition to a postcondition where result is available.',
          'If checking input constraints, use input field names directly.'
        ]
      ));
    }
  }
}

/**
 * Check for undefined result fields in postconditions
 */
function checkUndefinedResultFields(
  behavior: Behavior,
  diagnostics: ConsistencyDiagnostic[]
): void {
  // Get the declared output fields
  const declaredFields = getOutputFields(behavior.output);
  
  // If we couldn't determine fields (e.g., reference type), skip this check
  if (declaredFields.size === 0 && behavior.output.success.kind === 'ReferenceType') {
    return;
  }
  
  // Check each postcondition block
  for (const postcond of behavior.postconditions) {
    for (const predicate of postcond.predicates) {
      const referencedFields = extractResultFields(predicate);
      
      for (const field of referencedFields) {
        if (!declaredFields.has(field)) {
          diagnostics.push(createDiagnostic(
            ERRORS.UNDEFINED_RESULT_FIELD,
            'error',
            `Postcondition references undefined result field '${field}'`,
            locationFromNode(predicate),
            [
              `The output type does not have a field named '${field}'.`,
              `Available fields: ${declaredFields.size > 0 ? Array.from(declaredFields).join(', ') : '(none declared)'}`
            ],
            [
              'Check the spelling of the field name.',
              'Add the field to the output type definition.',
              'Use a different field that exists in the output.'
            ]
          ));
        }
      }
    }
  }
}

/**
 * Check for undefined variables in invariants
 */
function checkInvariantVariables(
  domain: Domain,
  diagnostics: ConsistencyDiagnostic[]
): void {
  // Build scope of available variables
  const entityNames = new Set(domain.entities.map(e => e.name.name));
  const typeNames = new Set(domain.types.map(t => t.name.name));
  const behaviorNames = new Set(domain.behaviors.map(b => b.name.name));
  
  // Build entity field maps
  const entityFields = new Map<string, Set<string>>();
  for (const entity of domain.entities) {
    const fields = new Set<string>();
    for (const field of entity.fields) {
      fields.add(field.name.name);
    }
    entityFields.set(entity.name.name, fields);
  }
  
  // Check global invariants
  for (const invariantBlock of domain.invariants) {
    for (const predicate of invariantBlock.predicates) {
      const vars = extractVariables(predicate);
      
      for (const varName of vars) {
        // Check if it's a known entity/type/behavior
        if (entityNames.has(varName) || typeNames.has(varName) || behaviorNames.has(varName)) {
          continue;
        }
        
        // Check if it's a field access pattern (entity.field)
        if (varName.includes('.')) {
          const [entityName, fieldName] = varName.split('.');
          if (entityFields.has(entityName) && entityFields.get(entityName)!.has(fieldName)) {
            continue;
          }
        }
        
        // Check for common built-in functions/variables and quantifier keywords
        const builtins = new Set(['true', 'false', 'null', 'this', 'self', 'now', 'today',
          'all', 'any', 'none', 'count', 'sum', 'filter', 'exists', 'forall']);
        if (builtins.has(varName)) {
          continue;
        }
        
        // Check if this variable is bound via an 'in' operator (pseudo-quantifier)
        if (isVariableBoundInExpression(predicate, varName)) {
          continue;
        }
        
        diagnostics.push(createDiagnostic(
          ERRORS.UNDEFINED_INVARIANT_VARIABLE,
          'error',
          `Invariant references undefined variable '${varName}'`,
          locationFromNode(predicate),
          [
            `The variable '${varName}' is not defined in this scope.`,
            `Available entities: ${Array.from(entityNames).join(', ') || '(none)'}`,
            `Available types: ${Array.from(typeNames).join(', ') || '(none)'}`
          ],
          [
            'Check the spelling of the variable name.',
            'Ensure the entity or type is defined before this invariant.',
            'Use a quantifier (all, any) to bind variables from collections.'
          ]
        ));
      }
    }
  }
  
  // Check entity-level invariants
  for (const entity of domain.entities) {
    const entityFieldNames = entityFields.get(entity.name.name) || new Set();
    
    for (const invariant of entity.invariants) {
      const vars = extractVariables(invariant);
      
      for (const varName of vars) {
        // Check if it's a field of this entity
        if (entityFieldNames.has(varName)) {
          continue;
        }
        
        // Check if it references 'this' or 'self'
        if (varName === 'this' || varName === 'self') {
          continue;
        }
        
        // Check if it's a known entity/type
        if (entityNames.has(varName) || typeNames.has(varName)) {
          continue;
        }
        
        // Check built-ins
        const builtins = new Set(['true', 'false', 'null', 'now', 'today']);
        if (builtins.has(varName)) {
          continue;
        }
        
        diagnostics.push(createDiagnostic(
          ERRORS.UNDEFINED_INVARIANT_VARIABLE,
          'warning',
          `Entity invariant references variable '${varName}' which may not be in scope`,
          locationFromNode(invariant),
          [
            `In entity '${entity.name.name}', the variable '${varName}' is not a known field.`,
            `Entity fields: ${Array.from(entityFieldNames).join(', ') || '(none)'}`
          ],
          [
            'Check the spelling of the field name.',
            'Add the field to the entity definition.',
            'Use this.fieldName to explicitly reference entity fields.'
          ]
        ));
      }
    }
  }
}

/**
 * Check for behavior-level invariants referencing undefined variables
 */
function checkBehaviorInvariantVariables(
  behavior: Behavior,
  entityFields: Map<string, Set<string>>,
  diagnostics: ConsistencyDiagnostic[]
): void {
  // Build scope: inputs + known entities + built-ins
  const inputNames = new Set(behavior.input.fields.map(f => f.name.name));
  
  for (const invariant of behavior.invariants) {
    const vars = extractVariables(invariant);
    
    for (const varName of vars) {
      // Check if it's an input
      if (inputNames.has(varName)) {
        continue;
      }
      
      // Check if it's accessing a field on an entity via member expression
      // The variable extraction would give us the root identifier
      // We need to be more lenient here since complex expressions are allowed
      
      // Check built-ins
      const builtins = new Set(['true', 'false', 'null', 'this', 'self', 'now', 'today', 'result', 'old']);
      if (builtins.has(varName)) {
        continue;
      }
      
      // Check if it's a known entity name
      if (entityFields.has(varName)) {
        continue;
      }
      
      diagnostics.push(createDiagnostic(
        ERRORS.UNDEFINED_INVARIANT_VARIABLE,
        'warning',
        `Behavior invariant references variable '${varName}' which may not be defined`,
        locationFromNode(invariant),
        [
          `In behavior '${behavior.name.name}', the variable '${varName}' is not a known input.`,
          `Input fields: ${Array.from(inputNames).join(', ') || '(none)'}`
        ],
        [
          'Check the spelling of the variable name.',
          'Add the variable to the behavior input.',
          'Ensure the variable is bound in a quantifier expression.'
        ]
      ));
    }
  }
}

// ============================================================================
// Main Pass Export
// ============================================================================

export interface ConsistencyCheckerOptions {
  /** Check for unsatisfiable preconditions */
  checkUnsatisfiable?: boolean;
  /** Check for output in preconditions */
  checkOutputInPreconditions?: boolean;
  /** Check for undefined result fields */
  checkUndefinedResultFields?: boolean;
  /** Check for undefined invariant variables */
  checkInvariantVariables?: boolean;
}

const DEFAULT_OPTIONS: Required<ConsistencyCheckerOptions> = {
  checkUnsatisfiable: true,
  checkOutputInPreconditions: true,
  checkUndefinedResultFields: true,
  checkInvariantVariables: true,
};

/**
 * Consistency Checker Semantic Pass
 * 
 * Detects contract consistency issues that would make contracts
 * impossible to satisfy or reference undefined elements.
 */
export function consistencyCheckerPass(options: ConsistencyCheckerOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return {
    id: 'consistency-checker',
    name: 'Consistency Checker',
    description: 'Detects unsatisfiable conditions and undefined references in contracts',
    enabledByDefault: true,
    priority: 100,
    
    analyze(domain: Domain): Diagnostic[] {
      const diagnostics: ConsistencyDiagnostic[] = [];
      
      // Build entity field map for invariant checking
      const entityFields = new Map<string, Set<string>>();
      for (const entity of domain.entities) {
        const fields = new Set<string>();
        for (const field of entity.fields) {
          fields.add(field.name.name);
        }
        entityFields.set(entity.name.name, fields);
      }
      
      // Check each behavior
      for (const behavior of domain.behaviors) {
        if (opts.checkUnsatisfiable) {
          checkUnsatisfiablePreconditions(behavior, diagnostics);
        }
        
        if (opts.checkOutputInPreconditions) {
          checkOutputInPreconditions(behavior, diagnostics);
        }
        
        if (opts.checkUndefinedResultFields) {
          checkUndefinedResultFields(behavior, diagnostics);
        }
        
        if (opts.checkInvariantVariables) {
          checkBehaviorInvariantVariables(behavior, entityFields, diagnostics);
        }
      }
      
      // Check domain-level invariants
      if (opts.checkInvariantVariables) {
        checkInvariantVariables(domain, diagnostics);
      }
      
      return diagnostics as unknown as Diagnostic[];
    },
  };
}

// Export the pass instance for easy registration
export const consistencyChecker = consistencyCheckerPass();

// Export individual check functions for testing
export const _internals = {
  extractVariables,
  referencesOutput,
  analyzeNumericBounds,
  checkBoundsSatisfiability,
  extractResultFields,
  getOutputFields,
  checkUnsatisfiablePreconditions,
  checkOutputInPreconditions,
  checkUndefinedResultFields,
  checkInvariantVariables,
  ERRORS,
};
