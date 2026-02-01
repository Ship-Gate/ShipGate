/**
 * Naming Convention Analyzer
 * 
 * Checks for consistent naming conventions throughout the spec.
 */

import type { DomainDeclaration } from '@intentos/isl-core';

export interface NamingIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location?: { line: number; column: number };
  fix?: string;
  suggestedName?: string;
}

export interface NamingResult {
  score: number;
  issues: NamingIssue[];
  suggestions: string[];
}

// Naming patterns
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Analyze domain for naming convention issues
 */
export function analyzeNaming(domain: DomainDeclaration): NamingResult {
  const issues: NamingIssue[] = [];
  const suggestions: string[] = [];

  // Check domain name
  issues.push(...checkDomainNaming(domain));

  // Check entity naming
  issues.push(...checkEntityNaming(domain));

  // Check behavior naming
  issues.push(...checkBehaviorNaming(domain));

  // Check type naming
  issues.push(...checkTypeNaming(domain));

  // Check field naming
  issues.push(...checkFieldNaming(domain));

  // Check error naming
  issues.push(...checkErrorNaming(domain));

  // Check enum naming
  issues.push(...checkEnumNaming(domain));

  // Generate suggestions
  const conventionSummary = analyzeConventionUsage(domain);
  if (conventionSummary.mixed) {
    suggestions.push('Naming conventions are mixed. Consider standardizing on one convention.');
  }

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const maxScore = 100;
  const deductions = criticalCount * 15 + warningCount * 8 + infoCount * 2;
  const score = Math.max(0, maxScore - deductions);

  return { score, issues, suggestions };
}

/**
 * Check domain name
 */
function checkDomainNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];
  const name = domain.name.name;

  if (!PASCAL_CASE.test(name)) {
    issues.push({
      id: `naming-domain-case-${name}`,
      severity: 'warning',
      title: `Domain name "${name}" should be PascalCase`,
      description: 'Domain names should use PascalCase convention.',
      location: domain.name.span ? { line: domain.name.span.line, column: domain.name.span.column } : undefined,
      suggestedName: toPascalCase(name),
    });
  }

  // Check for overly generic names
  const genericNames = ['Domain', 'App', 'Application', 'System', 'Service'];
  if (genericNames.includes(name)) {
    issues.push({
      id: `naming-domain-generic-${name}`,
      severity: 'info',
      title: `Domain name "${name}" is too generic`,
      description: 'Consider using a more specific domain name that describes the business context.',
      location: domain.name.span ? { line: domain.name.span.line, column: domain.name.span.column } : undefined,
    });
  }

  return issues;
}

/**
 * Check entity naming
 */
function checkEntityNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const entity of domain.entities) {
    const name = entity.name.name;

    // Entities should be PascalCase
    if (!PASCAL_CASE.test(name)) {
      issues.push({
        id: `naming-entity-case-${name}`,
        severity: 'warning',
        title: `Entity name "${name}" should be PascalCase`,
        description: 'Entity names should use PascalCase convention.',
        location: entity.name.span ? { line: entity.name.span.line, column: entity.name.span.column } : undefined,
        suggestedName: toPascalCase(name),
      });
    }

    // Entities should be singular nouns
    if (isPluralNoun(name)) {
      issues.push({
        id: `naming-entity-plural-${name}`,
        severity: 'info',
        title: `Entity name "${name}" appears to be plural`,
        description: 'Entity names should typically be singular nouns (e.g., "User" not "Users").',
        location: entity.name.span ? { line: entity.name.span.line, column: entity.name.span.column } : undefined,
        suggestedName: toSingular(name),
      });
    }

    // Check for entity name ending with common suffixes that indicate anti-patterns
    if (name.endsWith('Manager') || name.endsWith('Handler') || name.endsWith('Processor')) {
      issues.push({
        id: `naming-entity-suffix-${name}`,
        severity: 'info',
        title: `Entity name "${name}" has procedural suffix`,
        description: 'Entity names should represent domain concepts, not process roles.',
        location: entity.name.span ? { line: entity.name.span.line, column: entity.name.span.column } : undefined,
      });
    }
  }

  return issues;
}

/**
 * Check behavior naming
 */
function checkBehaviorNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const behavior of domain.behaviors) {
    const name = behavior.name.name;

    // Behaviors should be PascalCase
    if (!PASCAL_CASE.test(name)) {
      issues.push({
        id: `naming-behavior-case-${name}`,
        severity: 'warning',
        title: `Behavior name "${name}" should be PascalCase`,
        description: 'Behavior names should use PascalCase convention.',
        location: behavior.name.span ? { line: behavior.name.span.line, column: behavior.name.span.column } : undefined,
        suggestedName: toPascalCase(name),
      });
    }

    // Behaviors should start with verbs
    if (!startsWithVerb(name)) {
      issues.push({
        id: `naming-behavior-verb-${name}`,
        severity: 'info',
        title: `Behavior name "${name}" should start with a verb`,
        description: 'Behavior names should describe actions (e.g., "CreateUser", "ProcessPayment").',
        location: behavior.name.span ? { line: behavior.name.span.line, column: behavior.name.span.column } : undefined,
      });
    }

    // Check for vague behavior names
    const vagueNames = ['Do', 'Run', 'Execute', 'Process', 'Handle'];
    if (vagueNames.some(v => name === v || name === v + 'Something')) {
      issues.push({
        id: `naming-behavior-vague-${name}`,
        severity: 'warning',
        title: `Behavior name "${name}" is too vague`,
        description: 'Use specific action names that describe what the behavior does.',
        location: behavior.name.span ? { line: behavior.name.span.line, column: behavior.name.span.column } : undefined,
      });
    }
  }

  return issues;
}

/**
 * Check type naming
 */
function checkTypeNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const type of domain.types) {
    const name = type.name.name;

    // Types should be PascalCase
    if (!PASCAL_CASE.test(name)) {
      issues.push({
        id: `naming-type-case-${name}`,
        severity: 'warning',
        title: `Type name "${name}" should be PascalCase`,
        description: 'Type names should use PascalCase convention.',
        location: type.name.span ? { line: type.name.span.line, column: type.name.span.column } : undefined,
        suggestedName: toPascalCase(name),
      });
    }

    // Check for Hungarian notation
    if (/^(str|int|bool|obj)[A-Z]/.test(name)) {
      issues.push({
        id: `naming-type-hungarian-${name}`,
        severity: 'info',
        title: `Type name "${name}" uses Hungarian notation`,
        description: 'Avoid Hungarian notation prefixes in type names.',
        location: type.name.span ? { line: type.name.span.line, column: type.name.span.column } : undefined,
      });
    }
  }

  return issues;
}

/**
 * Check field naming
 */
function checkFieldNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const name = field.name.name;

      // Fields should be camelCase or snake_case (check consistency)
      if (!CAMEL_CASE.test(name) && !SNAKE_CASE.test(name)) {
        issues.push({
          id: `naming-field-case-${entity.name.name}-${name}`,
          severity: 'warning',
          title: `Field name "${name}" in "${entity.name.name}" has inconsistent casing`,
          description: 'Field names should use camelCase or snake_case consistently.',
          location: field.name.span ? { line: field.name.span.line, column: field.name.span.column } : undefined,
          suggestedName: toCamelCase(name),
        });
      }

      // Boolean fields should be named as questions or have is/has prefix
      if (isBooleanField(field) && !isGoodBooleanName(name)) {
        issues.push({
          id: `naming-field-boolean-${entity.name.name}-${name}`,
          severity: 'info',
          title: `Boolean field "${name}" could have a clearer name`,
          description: 'Boolean fields should read as yes/no questions (e.g., "isActive", "hasAccess").',
          location: field.name.span ? { line: field.name.span.line, column: field.name.span.column } : undefined,
          suggestedName: `is${toPascalCase(name)}`,
        });
      }

      // Check for abbreviations
      if (hasAbbreviation(name)) {
        issues.push({
          id: `naming-field-abbrev-${entity.name.name}-${name}`,
          severity: 'info',
          title: `Field name "${name}" contains abbreviation`,
          description: 'Consider using full words for clarity (e.g., "quantity" instead of "qty").',
          location: field.name.span ? { line: field.name.span.line, column: field.name.span.column } : undefined,
        });
      }
    }
  }

  return issues;
}

/**
 * Check error naming
 */
function checkErrorNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.output?.errors) {
      for (const error of behavior.output.errors) {
        const name = error.name.name;

        // Errors should be SCREAMING_SNAKE_CASE
        if (!SCREAMING_SNAKE_CASE.test(name)) {
          issues.push({
            id: `naming-error-case-${behavior.name.name}-${name}`,
            severity: 'info',
            title: `Error code "${name}" should be SCREAMING_SNAKE_CASE`,
            description: 'Error codes should use SCREAMING_SNAKE_CASE convention.',
            location: error.name.span ? { line: error.name.span.line, column: error.name.span.column } : undefined,
            suggestedName: toScreamingSnakeCase(name),
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check enum naming
 */
function checkEnumNaming(domain: DomainDeclaration): NamingIssue[] {
  const issues: NamingIssue[] = [];

  for (const enumDecl of domain.enums) {
    const name = enumDecl.name.name;

    // Enum types should be PascalCase
    if (!PASCAL_CASE.test(name)) {
      issues.push({
        id: `naming-enum-case-${name}`,
        severity: 'warning',
        title: `Enum name "${name}" should be PascalCase`,
        description: 'Enum type names should use PascalCase convention.',
        location: enumDecl.name.span ? { line: enumDecl.name.span.line, column: enumDecl.name.span.column } : undefined,
        suggestedName: toPascalCase(name),
      });
    }

    // Enum variants should be SCREAMING_SNAKE_CASE or PascalCase
    for (const variant of enumDecl.variants) {
      const variantName = variant.name;
      if (!SCREAMING_SNAKE_CASE.test(variantName) && !PASCAL_CASE.test(variantName)) {
        issues.push({
          id: `naming-enum-variant-${name}-${variantName}`,
          severity: 'info',
          title: `Enum variant "${variantName}" has inconsistent casing`,
          description: 'Enum variants should use SCREAMING_SNAKE_CASE or PascalCase.',
          location: enumDecl.span ? { line: enumDecl.span.line, column: enumDecl.span.column } : undefined,
        });
      }
    }
  }

  return issues;
}

/**
 * Analyze convention usage across the domain
 */
function analyzeConventionUsage(domain: DomainDeclaration): { mixed: boolean } {
  let camelCount = 0;
  let snakeCount = 0;

  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      if (CAMEL_CASE.test(field.name.name)) camelCount++;
      if (SNAKE_CASE.test(field.name.name) && field.name.name.includes('_')) snakeCount++;
    }
  }

  return { mixed: camelCount > 0 && snakeCount > 0 };
}

// Helper functions

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

function toScreamingSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/^_/, '')
    .toUpperCase();
}

function isPluralNoun(name: string): boolean {
  // Simple heuristic - ends with 's' but not 'ss', 'us', 'is'
  return name.endsWith('s') && 
         !name.endsWith('ss') && 
         !name.endsWith('us') && 
         !name.endsWith('is') &&
         !name.endsWith('Status');
}

function toSingular(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('es')) return name.slice(0, -2);
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

function startsWithVerb(name: string): boolean {
  const verbs = [
    'Get', 'Set', 'Create', 'Update', 'Delete', 'Remove', 'Add', 'Find', 
    'Search', 'List', 'Validate', 'Process', 'Send', 'Receive', 'Handle',
    'Calculate', 'Generate', 'Transform', 'Convert', 'Parse', 'Format',
    'Load', 'Save', 'Fetch', 'Submit', 'Cancel', 'Approve', 'Reject',
    'Enable', 'Disable', 'Activate', 'Deactivate', 'Start', 'Stop',
    'Begin', 'End', 'Initialize', 'Configure', 'Register', 'Unregister',
    'Subscribe', 'Unsubscribe', 'Publish', 'Notify', 'Acknowledge',
    'Transfer', 'Move', 'Copy', 'Import', 'Export', 'Sync', 'Verify',
  ];
  return verbs.some(v => name.startsWith(v));
}

function isBooleanField(field: { type: unknown }): boolean {
  const typeObj = field.type as { kind?: string; name?: { name?: string } };
  return typeObj?.kind === 'SimpleType' && typeObj.name?.name === 'Boolean';
}

function isGoodBooleanName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('is') ||
    lower.startsWith('has') ||
    lower.startsWith('can') ||
    lower.startsWith('should') ||
    lower.startsWith('will') ||
    lower.endsWith('able') ||
    lower.endsWith('ed')
  );
}

function hasAbbreviation(name: string): boolean {
  const abbreviations = ['qty', 'amt', 'num', 'val', 'str', 'obj', 'arr', 'ptr', 'idx', 'cnt'];
  const lower = name.toLowerCase();
  return abbreviations.some(abbr => lower.includes(abbr));
}
