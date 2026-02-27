/**
 * Security Analyzer
 * 
 * Checks for security issues and vulnerabilities in specs.
 */

import type { DomainDeclaration, BehaviorDeclaration, FieldDeclaration } from '@isl-lang/isl-core';

export interface SecurityIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: { line: number; column: number };
  fix?: string;
  cwe?: string;  // Common Weakness Enumeration
}

export interface SecurityResult {
  score: number;
  issues: SecurityIssue[];
  suggestions: string[];
}

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  { pattern: /password/i, type: 'password' },
  { pattern: /secret/i, type: 'secret' },
  { pattern: /token/i, type: 'token' },
  { pattern: /api[_-]?key/i, type: 'api_key' },
  { pattern: /private[_-]?key/i, type: 'private_key' },
  { pattern: /credit[_-]?card/i, type: 'credit_card' },
  { pattern: /ssn|social[_-]?security/i, type: 'ssn' },
  { pattern: /auth/i, type: 'auth' },
];

// PII patterns
const PII_PATTERNS = [
  { pattern: /email/i, type: 'email' },
  { pattern: /phone/i, type: 'phone' },
  { pattern: /address/i, type: 'address' },
  { pattern: /name/i, type: 'name' },
  { pattern: /birth[_-]?date|dob/i, type: 'birthdate' },
  { pattern: /ip[_-]?address/i, type: 'ip_address' },
];

/**
 * Analyze domain for security issues
 */
export function analyzeSecurity(domain: DomainDeclaration): SecurityResult {
  const issues: SecurityIssue[] = [];
  const suggestions: string[] = [];

  // Check for missing security blocks in behaviors
  issues.push(...checkMissingSecurityBlocks(domain));

  // Check for sensitive data handling
  issues.push(...checkSensitiveDataHandling(domain));

  // Check for PII without proper annotations
  issues.push(...checkPIIAnnotations(domain));

  // Check for missing rate limiting
  issues.push(...checkRateLimiting(domain));

  // Check for missing authentication/authorization
  issues.push(...checkAuthRequirements(domain));

  // Check for SQL injection vulnerabilities
  issues.push(...checkInjectionVulnerabilities(domain));

  // Check for missing input validation
  issues.push(...checkInputValidation(domain));

  // Check for insecure defaults
  issues.push(...checkInsecureDefaults(domain));

  // Generate suggestions
  if (issues.some(i => i.severity === 'critical')) {
    suggestions.push('Address critical security issues before deployment.');
  }

  if (!domain.behaviors.some(b => b.security)) {
    suggestions.push('Consider adding security blocks to behaviors that handle sensitive operations.');
  }

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const maxScore = 100;
  const deductions = criticalCount * 30 + warningCount * 15 + infoCount * 5;
  const score = Math.max(0, maxScore - deductions);

  return { score, issues, suggestions };
}

/**
 * Check for missing security blocks
 */
function checkMissingSecurityBlocks(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const behavior of domain.behaviors) {
    // State-changing behaviors should have security blocks
    if (isSecuritySensitiveBehavior(behavior) && !behavior.security) {
      issues.push({
        id: `security-no-security-block-${behavior.name.name}`,
        severity: 'warning',
        title: `Behavior "${behavior.name.name}" lacks security block`,
        description: 'Security-sensitive behaviors should define authentication, authorization, or rate limiting.',
        location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
        fix: 'Add a security block with appropriate requirements.',
        cwe: 'CWE-862',  // Missing Authorization
      });
    }
  }

  return issues;
}

/**
 * Check for sensitive data handling
 */
function checkSensitiveDataHandling(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const fieldName = field.name.name;
      
      for (const { pattern, type } of SENSITIVE_PATTERNS) {
        if (pattern.test(fieldName)) {
          // Check if field has [secret] annotation
          const hasSecretAnnotation = field.annotations?.some(
            a => a.name.name.toLowerCase() === 'secret'
          );

          if (!hasSecretAnnotation) {
            issues.push({
              id: `security-sensitive-no-annotation-${entity.name.name}-${fieldName}`,
              severity: 'critical',
              title: `Sensitive field "${fieldName}" not marked as [secret]`,
              description: `Field "${fieldName}" in entity "${entity.name.name}" appears to contain ${type} data but is not annotated as [secret].`,
              location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
              fix: `Add [secret] annotation to field "${fieldName}".`,
              cwe: 'CWE-312',  // Cleartext Storage of Sensitive Information
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Check for PII without proper annotations
 */
function checkPIIAnnotations(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const fieldName = field.name.name;
      
      for (const { pattern, type } of PII_PATTERNS) {
        if (pattern.test(fieldName)) {
          const hasPIIAnnotation = field.annotations?.some(
            a => a.name.name.toLowerCase() === 'pii'
          );

          if (!hasPIIAnnotation) {
            issues.push({
              id: `security-pii-no-annotation-${entity.name.name}-${fieldName}`,
              severity: 'warning',
              title: `PII field "${fieldName}" not marked as [pii]`,
              description: `Field "${fieldName}" appears to contain ${type} (PII) but is not annotated. This may impact GDPR/CCPA compliance.`,
              location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
              fix: `Add [pii] annotation to field "${fieldName}".`,
              cwe: 'CWE-359',  // Privacy Violation
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Check for missing rate limiting
 */
function checkRateLimiting(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const behavior of domain.behaviors) {
    // Public-facing behaviors should have rate limiting
    if (isPublicFacingBehavior(behavior)) {
      const hasRateLimit = behavior.security?.requirements?.some(
        r => r.type?.toLowerCase().includes('rate')
      );

      if (!hasRateLimit) {
        issues.push({
          id: `security-no-rate-limit-${behavior.name.name}`,
          severity: 'info',
          title: `Behavior "${behavior.name.name}" has no rate limiting`,
          description: 'Public-facing behaviors should have rate limiting to prevent abuse.',
          location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
          fix: 'Add rate_limit requirement to security block.',
          cwe: 'CWE-770',  // Allocation of Resources Without Limits
        });
      }
    }
  }

  return issues;
}

/**
 * Check for missing authentication/authorization
 */
function checkAuthRequirements(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const behavior of domain.behaviors) {
    // Behaviors that modify state should require auth
    if (isStateModifyingBehavior(behavior)) {
      const hasAuth = behavior.security?.requirements?.some(
        r => r.type?.toLowerCase().includes('requires') ||
             r.type?.toLowerCase().includes('permission') ||
             r.type?.toLowerCase().includes('auth')
      ) || behavior.actors;

      if (!hasAuth) {
        issues.push({
          id: `security-no-auth-${behavior.name.name}`,
          severity: 'warning',
          title: `State-modifying behavior "${behavior.name.name}" has no auth requirements`,
          description: 'Behaviors that modify state should require authentication or authorization.',
          location: behavior.span ? { line: behavior.span.start.line, column: behavior.span.start.column } : undefined,
          fix: 'Add actors block or security requirements.',
          cwe: 'CWE-306',  // Missing Authentication
        });
      }
    }
  }

  return issues;
}

/**
 * Check for potential injection vulnerabilities
 */
function checkInjectionVulnerabilities(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.input?.fields) {
      for (const field of behavior.input.fields) {
        const fieldName = field.name.name.toLowerCase();
        
        // Check for string inputs that might be used in queries
        if (isStringType(field.type) && 
            (fieldName.includes('query') || 
             fieldName.includes('filter') ||
             fieldName.includes('where') ||
             fieldName.includes('expression'))) {
          
          // Check for validation constraints
          const hasValidation = field.constraints && field.constraints.length > 0;

          if (!hasValidation) {
            issues.push({
              id: `security-potential-injection-${behavior.name.name}-${field.name.name}`,
              severity: 'warning',
              title: `Potential injection vulnerability in "${field.name.name}"`,
              description: `Input field "${field.name.name}" in "${behavior.name.name}" accepts string input without validation. Ensure proper sanitization if used in queries.`,
              location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
              fix: 'Add validation constraints or use parameterized queries.',
              cwe: 'CWE-89',  // SQL Injection
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Check for missing input validation
 */
function checkInputValidation(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.input?.fields) {
      for (const field of behavior.input.fields) {
        // String fields should have length constraints
        if (isStringType(field.type) && !hasLengthConstraint(field)) {
          issues.push({
            id: `security-unbounded-string-${behavior.name.name}-${field.name.name}`,
            severity: 'info',
            title: `Unbounded string input "${field.name.name}"`,
            description: 'String inputs without length constraints could lead to resource exhaustion.',
            location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
            fix: 'Add max_length constraint to the field.',
            cwe: 'CWE-400',  // Resource Exhaustion
          });
        }

        // Numeric fields in certain contexts should have bounds
        if (isNumericType(field.type) && isResourceAllocationField(field.name.name) && !hasBoundsConstraint(field)) {
          issues.push({
            id: `security-unbounded-number-${behavior.name.name}-${field.name.name}`,
            severity: 'info',
            title: `Unbounded numeric input "${field.name.name}"`,
            description: 'Numeric inputs for resource allocation should have bounds.',
            location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
            fix: 'Add min/max constraints to the field.',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check for insecure defaults
 */
function checkInsecureDefaults(domain: DomainDeclaration): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const fieldName = field.name.name.toLowerCase();
      
      // Check for boolean security flags defaulting to insecure values
      if (isBooleanType(field.type) && isSecurityBooleanField(fieldName)) {
        const defaultValue = field.defaultValue;
        
        if (defaultValue && isInsecureDefault(fieldName, defaultValue)) {
          issues.push({
            id: `security-insecure-default-${entity.name.name}-${field.name.name}`,
            severity: 'warning',
            title: `Insecure default for "${field.name.name}"`,
            description: `Field "${field.name.name}" has a potentially insecure default value. Security features should be enabled by default.`,
            location: field.span ? { line: field.span.start.line, column: field.span.start.column } : undefined,
            fix: 'Review and change the default value to a secure setting.',
            cwe: 'CWE-1188',  // Insecure Default Initialization
          });
        }
      }
    }
  }

  return issues;
}

// Helper functions

function isSecuritySensitiveBehavior(behavior: BehaviorDeclaration): boolean {
  const name = behavior.name.name.toLowerCase();
  return (
    name.includes('create') ||
    name.includes('update') ||
    name.includes('delete') ||
    name.includes('transfer') ||
    name.includes('payment') ||
    name.includes('auth') ||
    name.includes('admin')
  );
}

function isPublicFacingBehavior(behavior: BehaviorDeclaration): boolean {
  // Assume behaviors without actors restriction are public
  return !behavior.actors;
}

function isStateModifyingBehavior(behavior: BehaviorDeclaration): boolean {
  const name = behavior.name.name.toLowerCase();
  return (
    name.startsWith('create') ||
    name.startsWith('update') ||
    name.startsWith('delete') ||
    name.startsWith('add') ||
    name.startsWith('remove') ||
    name.startsWith('set') ||
    name.startsWith('transfer') ||
    name.startsWith('process')
  );
}

function isStringType(type: unknown): boolean {
  if (!type || typeof type !== 'object') return false;
  const typeObj = type as { kind?: string; name?: { name?: string } };
  return typeObj.kind === 'SimpleType' && typeObj.name?.name === 'String';
}

function isNumericType(type: unknown): boolean {
  if (!type || typeof type !== 'object') return false;
  const typeObj = type as { kind?: string; name?: { name?: string } };
  return typeObj.kind === 'SimpleType' && 
    ['Int', 'Decimal', 'Float', 'Number'].includes(typeObj.name?.name ?? '');
}

function isBooleanType(type: unknown): boolean {
  if (!type || typeof type !== 'object') return false;
  const typeObj = type as { kind?: string; name?: { name?: string } };
  return typeObj.kind === 'SimpleType' && typeObj.name?.name === 'Boolean';
}

function hasLengthConstraint(field: FieldDeclaration): boolean {
  return field.constraints?.some(c => 
    c.name.name === 'max_length' || c.name.name === 'maxLength'
  ) ?? false;
}

function hasBoundsConstraint(field: FieldDeclaration): boolean {
  return field.constraints?.some(c => 
    c.name.name === 'min' || c.name.name === 'max'
  ) ?? false;
}

function isResourceAllocationField(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('count') ||
    lower.includes('limit') ||
    lower.includes('size') ||
    lower.includes('max') ||
    lower.includes('batch')
  );
}

function isSecurityBooleanField(name: string): boolean {
  return (
    name.includes('enabled') ||
    name.includes('verified') ||
    name.includes('active') ||
    name.includes('secure') ||
    name.includes('encrypted') ||
    name.includes('auth')
  );
}

function isInsecureDefault(fieldName: string, defaultValue: unknown): boolean {
  // Security-related fields should default to true/enabled
  if (fieldName.includes('enabled') || fieldName.includes('active')) {
    return defaultValue === false;
  }
  // Verification fields should default to false
  if (fieldName.includes('verified')) {
    return defaultValue === true; // Should start unverified
  }
  return false;
}
