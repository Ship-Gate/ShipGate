/**
 * Intent Coherence Validator
 * 
 * Validates that declared intents are semantically coherent:
 * - encryption-required: only valid if sensitive fields exist
 * - audit-required: requires an auditable action label in security spec
 * - rate-limit-required: requires endpoint classification (rate_limit in security)
 * 
 * @module @isl-lang/semantic-analysis
 */

import type {
  Behavior,
  Field,
  SecuritySpec,
  TypeDefinition,
  Annotation,
  Expression,
  Identifier,
  CallExpr,
  MemberExpr,
  PostconditionBlock,
  Constraint,
  SourceLocation,
} from '@isl-lang/parser';
import type { Diagnostic, CodeFix } from '@isl-lang/errors';
import type { SemanticPass, PassContext } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Intent declaration found in ISL behavior
 */
export interface IntentDeclaration {
  name: string;
  location: SourceLocation;
  behavior: string;
}

/**
 * Result of intent coherence validation
 */
export interface IntentCoherenceResult {
  valid: boolean;
  intent: IntentDeclaration;
  missingRequirements: string[];
  suggestions: string[];
}

/**
 * Sensitive field information extracted from behavior
 */
export interface SensitiveFieldInfo {
  fieldName: string;
  location: SourceLocation;
  sensitivityType: 'annotation' | 'constraint' | 'type_name';
}

/**
 * Security configuration extracted from behavior
 */
export interface SecurityConfig {
  hasAuditLog: boolean;
  hasRateLimit: boolean;
  rateLimitSpecs: RateLimitInfo[];
  authRequirements: string[];
}

/**
 * Rate limit specification
 */
export interface RateLimitInfo {
  limit: number;
  per: string;
  scope: string;
  location: SourceLocation;
}

// ============================================================================
// Intent Names (Constants)
// ============================================================================

export const INTENT_ENCRYPTION_REQUIRED = 'encryption-required';
export const INTENT_AUDIT_REQUIRED = 'audit-required';
export const INTENT_RATE_LIMIT_REQUIRED = 'rate-limit-required';

/**
 * All known intent names that require coherence validation
 */
export const COHERENCE_INTENTS = [
  INTENT_ENCRYPTION_REQUIRED,
  INTENT_AUDIT_REQUIRED,
  INTENT_RATE_LIMIT_REQUIRED,
] as const;

// ============================================================================
// Intent Schema Validator
// ============================================================================

/**
 * Validate intent coherence for a behavior
 */
export function validateIntentCoherence(
  behavior: Behavior,
  intents: IntentDeclaration[],
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const intent of intents) {
    const result = validateSingleIntent(behavior, intent);
    
    if (!result.valid) {
      diagnostics.push(createCoherenceDiagnostic(result, filePath));
    }
  }

  return diagnostics;
}

/**
 * Validate a single intent declaration against its requirements
 */
export function validateSingleIntent(
  behavior: Behavior,
  intent: IntentDeclaration
): IntentCoherenceResult {
  switch (intent.name) {
    case INTENT_ENCRYPTION_REQUIRED:
      return validateEncryptionRequired(behavior, intent);
    
    case INTENT_AUDIT_REQUIRED:
      return validateAuditRequired(behavior, intent);
    
    case INTENT_RATE_LIMIT_REQUIRED:
      return validateRateLimitRequired(behavior, intent);
    
    default:
      // Unknown intent - pass through (other validators may handle it)
      return {
        valid: true,
        intent,
        missingRequirements: [],
        suggestions: [],
      };
  }
}

// ============================================================================
// encryption-required Validation
// ============================================================================

/**
 * Validate encryption-required intent
 * 
 * Requirements:
 * - At least one field must be marked as sensitive via:
 *   - [sensitive] annotation
 *   - { sensitive: true } constraint
 *   - Type name containing 'Password', 'Secret', 'Token', etc.
 */
function validateEncryptionRequired(
  behavior: Behavior,
  intent: IntentDeclaration
): IntentCoherenceResult {
  const sensitiveFields = extractSensitiveFields(behavior);
  
  if (sensitiveFields.length === 0) {
    return {
      valid: false,
      intent,
      missingRequirements: [
        'No sensitive fields declared',
        'encryption-required requires at least one field with [sensitive] annotation or sensitive constraint',
      ],
      suggestions: [
        'Add [sensitive] annotation to fields containing PII or secrets',
        'Example: password: String [sensitive]',
        'Example: card_number: String { sensitive: true }',
        'Example: api_key: Secret (type name implies sensitivity)',
      ],
    };
  }

  return {
    valid: true,
    intent,
    missingRequirements: [],
    suggestions: [],
  };
}

/**
 * Extract all sensitive fields from a behavior's input and output
 */
export function extractSensitiveFields(behavior: Behavior): SensitiveFieldInfo[] {
  const sensitiveFields: SensitiveFieldInfo[] = [];
  const filePath = behavior.location?.file || '';

  // Check input fields
  if (behavior.input?.fields) {
    for (const field of behavior.input.fields) {
      const sensitivity = checkFieldSensitivity(field);
      if (sensitivity) {
        sensitiveFields.push({
          fieldName: getFieldName(field),
          location: field.location,
          sensitivityType: sensitivity,
        });
      }
    }
  }

  // Check output success type if it's a StructType with fields
  if (behavior.output?.success?.kind === 'StructType') {
    const structType = behavior.output.success;
    for (const field of (structType as { fields?: Field[] }).fields || []) {
      const sensitivity = checkFieldSensitivity(field);
      if (sensitivity) {
        sensitiveFields.push({
          fieldName: getFieldName(field),
          location: field.location,
          sensitivityType: sensitivity,
        });
      }
    }
  }

  return sensitiveFields;
}

/**
 * Get field name from Field
 */
function getFieldName(field: Field): string {
  if (typeof field.name === 'string') {
    return field.name;
  }
  if (field.name && 'name' in field.name) {
    return (field.name as Identifier).name;
  }
  return 'unknown';
}

/**
 * Check if a field is marked as sensitive
 */
function checkFieldSensitivity(field: Field): 'annotation' | 'constraint' | 'type_name' | null {
  // Check annotations: [sensitive]
  if (field.annotations?.some(ann => getAnnotationName(ann).toLowerCase() === 'sensitive')) {
    return 'annotation';
  }

  // Check type constraints: { sensitive: true }
  if (hasConstraint(field.type, 'sensitive', true)) {
    return 'constraint';
  }

  // Check type name for sensitive patterns
  const typeName = getTypeName(field.type);
  if (typeName && isSensitiveTypeName(typeName)) {
    return 'type_name';
  }

  return null;
}

/**
 * Get annotation name safely
 */
function getAnnotationName(ann: Annotation): string {
  if (typeof ann.name === 'string') {
    return ann.name;
  }
  if (ann.name && 'name' in ann.name) {
    return (ann.name as Identifier).name;
  }
  return '';
}

/**
 * Get constraint name safely
 */
function getConstraintName(c: Constraint): string {
  if (typeof c.name === 'string') {
    return c.name;
  }
  return '';
}

/**
 * Check if a type definition has a specific constraint
 */
function hasConstraint(typeDef: TypeDefinition, name: string, value?: unknown): boolean {
  if (!typeDef) return false;
  
  // ConstrainedType with constraints array
  if (typeDef.kind === 'ConstrainedType' && 'constraints' in typeDef) {
    const constraints = (typeDef as { constraints: Constraint[] }).constraints;
    return constraints.some(c => {
      const constraintName = getConstraintName(c);
      if (constraintName.toLowerCase() !== name.toLowerCase()) return false;
      if (value === undefined) return true;
      
      // Check value match
      if (c.value && 'kind' in c.value) {
        const expr = c.value as Expression;
        if (expr.kind === 'BooleanLiteral' && 'value' in expr) {
          return (expr as { value: boolean }).value === value;
        }
      }
      return false;
    });
  }
  return false;
}

/**
 * Get the base type name from a type definition
 */
function getTypeName(typeDef: TypeDefinition): string | null {
  if (!typeDef) return null;
  
  switch (typeDef.kind) {
    case 'PrimitiveType':
      return typeDef.name;
    case 'ReferenceType':
      return typeDef.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return getTypeName(typeDef.base);
    case 'OptionalType':
      return getTypeName(typeDef.inner);
    default:
      return null;
  }
}

/**
 * Sensitive type name patterns
 */
const SENSITIVE_TYPE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /credential/i,
  /ssn/i,
  /social.*security/i,
  /credit.*card/i,
  /card.*number/i,
  /private.*key/i,
  /encryption.*key/i,
];

function isSensitiveTypeName(name: string): boolean {
  return SENSITIVE_TYPE_PATTERNS.some(pattern => pattern.test(name));
}

// ============================================================================
// audit-required Validation
// ============================================================================

/**
 * Validate audit-required intent
 * 
 * Requirements:
 * - Must have 'audit_log required' in security spec, OR
 * - Must have an auditable action label (postcondition with AuditRecord)
 */
function validateAuditRequired(
  behavior: Behavior,
  intent: IntentDeclaration
): IntentCoherenceResult {
  const securityConfig = extractSecurityConfig(behavior);
  
  // Check for explicit audit_log requirement
  if (securityConfig.hasAuditLog) {
    return {
      valid: true,
      intent,
      missingRequirements: [],
      suggestions: [],
    };
  }

  // Check for AuditRecord in postconditions
  const hasAuditableAction = checkForAuditableAction(behavior);
  if (hasAuditableAction) {
    return {
      valid: true,
      intent,
      missingRequirements: [],
      suggestions: [],
    };
  }

  return {
    valid: false,
    intent,
    missingRequirements: [
      'No audit configuration declared',
      'audit-required needs audit_log requirement or AuditRecord in postconditions',
    ],
    suggestions: [
      'Add to security block: audit_log required',
      'Or add AuditRecord(...) to postconditions with action label',
      'Example security block:',
      '  security {',
      '    audit_log required',
      '  }',
      'Example postcondition:',
      '  post success {',
      '    AuditRecord(action: "user.login", category: AUTH_EVENT, outcome: SUCCESS)',
      '  }',
    ],
  };
}

/**
 * Check if behavior has an auditable action (AuditRecord in postconditions)
 */
function checkForAuditableAction(behavior: Behavior): boolean {
  if (!behavior.postconditions || behavior.postconditions.length === 0) return false;
  
  for (const block of behavior.postconditions) {
    for (const predicate of block.predicates || []) {
      if (expressionContainsAuditRecord(predicate)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if an expression contains AuditRecord call
 */
function expressionContainsAuditRecord(expr: Expression): boolean {
  if (!expr) return false;
  
  if (expr.kind === 'CallExpr') {
    const call = expr as CallExpr;
    const calleeName = getExpressionName(call.callee);
    if (calleeName === 'AuditRecord' || calleeName === 'audit_log') {
      return true;
    }
    // Check arguments recursively
    return (call.arguments || []).some(arg => expressionContainsAuditRecord(arg));
  }
  
  if (expr.kind === 'MemberExpr') {
    const member = expr as MemberExpr;
    return expressionContainsAuditRecord(member.object);
  }

  return false;
}

/**
 * Get the name from an expression (for identifier/qualified name)
 */
function getExpressionName(expr: Expression): string | null {
  if (!expr) return null;
  
  if (expr.kind === 'Identifier') {
    return (expr as Identifier).name;
  }
  return null;
}

// ============================================================================
// rate-limit-required Validation
// ============================================================================

/**
 * Validate rate-limit-required intent
 * 
 * Requirements:
 * - Must have at least one rate_limit in security spec (endpoint classification)
 */
function validateRateLimitRequired(
  behavior: Behavior,
  intent: IntentDeclaration
): IntentCoherenceResult {
  const securityConfig = extractSecurityConfig(behavior);
  
  if (securityConfig.hasRateLimit && securityConfig.rateLimitSpecs.length > 0) {
    return {
      valid: true,
      intent,
      missingRequirements: [],
      suggestions: [],
    };
  }

  return {
    valid: false,
    intent,
    missingRequirements: [
      'No rate limit configuration declared',
      'rate-limit-required needs at least one rate_limit in security spec',
    ],
    suggestions: [
      'Add rate_limit to security block to classify endpoint protection',
      'Example configurations:',
      '  security {',
      '    rate_limit 10 per hour per email        // Per-user limit',
      '    rate_limit 100 per hour per ip_address  // Per-IP limit',
      '  }',
      'Common patterns:',
      '  - Login endpoints: 5 per 15 minutes per email',
      '  - API endpoints: 1000 per hour per api_key',
      '  - Public endpoints: 100 per minute per ip_address',
    ],
  };
}

// ============================================================================
// Security Configuration Extraction
// ============================================================================

/**
 * Extract security configuration from behavior
 */
export function extractSecurityConfig(behavior: Behavior): SecurityConfig {
  const config: SecurityConfig = {
    hasAuditLog: false,
    hasRateLimit: false,
    rateLimitSpecs: [],
    authRequirements: [],
  };

  if (!behavior.security || behavior.security.length === 0) {
    return config;
  }

  for (const spec of behavior.security) {
    // Check for audit_log
    if (isAuditLogSpec(spec)) {
      config.hasAuditLog = true;
    }

    // Check for rate_limit
    if (spec.type === 'rate_limit') {
      config.hasRateLimit = true;
      const rateLimitInfo = parseRateLimitSpec(spec, behavior.location?.file || '');
      if (rateLimitInfo) {
        config.rateLimitSpecs.push(rateLimitInfo);
      }
    }

    // Check for requires (auth)
    if (spec.type === 'requires') {
      const authReq = extractAuthRequirement(spec);
      if (authReq) {
        config.authRequirements.push(authReq);
      }
    }
  }

  return config;
}

/**
 * Check if a security spec is an audit_log requirement
 */
function isAuditLogSpec(spec: SecuritySpec): boolean {
  // Check if the expression mentions audit_log
  const exprStr = stringifyExpression(spec.details);
  return /audit.?log/i.test(exprStr) && /required/i.test(exprStr);
}

/**
 * Parse rate_limit specification
 */
function parseRateLimitSpec(spec: SecuritySpec, filePath: string): RateLimitInfo | null {
  // The details expression contains the rate limit configuration
  // Format: rate_limit N per DURATION per SCOPE
  const exprStr = stringifyExpression(spec.details);
  
  // Parse: "10 per hour per email" or similar
  const match = exprStr.match(/(\d+)\s*per\s*(\w+)\s*per\s*(\w+)/i);
  if (match) {
    return {
      limit: parseInt(match[1], 10),
      per: match[2],
      scope: match[3],
      location: spec.location,
    };
  }

  return null;
}

/**
 * Extract authentication requirement from security spec
 */
function extractAuthRequirement(spec: SecuritySpec): string | null {
  const exprStr = stringifyExpression(spec.details);
  return exprStr || null;
}

/**
 * Convert expression to string for pattern matching
 */
function stringifyExpression(expr: Expression): string {
  if (!expr) return '';
  
  switch (expr.kind) {
    case 'Identifier':
      return (expr as Identifier).name;
    
    case 'StringLiteral':
      return (expr as { value: string }).value;
    
    case 'NumberLiteral':
      return String((expr as { value: number }).value);
    
    case 'BooleanLiteral':
      return String((expr as { value: boolean }).value);
    
    case 'MemberExpr':
      const member = expr as MemberExpr;
      const propName = typeof member.property === 'string' 
        ? member.property 
        : (member.property as Identifier).name;
      return `${stringifyExpression(member.object)}.${propName}`;
    
    case 'CallExpr':
      const call = expr as CallExpr;
      const callee = stringifyExpression(call.callee);
      const args = (call.arguments || []).map(a => stringifyExpression(a)).join(', ');
      return `${callee}(${args})`;
    
    case 'BinaryExpr':
      const binary = expr as { left: Expression; operator: string; right: Expression };
      return `${stringifyExpression(binary.left)} ${binary.operator} ${stringifyExpression(binary.right)}`;
    
    default:
      return '';
  }
}

// ============================================================================
// Diagnostic Creation
// ============================================================================

/**
 * Create a diagnostic from intent coherence validation result
 */
function createCoherenceDiagnostic(
  result: IntentCoherenceResult,
  filePath: string
): Diagnostic {
  const { intent, missingRequirements, suggestions } = result;
  
  // Build detailed message
  const messageLines = [
    `Intent '${intent.name}' is not coherent for behavior '${intent.behavior}'`,
    '',
    'Missing requirements:',
    ...missingRequirements.map(r => `  • ${r}`),
  ];

  // Create code fix suggestion
  const fix: CodeFix | undefined = suggestions.length > 0 ? {
    title: `Add required metadata for ${intent.name}`,
    edits: [], // Actual edits would require AST manipulation
  } : undefined;

  return {
    code: getErrorCodeForIntent(intent.name),
    category: 'semantic',
    severity: 'error',
    message: messageLines.join('\n'),
    location: intent.location,
    source: 'verifier' as const,
    notes: suggestions,
    fix,
  };
}

/**
 * Get error code for intent validation failure
 */
function getErrorCodeForIntent(intentName: string): string {
  switch (intentName) {
    case INTENT_ENCRYPTION_REQUIRED:
      return 'ISL1001';
    case INTENT_AUDIT_REQUIRED:
      return 'ISL1002';
    case INTENT_RATE_LIMIT_REQUIRED:
      return 'ISL1003';
    default:
      return 'ISL1000';
  }
}

// ============================================================================
// Intent Extraction from Comments/Annotations
// ============================================================================

/**
 * Extract intent declarations from behavior comments or annotations
 * 
 * Looks for patterns like:
 * - @intent encryption-required
 * - @intent audit-required
 * - @intent rate-limit-required
 */
export function extractIntentDeclarations(
  behavior: Behavior,
  sourceContent: string
): IntentDeclaration[] {
  const intents: IntentDeclaration[] = [];
  const filePath = behavior.location?.file || '';
  
  // Get the source lines around the behavior declaration
  const behaviorLine = behavior.location?.line || 1;
  const lines = sourceContent.split('\n');
  
  // Look for @intent annotations in comments before the behavior
  for (let i = Math.max(0, behaviorLine - 10); i < behaviorLine; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Match @intent patterns
    const intentMatches = line.matchAll(/@intent\s+([\w-]+)/gi);
    for (const match of intentMatches) {
      const intentName = match[1].toLowerCase();
      if (COHERENCE_INTENTS.includes(intentName as typeof COHERENCE_INTENTS[number])) {
        intents.push({
          name: intentName,
          location: {
            file: filePath,
            line: i + 1,
            column: match.index || 0,
            endLine: i + 1,
            endColumn: (match.index || 0) + match[0].length,
          },
          behavior: behavior.name.name,
        });
      }
    }
  }

  return intents;
}

// ============================================================================
// Semantic Pass Definition
// ============================================================================

/**
 * Intent Coherence semantic analysis pass
 */
export const IntentCoherencePass: SemanticPass = {
  id: 'intent-coherence',
  name: 'Intent Coherence Validator',
  description: 'Validates that declared intents have coherent metadata (sensitive fields, audit config, rate limits)',
  dependencies: [],
  priority: 70,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath, sourceContent } = ctx;
    
    for (const behavior of ast.behaviors || []) {
      // Extract @intent annotations from source
      const intents = extractIntentDeclarations(behavior as unknown as Behavior, sourceContent);
      
      // Validate each intent
      for (const intent of intents) {
        const result = validateSingleIntent(behavior as unknown as Behavior, intent);
        if (!result.valid) {
          diagnostics.push(createCoherenceDiagnostic(result, filePath));
        }
      }
      
      // Also check for implicit intents based on security requirements
      const securityConfig = extractSecurityConfig(behavior as unknown as Behavior);
      
      // If behavior has auth requirements, it implicitly requires audit
      if (securityConfig.authRequirements.length > 0) {
        if (!securityConfig.hasAuditLog && !checkForAuditableAction(behavior as unknown as Behavior)) {
          const behaviorName = behavior.name.name;
          const span = (behavior as { span?: { file?: string; start?: { line?: number; column?: number }; end?: { line?: number; column?: number } } }).span;
          const location = span
            ? {
                file: span.file || filePath,
                line: span.start?.line ?? 1,
                column: span.start?.column ?? 0,
                endLine: span.end?.line ?? 1,
                endColumn: span.end?.column ?? 0,
              }
            : { file: filePath, line: 1, column: 0, endLine: 1, endColumn: 0 };
          
          diagnostics.push({
            code: 'ISL1002',
            category: 'semantic',
            severity: 'warning',
            message: `Behavior '${behaviorName}' has auth requirements but no audit configuration`,
            location,
            source: 'verifier' as const,
            notes: [
              'Authentication endpoints should have audit logging enabled',
              'Add "audit_log required" to the security block',
            ],
          });
        }
      }
    }

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const intentCoherencePass = IntentCoherencePass;

/**
 * Create intent coherence pass with custom source content
 * (For when PassContext.sourceContent might not be available)
 */
export function createIntentCoherencePass(sourceContent: string): SemanticPass {
  return {
    ...IntentCoherencePass,
    run(ctx: PassContext): Diagnostic[] {
      // Use provided source content if ctx.sourceContent is empty
      const content = ctx.sourceContent || sourceContent;
      return IntentCoherencePass.run({ ...ctx, sourceContent: content });
    },
  };
}
