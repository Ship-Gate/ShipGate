/**
 * ISL Semantic Linter - Rules
 * 
 * Lint rules for detecting issues in ISL specifications.
 */

import type {
  Domain,
  Behavior,
  Expression,
  BinaryExpr,
  NumberLiteral,
  BooleanLiteral,
  Identifier,
  MemberExpr,
} from '@isl-lang/parser';

import type {
  LintRule,
  LintDiagnostic,
  LintContext,
} from './lintTypes.js';

import {
  SECURITY_SENSITIVE_PATTERNS,
  CRITICAL_BEHAVIOR_PATTERNS,
} from './lintTypes.js';

// ============================================================================
// Rule: Missing Postconditions on Critical Behaviors (ISL001)
// ============================================================================

export const missingPostconditionsRule: LintRule = {
  id: 'ISL001',
  name: 'missing-postconditions',
  description: 'Critical behaviors should have postconditions to verify expected outcomes',
  severity: 'warning',
  category: 'completeness',
  
  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report } = context;
    
    for (const behavior of domain.behaviors) {
      const name = behavior.name.name.toLowerCase();
      
      // Check if behavior name matches critical patterns
      const isCritical = CRITICAL_BEHAVIOR_PATTERNS.some(pattern => 
        name.includes(pattern)
      );
      
      if (isCritical) {
        // Check if behavior has postconditions
        const hasPostconditions = behavior.postconditions.length > 0 &&
          behavior.postconditions.some(pc => pc.predicates.length > 0);
        
        if (!hasPostconditions) {
          diagnostics.push(report({
            node: behavior,
            elementName: behavior.name.name,
            message: `Critical behavior "${behavior.name.name}" has no postconditions. ` +
              `Behaviors that ${getCriticalAction(name)} should specify expected outcomes.`,
            suggestion: `Add postconditions to verify the expected state changes, e.g.:\n` +
              `  postconditions {\n` +
              `    success implies {\n` +
              `      - result.id != null\n` +
              `    }\n` +
              `  }`,
          }));
        }
      }
    }
    
    return diagnostics;
  },
};

function getCriticalAction(name: string): string {
  if (name.includes('create')) return 'create resources';
  if (name.includes('update')) return 'modify data';
  if (name.includes('delete') || name.includes('remove')) return 'delete resources';
  if (name.includes('transfer')) return 'transfer assets';
  if (name.includes('approve')) return 'approve actions';
  return 'perform critical operations';
}

// ============================================================================
// Rule: Ambiguous Actor/Subject (ISL002)
// ============================================================================

export const ambiguousActorRule: LintRule = {
  id: 'ISL002',
  name: 'ambiguous-actor',
  description: 'Behaviors should clearly specify who can perform them',
  severity: 'warning',
  category: 'clarity',
  
  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report } = context;
    
    for (const behavior of domain.behaviors) {
      // Check if actors are specified
      const hasActors = behavior.actors && behavior.actors.length > 0;
      
      if (!hasActors) {
        // Check if the behavior name suggests it should have actors
        const name = behavior.name.name.toLowerCase();
        const suggestsActor = 
          name.includes('admin') ||
          name.includes('user') ||
          name.includes('owner') ||
          name.includes('manager') ||
          name.includes('approve') ||
          name.includes('reject') ||
          name.includes('grant') ||
          name.includes('revoke');
        
        // Also check if it's security-sensitive
        const isSecuritySensitive = SECURITY_SENSITIVE_PATTERNS.some(pattern =>
          name.includes(pattern)
        );
        
        if (suggestsActor || isSecuritySensitive) {
          diagnostics.push(report({
            node: behavior,
            elementName: behavior.name.name,
            message: `Behavior "${behavior.name.name}" has no actor specification. ` +
              `It's unclear who is authorized to perform this action.`,
            suggestion: `Add an actors block to specify who can perform this behavior:\n` +
              `  actors {\n` +
              `    User {\n` +
              `      must: authenticated\n` +
              `    }\n` +
              `  }`,
          }));
        }
      } else {
        // Check for actors without constraints
        for (const actor of behavior.actors) {
          if (actor.constraints.length === 0) {
            diagnostics.push(report({
              node: actor,
              elementName: `${behavior.name.name}.${actor.name.name}`,
              message: `Actor "${actor.name.name}" in behavior "${behavior.name.name}" ` +
                `has no constraints. Any ${actor.name.name} can perform this action.`,
              suggestion: `Consider adding constraints like "must: authenticated" or ` +
                `"must: hasRole('admin')"`,
            }));
          }
        }
      }
    }
    
    return diagnostics;
  },
};

// ============================================================================
// Rule: Security-Sensitive Behavior Without Constraints (ISL003)
// ============================================================================

export const securitySensitiveNoConstraintsRule: LintRule = {
  id: 'ISL003',
  name: 'security-sensitive-no-constraints',
  description: 'Security-sensitive behaviors should have preconditions, security specs, or actor constraints',
  severity: 'error',
  category: 'safety',
  
  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report } = context;
    
    for (const behavior of domain.behaviors) {
      const name = behavior.name.name.toLowerCase();
      
      // Check if behavior name matches security-sensitive patterns
      const matchedPatterns = SECURITY_SENSITIVE_PATTERNS.filter(pattern =>
        name.includes(pattern)
      );
      
      if (matchedPatterns.length > 0) {
        // Check if behavior has any security measures
        const hasPreconditions = behavior.preconditions.length > 0;
        const hasSecuritySpecs = behavior.security.length > 0;
        const hasActorConstraints = behavior.actors?.some(a => 
          a.constraints.length > 0
        ) ?? false;
        
        if (!hasPreconditions && !hasSecuritySpecs && !hasActorConstraints) {
          const category = categorizeSecurityPattern(matchedPatterns[0]);
          
          diagnostics.push(report({
            node: behavior,
            elementName: behavior.name.name,
            message: `Security-sensitive behavior "${behavior.name.name}" (${category}) ` +
              `has no security constraints. This could be a security vulnerability.`,
            suggestion: getSuggestionForCategory(category),
            meta: {
              securityCategory: category,
              matchedPatterns,
            },
          }));
        }
      }
    }
    
    return diagnostics;
  },
};

function categorizeSecurityPattern(pattern: string): string {
  const authPatterns = ['auth', 'login', 'logout', 'signin', 'signout', 'signup', 'register', 'password', 'credential'];
  const paymentPatterns = ['payment', 'pay', 'charge', 'refund', 'transfer', 'withdraw', 'deposit', 'transaction', 'billing'];
  const uploadPatterns = ['upload', 'download', 'export', 'import'];
  
  if (authPatterns.includes(pattern)) return 'authentication';
  if (paymentPatterns.includes(pattern)) return 'payment';
  if (uploadPatterns.includes(pattern)) return 'file-handling';
  return 'sensitive-data';
}

function getSuggestionForCategory(category: string): string {
  switch (category) {
    case 'authentication':
      return `Add security constraints for authentication behaviors:\n` +
        `  preconditions {\n` +
        `    - input.password.length >= 8\n` +
        `  }\n` +
        `  security {\n` +
        `    rate_limit: "5 per minute"\n` +
        `  }`;
    case 'payment':
      return `Add security constraints for payment behaviors:\n` +
        `  actors {\n` +
        `    User { must: authenticated }\n` +
        `  }\n` +
        `  preconditions {\n` +
        `    - input.amount > 0\n` +
        `    - actor.balance >= input.amount\n` +
        `  }\n` +
        `  security {\n` +
        `    fraud_check: enabled\n` +
        `  }`;
    case 'file-handling':
      return `Add security constraints for file handling:\n` +
        `  actors {\n` +
        `    User { must: authenticated }\n` +
        `  }\n` +
        `  preconditions {\n` +
        `    - input.file.size <= 10MB\n` +
        `    - input.file.type in ["image/png", "image/jpeg"]\n` +
        `  }`;
    default:
      return `Add appropriate security constraints:\n` +
        `  actors {\n` +
        `    User { must: authenticated }\n` +
        `  }\n` +
        `  preconditions {\n` +
        `    - // Add validation constraints\n` +
        `  }`;
  }
}

// ============================================================================
// Rule: Impossible Constraints (ISL004)
// ============================================================================

export const impossibleConstraintsRule: LintRule = {
  id: 'ISL004',
  name: 'impossible-constraints',
  description: 'Detect constraints that can never be satisfied',
  severity: 'error',
  category: 'correctness',
  
  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report } = context;
    
    // Check preconditions
    for (const behavior of domain.behaviors) {
      for (const precondition of behavior.preconditions) {
        const issues = checkForImpossibleConstraint(precondition);
        for (const issue of issues) {
          diagnostics.push(report({
            node: precondition,
            elementName: behavior.name.name,
            message: `Impossible precondition in "${behavior.name.name}": ${issue}`,
            suggestion: 'Review and fix the constraint logic',
          }));
        }
      }
      
      // Check postconditions
      for (const postcondition of behavior.postconditions) {
        for (const predicate of postcondition.predicates) {
          const issues = checkForImpossibleConstraint(predicate);
          for (const issue of issues) {
            diagnostics.push(report({
              node: predicate,
              elementName: behavior.name.name,
              message: `Impossible postcondition in "${behavior.name.name}": ${issue}`,
              suggestion: 'Review and fix the constraint logic',
            }));
          }
        }
      }
    }
    
    // Check entity invariants
    for (const entity of domain.entities) {
      for (const invariant of entity.invariants) {
        const issues = checkForImpossibleConstraint(invariant);
        for (const issue of issues) {
          diagnostics.push(report({
            node: invariant,
            elementName: entity.name.name,
            message: `Impossible invariant in entity "${entity.name.name}": ${issue}`,
            suggestion: 'Review and fix the invariant logic',
          }));
        }
      }
    }
    
    return diagnostics;
  },
};

function checkForImpossibleConstraint(expr: Expression): string[] {
  const issues: string[] = [];
  
  if (expr.kind === 'BinaryExpr') {
    const binary = expr as BinaryExpr;
    
    // Check for x != x (always false)
    if (binary.operator === '!=') {
      if (areExpressionsEqual(binary.left, binary.right)) {
        issues.push('Comparing value to itself with != is always false');
      }
    }
    
    // Check for x < x or x > x (always false)
    if (binary.operator === '<' || binary.operator === '>') {
      if (areExpressionsEqual(binary.left, binary.right)) {
        issues.push(`Comparing value to itself with ${binary.operator} is always false`);
      }
    }
    
    // Check for contradictory numeric comparisons
    if (isNumericLiteral(binary.left) && isNumericLiteral(binary.right)) {
      const left = (binary.left as NumberLiteral).value;
      const right = (binary.right as NumberLiteral).value;
      
      if (binary.operator === '==' && left !== right) {
        issues.push(`${left} == ${right} is always false`);
      }
      if (binary.operator === '!=' && left === right) {
        issues.push(`${left} != ${right} is always false`);
      }
      if (binary.operator === '<' && left >= right) {
        issues.push(`${left} < ${right} is always false`);
      }
      if (binary.operator === '>' && left <= right) {
        issues.push(`${left} > ${right} is always false`);
      }
      if (binary.operator === '<=' && left > right) {
        issues.push(`${left} <= ${right} is always false`);
      }
      if (binary.operator === '>=' && left < right) {
        issues.push(`${left} >= ${right} is always false`);
      }
    }
    
    // Check for "and" with contradictory conditions
    if (binary.operator === 'and') {
      const leftIssues = checkForImpossibleConstraint(binary.left);
      const rightIssues = checkForImpossibleConstraint(binary.right);
      issues.push(...leftIssues, ...rightIssues);
      
      // Check for x > 5 and x < 3 pattern
      const contradiction = findContradiction(binary.left, binary.right);
      if (contradiction) {
        issues.push(contradiction);
      }
    }
    
    // Check for boolean literal comparisons
    if (binary.operator === '==' && isBooleanLiteral(binary.right)) {
      const boolVal = (binary.right as BooleanLiteral).value;
      if (boolVal === false && isBooleanLiteral(binary.left)) {
        const leftVal = (binary.left as BooleanLiteral).value;
        if (leftVal === true) {
          issues.push('true == false is always false');
        }
      }
    }
  }
  
  return issues;
}

function areExpressionsEqual(a: Expression, b: Expression): boolean {
  if (a.kind !== b.kind) return false;
  
  if (a.kind === 'Identifier' && b.kind === 'Identifier') {
    return (a as Identifier).name === (b as Identifier).name;
  }
  
  if (a.kind === 'MemberExpr' && b.kind === 'MemberExpr') {
    const aMember = a as MemberExpr;
    const bMember = b as MemberExpr;
    return areExpressionsEqual(aMember.object, bMember.object) &&
           aMember.property.name === bMember.property.name;
  }
  
  if (a.kind === 'NumberLiteral' && b.kind === 'NumberLiteral') {
    return (a as NumberLiteral).value === (b as NumberLiteral).value;
  }
  
  return false;
}

function isNumericLiteral(expr: Expression): expr is NumberLiteral {
  return expr.kind === 'NumberLiteral';
}

function isBooleanLiteral(expr: Expression): expr is BooleanLiteral {
  return expr.kind === 'BooleanLiteral';
}

function findContradiction(left: Expression, right: Expression): string | null {
  // Look for patterns like x > 5 and x < 3
  if (left.kind === 'BinaryExpr' && right.kind === 'BinaryExpr') {
    const leftBin = left as BinaryExpr;
    const rightBin = right as BinaryExpr;
    
    // Check if they refer to the same variable
    if (!areExpressionsEqual(leftBin.left, rightBin.left)) {
      return null;
    }
    
    // Check for numeric contradictions
    if (isNumericLiteral(leftBin.right) && isNumericLiteral(rightBin.right)) {
      const leftVal = (leftBin.right as NumberLiteral).value;
      const rightVal = (rightBin.right as NumberLiteral).value;
      
      // x > 5 and x < 3
      if ((leftBin.operator === '>' || leftBin.operator === '>=') &&
          (rightBin.operator === '<' || rightBin.operator === '<=')) {
        if (leftVal >= rightVal) {
          return `Contradictory constraints: value must be both > ${leftVal} and < ${rightVal}`;
        }
      }
      
      // x < 3 and x > 5
      if ((leftBin.operator === '<' || leftBin.operator === '<=') &&
          (rightBin.operator === '>' || rightBin.operator === '>=')) {
        if (leftVal <= rightVal) {
          return `Contradictory constraints: value must be both < ${leftVal} and > ${rightVal}`;
        }
      }
    }
  }
  
  return null;
}

// ============================================================================
// Rule: Empty Error Specifications (ISL005)
// ============================================================================

export const emptyErrorSpecRule: LintRule = {
  id: 'ISL005',
  name: 'empty-error-spec',
  description: 'Behaviors should specify possible error conditions',
  severity: 'info',
  category: 'completeness',
  
  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report } = context;
    
    for (const behavior of domain.behaviors) {
      // Skip behaviors that are simple queries
      const name = behavior.name.name.toLowerCase();
      const isQuery = name.startsWith('get') || 
                      name.startsWith('list') || 
                      name.startsWith('find') ||
                      name.startsWith('search');
      
      if (isQuery) continue;
      
      // Check if behavior has error specifications
      const hasErrors = behavior.output.errors.length > 0;
      
      if (!hasErrors) {
        diagnostics.push(report({
          node: behavior.output,
          elementName: behavior.name.name,
          message: `Behavior "${behavior.name.name}" has no error specifications. ` +
            `Consider what could go wrong.`,
          suggestion: `Add error cases to the output:\n` +
            `  output {\n` +
            `    success: Result\n` +
            `    errors {\n` +
            `      NOT_FOUND {\n` +
            `        when: "Resource not found"\n` +
            `        retriable: false\n` +
            `      }\n` +
            `    }\n` +
            `  }`,
        }));
      }
    }
    
    return diagnostics;
  },
};

// ============================================================================
// Rule: Missing Input Validation (ISL006)
// ============================================================================

export const missingInputValidationRule: LintRule = {
  id: 'ISL006',
  name: 'missing-input-validation',
  description: 'Behaviors with string/numeric inputs should validate them',
  severity: 'hint',
  category: 'best-practice',
  
  check(context: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];
    const { domain, report } = context;
    
    for (const behavior of domain.behaviors) {
      const inputFields = behavior.input.fields;
      
      for (const field of inputFields) {
        const fieldType = getTypeName(field.type);
        const fieldName = field.name.name.toLowerCase();
        
        // Check if this field is validated in preconditions
        const isValidated = behavior.preconditions.some(pre => 
          expressionReferencesField(pre, field.name.name)
        );
        
        if (!isValidated) {
          // Flag common fields that should be validated
          if (fieldType === 'String' && shouldValidateString(fieldName)) {
            diagnostics.push(report({
              node: field,
              elementName: `${behavior.name.name}.input.${field.name.name}`,
              message: `Input field "${field.name.name}" (String) has no validation in preconditions.`,
              suggestion: `Consider adding validation:\n` +
                `  pre input.${field.name.name}.length > 0\n` +
                `  pre input.${field.name.name}.length <= 255`,
            }));
          }
          
          if ((fieldType === 'Int' || fieldType === 'Decimal') && shouldValidateNumber(fieldName)) {
            diagnostics.push(report({
              node: field,
              elementName: `${behavior.name.name}.input.${field.name.name}`,
              message: `Input field "${field.name.name}" (${fieldType}) has no validation in preconditions.`,
              suggestion: `Consider adding validation:\n` +
                `  pre input.${field.name.name} > 0`,
            }));
          }
        }
      }
    }
    
    return diagnostics;
  },
};

function getTypeName(type: import('@isl-lang/parser').TypeDefinition): string {
  if (type.kind === 'PrimitiveType') return type.name;
  if (type.kind === 'ReferenceType') {
    return type.name.parts.map(p => p.name).join('.');
  }
  return type.kind;
}

function shouldValidateString(fieldName: string): boolean {
  const needsValidation = ['name', 'email', 'title', 'description', 'url', 'path'];
  return needsValidation.some(n => fieldName.includes(n));
}

function shouldValidateNumber(fieldName: string): boolean {
  const needsValidation = ['amount', 'price', 'quantity', 'count', 'size', 'limit'];
  return needsValidation.some(n => fieldName.includes(n));
}

function expressionReferencesField(expr: Expression, fieldName: string): boolean {
  if (expr.kind === 'Identifier') {
    return expr.name === fieldName;
  }
  if (expr.kind === 'MemberExpr') {
    const member = expr as MemberExpr;
    if (member.object.kind === 'InputExpr' || 
        (member.object.kind === 'Identifier' && (member.object as Identifier).name === 'input')) {
      return member.property.name === fieldName;
    }
    return expressionReferencesField(member.object, fieldName);
  }
  if (expr.kind === 'BinaryExpr') {
    const binary = expr as BinaryExpr;
    return expressionReferencesField(binary.left, fieldName) ||
           expressionReferencesField(binary.right, fieldName);
  }
  return false;
}

// ============================================================================
// All Rules Export
// ============================================================================

export const ALL_RULES: LintRule[] = [
  missingPostconditionsRule,
  ambiguousActorRule,
  securitySensitiveNoConstraintsRule,
  impossibleConstraintsRule,
  emptyErrorSpecRule,
  missingInputValidationRule,
];

export const RULES_BY_ID = new Map<string, LintRule>(
  ALL_RULES.map(rule => [rule.id, rule])
);

export const RULES_BY_NAME = new Map<string, LintRule>(
  ALL_RULES.map(rule => [rule.name, rule])
);
