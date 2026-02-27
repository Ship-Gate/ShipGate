/**
 * ISL Policy Packs - PII & Logging Policy Pack
 * 
 * Rules for PII handling and secure logging patterns.
 * 
 * @module @isl-lang/policy-packs/pii
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import { matchesAnyPattern, containsKeyword, findClaimsByType } from '../utils.js';

// ============================================================================
// PII Patterns
// ============================================================================

const PII_KEYWORDS = [
  'email',
  'phone',
  'ssn',
  'socialSecurity',
  'dateOfBirth',
  'dob',
  'address',
  'passport',
  'driverLicense',
  'creditCard',
  'bankAccount',
  'password',
  'firstName',
  'lastName',
  'fullName',
  'ip',
  'ipAddress',
];

const LOGGING_PATTERNS = [
  /console\.(log|info|warn|error|debug)/,
  /logger\.(log|info|warn|error|debug)/,
  /log\.(info|warn|error|debug)/,
  /print\(/,
  /println/,
];

const SENSITIVE_DATA_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
];

// ============================================================================
// Rules
// ============================================================================

/**
 * PII in Logs Rule
 */
const piiInLogsRule: PolicyRule = {
  id: 'pii/logged-sensitive-data',
  name: 'PII Logged',
  description: 'Detects logging of personally identifiable information',
  severity: 'error',
  category: 'pii',
  tags: ['privacy', 'gdpr', 'logging'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Find logging statements
    const lines = ctx.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLogging = matchesAnyPattern(line, LOGGING_PATTERNS);
      
      if (isLogging) {
        // Check if PII is being logged
        const piiKeyword = containsKeyword(line, PII_KEYWORDS);
        if (piiKeyword) {
          return {
            ruleId: 'pii/logged-sensitive-data',
            ruleName: 'PII Logged',
            severity: 'error',
            tier: 'hard_block',
            message: `PII IN LOG: "${piiKeyword}" may be logged`,
            location: { file: ctx.filePath, line: i + 1 },
            suggestion: 'Redact or mask PII before logging. Use structured logging with data masking.',
          };
        }

        // Check for actual PII patterns in log
        const sensitiveMatch = matchesAnyPattern(line, SENSITIVE_DATA_PATTERNS);
        if (sensitiveMatch) {
          return {
            ruleId: 'pii/logged-sensitive-data',
            ruleName: 'PII Logged',
            severity: 'error',
            tier: 'hard_block',
            message: 'PII IN LOG: Sensitive data pattern detected in log statement',
            location: { file: ctx.filePath, line: i + 1 },
            suggestion: 'Never log actual PII values. Use IDs or masked values instead.',
          };
        }
      }
    }

    return null;
  },
};

/**
 * Unmasked PII in Response Rule
 */
const unmaskedPiiRule: PolicyRule = {
  id: 'pii/unmasked-response',
  name: 'Unmasked PII in Response',
  description: 'Detects API responses that may expose unmasked PII',
  severity: 'warning',
  category: 'pii',
  tags: ['privacy', 'api', 'data-exposure'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check for API response patterns
    const responsePatterns = [
      /res\.json\s*\(/,
      /res\.send\s*\(/,
      /return\s*{[^}]*}/,
      /response\s*=/,
    ];

    const lines = ctx.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isResponse = matchesAnyPattern(line, responsePatterns);
      
      if (isResponse) {
        // Check for sensitive fields in response
        const sensitivePii = ['ssn', 'socialSecurity', 'password', 'creditCard', 'bankAccount'];
        const piiKeyword = containsKeyword(line, sensitivePii);
        
        if (piiKeyword) {
          return {
            ruleId: 'pii/unmasked-response',
            ruleName: 'Unmasked PII in Response',
            severity: 'warning',
            tier: 'soft_block',
            message: `UNMASKED PII: "${piiKeyword}" may be exposed in API response`,
            location: { file: ctx.filePath, line: i + 1 },
            suggestion: 'Mask or omit sensitive fields from API responses',
          };
        }
      }
    }

    return null;
  },
};

/**
 * Missing Data Encryption Rule
 */
const missingEncryptionRule: PolicyRule = {
  id: 'pii/missing-encryption',
  name: 'Missing PII Encryption',
  description: 'Detects PII storage without encryption',
  severity: 'warning',
  category: 'pii',
  tags: ['privacy', 'encryption', 'storage'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check for database operations with PII
    const dbPatterns = [
      /\.save\s*\(/,
      /\.create\s*\(/,
      /\.insert\s*\(/,
      /\.update\s*\(/,
      /prisma\./,
      /mongoose\./,
    ];

    const hasPii = containsKeyword(ctx.content, ['ssn', 'socialSecurity', 'passport', 'driverLicense']);
    const hasDb = matchesAnyPattern(ctx.content, dbPatterns);
    
    if (hasPii && hasDb) {
      // Check for encryption
      const hasEncryption = containsKeyword(ctx.content, ['encrypt', 'cipher', 'crypto', 'hash']);
      
      if (!hasEncryption) {
        return {
          ruleId: 'pii/missing-encryption',
          ruleName: 'Missing PII Encryption',
          severity: 'warning',
          tier: 'soft_block',
          message: 'UNENCRYPTED PII: Sensitive data may be stored without encryption',
          location: { file: ctx.filePath },
          suggestion: 'Encrypt sensitive PII at rest using field-level encryption',
        };
      }
    }

    return null;
  },
};

/**
 * All Console Methods in Production
 */
const CONSOLE_METHODS = ['log', 'error', 'warn', 'info', 'debug', 'trace', 'dir', 'table'] as const;
const CONSOLE_PATTERN = new RegExp(`console\\.(${CONSOLE_METHODS.join('|')})\\s*\\(`, 'g');

/**
 * Console in Production Rule
 * 
 * Detects ALL console.* statements (log, error, warn, info, debug, trace, dir, table)
 * that may leak data in production. Use a safe logger with PII redaction instead.
 */
const consoleLogRule: PolicyRule = {
  id: 'pii/console-in-production',
  name: 'Console in Production',
  description: 'Detects console.* statements (log/error/warn/info/debug/trace/dir/table) that may leak data in production',
  severity: 'warning',
  category: 'pii',
  tags: ['logging', 'security', 'production', 'no-console'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Skip test files
    if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(ctx.filePath)) {
      return null;
    }

    // Skip files in test directories
    if (/(__tests__|__mocks__|fixtures|test-fixtures)/.test(ctx.filePath)) {
      return null;
    }

    // Skip CLI files (command-line tools are meant to use console)
    // Match: cli.ts, bin.ts, cli.js, bin.js (at end of path or standalone), or in cli/bin directories
    const fileName = ctx.filePath.split(/[\/\\]/).pop() || '';
    const pathParts = ctx.filePath.split(/[\/\\]/);
    const hasCliOrBinDir = pathParts.some(part => part === 'cli' || part === 'bin');
    if (
      /^(cli|bin)\.(ts|js)$/.test(fileName) ||
      /[\/\\](cli|bin)\.(ts|js)$/.test(ctx.filePath) ||
      hasCliOrBinDir ||
      ctx.content.startsWith('#!/usr/bin/env node')
    ) {
      return null;
    }

    // Find all console.* calls
    const matches: Array<{ method: string; line: number }> = [];
    const lines = ctx.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const method of CONSOLE_METHODS) {
        const pattern = new RegExp(`console\\.${method}\\s*\\(`);
        if (pattern.test(line)) {
          matches.push({ method, line: i + 1 });
        }
      }
    }

    if (matches.length > 0) {
      const methods = [...new Set(matches.map(m => m.method))];
      const methodList = methods.length <= 3 
        ? methods.join(', ') 
        : `${methods.slice(0, 3).join(', ')}... (${methods.length} types)`;
      
      return {
        ruleId: 'pii/console-in-production',
        ruleName: 'Console in Production',
        severity: 'warning',
        tier: 'warn',
        message: `NO_CONSOLE: console.${methodList} found in production code (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
        location: { file: ctx.filePath, line: matches[0].line },
        suggestion: 'Use a safe logger with PII redaction: import { createSafeLogger, safeError, redact } from "@isl-lang/pipeline/safe-logging"',
      };
    }

    return null;
  },
};

/**
 * Missing Data Retention Rule
 */
const dataRetentionRule: PolicyRule = {
  id: 'pii/missing-retention',
  name: 'Missing Data Retention',
  description: 'Detects PII storage without apparent retention/deletion logic',
  severity: 'info',
  category: 'pii',
  tags: ['gdpr', 'compliance', 'retention'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check if file handles user data storage
    const isUserModel = /user|profile|account|customer/i.test(ctx.filePath) &&
      /schema|model|entity/i.test(ctx.filePath);

    if (!isUserModel) return null;

    // Check for retention/deletion logic
    const hasRetention = containsKeyword(ctx.content, [
      'delete',
      'remove',
      'purge',
      'expir',
      'retention',
      'ttl',
      'softDelete',
    ]);

    if (!hasRetention) {
      return {
        ruleId: 'pii/missing-retention',
        ruleName: 'Missing Data Retention',
        severity: 'info',
        tier: 'warn',
        message: 'RETENTION: User data model may lack retention/deletion policy',
        location: { file: ctx.filePath },
        suggestion: 'Consider implementing data retention and right-to-erasure (GDPR Article 17)',
      };
    }

    return null;
  },
};

// ============================================================================
// Policy Pack Export
// ============================================================================

export const piiPolicyPack: PolicyPack = {
  id: 'pii',
  name: 'PII & Logging Security',
  description: 'Rules for secure handling of personally identifiable information',
  version: '0.1.0',
  rules: [
    piiInLogsRule,
    unmaskedPiiRule,
    missingEncryptionRule,
    consoleLogRule,
    dataRetentionRule,
  ],
  defaultConfig: {
    enabled: true,
  },
};

/**
 * Export individual rules for granular use
 */
export const piiRules = {
  piiInLogs: piiInLogsRule,
  unmaskedPii: unmaskedPiiRule,
  missingEncryption: missingEncryptionRule,
  consoleInProduction: consoleLogRule,
  dataRetention: dataRetentionRule,
};

/**
 * Console methods that are forbidden in production
 * Use createSafeLogger from @isl-lang/pipeline instead
 */
export { CONSOLE_METHODS };

export default piiPolicyPack;
