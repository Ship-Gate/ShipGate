/**
 * ISL Policy Packs - Quality Policy Pack
 * 
 * Rules that enforce code quality standards and prevent shipping
 * incomplete or stubbed implementations.
 * 
 * @module @isl-lang/policy-packs/quality
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import { matchesAnyPattern, getLineNumber } from '../utils.js';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default allowlist configuration for stubbed handlers rule.
 * Files matching these patterns are allowed to have stubs.
 */
export const DEFAULT_STUB_ALLOWLIST: string[] = [
  // Test files
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
  // Test fixtures
  '**/test-fixtures/**',
  '**/fixtures/**',
  '**/__fixtures__/**',
  // Mock files
  '**/__mocks__/**',
  '**/mocks/**',
  '**/*.mock.ts',
  '**/*.mock.js',
  // Type/schema files
  '**/*.types.ts',
  '**/*.schema.ts',
  '**/*.d.ts',
  // Demo/example files
  '**/demo/**',
  '**/examples/**',
];

// ============================================================================
// Stub Detection Patterns
// ============================================================================

/**
 * Patterns that indicate "Not implemented" stubs
 */
const NOT_IMPLEMENTED_PATTERNS = [
  /throw\s+new\s+Error\s*\(\s*['"`]Not implemented['"`]\s*\)/gi,
  /throw\s+new\s+Error\s*\(\s*['"`]Not yet implemented['"`]\s*\)/gi,
  /throw\s+new\s+Error\s*\(\s*['"`]STUB['"`]\s*\)/gi,
  /throw\s+new\s+Error\s*\(\s*['"`]PLACEHOLDER['"`]\s*\)/gi,
  /throw\s+['"`]Not implemented['"`]/gi,
  /throw\s+['"`]TODO['"`]/gi,
];

/**
 * Patterns that indicate TODO markers under postconditions
 */
const TODO_POSTCONDITION_PATTERNS = [
  /\/\/\s*ISL postconditions[\s\S]{0,200}TODO/i,
  /\/\*\*?\s*ISL postconditions[\s\S]{0,200}TODO/i,
  /\/\/\s*@postcondition[\s\S]{0,200}TODO/i,
  /postconditions\s+to\s+satisfy[\s\S]{0,200}TODO/i,
];

/**
 * Patterns that indicate placeholder implementations
 */
const PLACEHOLDER_PATTERNS = [
  /\/\/\s*Implementation goes here/i,
  /\/\/\s*TODO:\s*implement\s*(this|handler|function|method)?/i,
  /\/\/\s*FIXME:\s*implement/i,
  /\/\/\s*placeholder\s*(implementation)?/i,
  /pass\s*;?\s*\/\/\s*placeholder/i,
  /return\s*;?\s*\/\/\s*stub/i,
  /{\s*\/\/\s*TODO\s*}/,
  /{\s*\/\*\s*TODO\s*\*\/\s*}/,
];

/**
 * Patterns that indicate placeholder function bodies
 * (function that throws TODO/FIXME or returns placeholder)
 */
const PLACEHOLDER_FUNCTION_PATTERNS = [
  /async\s+function\s+\w+\s*\([^)]*\)\s*\{[\s\n]*throw\s+new\s+Error\s*\(\s*['"`](TODO|FIXME)/gi,
  /function\s+\w+\s*\([^)]*\)\s*\{[\s\n]*throw\s+new\s+Error\s*\(\s*['"`](TODO|FIXME)/gi,
  /const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\n]*throw\s+new\s+Error\s*\(\s*['"`](TODO|FIXME)/gi,
  /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\n]*throw\s+new\s+Error\s*\(\s*['"`](TODO|FIXME)/gi,
];

/**
 * Patterns for specific handler functions that are commonly stubbed
 */
const COMMON_STUBBED_HANDLER_PATTERNS = [
  // Login handler that throws
  /(?:async\s+)?(?:function\s+)?(?:userLogin|login|handleLogin)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[^}]*throw\s+new\s+Error/gi,
  // Auth handlers that throw
  /(?:async\s+)?(?:function\s+)?(?:authenticate|authorize|checkAuth)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[^}]*throw\s+new\s+Error/gi,
  // Generic handlers that immediately throw
  /(?:async\s+)?(?:function\s+)?handle\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[\s\n]*throw\s+new\s+Error/gi,
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a file path matches the stub allowlist
 */
export function isAllowedStubFile(filePath: string, allowlist: string[] = DEFAULT_STUB_ALLOWLIST): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const pattern of allowlist) {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<DOUBLE_STAR>>>/g, '.*')
      .replace(/\./g, '\\.');
    
    const regex = new RegExp(regexPattern, 'i');
    if (regex.test(normalizedPath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find line number for a pattern match
 */
function findPatternLine(content: string, pattern: RegExp): number {
  const match = content.match(pattern);
  if (!match || match.index === undefined) return 1;
  return getLineNumber(content, match.index);
}

// ============================================================================
// Rules
// ============================================================================

/**
 * Rule: quality/no-stubbed-handlers
 * Prevents shipping code with stubbed or placeholder implementations.
 */
const noStubbedHandlersRule: PolicyRule = {
  id: 'quality/no-stubbed-handlers',
  name: 'No Stubbed Handlers',
  description: 'Prevents shipping code with "Not implemented" throws, TODO markers in postconditions, or placeholder handlers',
  severity: 'error',
  category: 'quality',
  tags: ['quality', 'implementation', 'stubs', 'ship-blocker'],
  config: {
    allowlist: DEFAULT_STUB_ALLOWLIST,
  },
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const allowlist = (ctx.truthpack as { stubAllowlist?: string[] }).stubAllowlist || 
                      (noStubbedHandlersRule.config?.allowlist as string[]) ||
                      DEFAULT_STUB_ALLOWLIST;
    
    // Skip if file is in allowlist
    if (isAllowedStubFile(ctx.filePath, allowlist)) {
      return null;
    }

    const content = ctx.content || '';

    // Check for "Not implemented" patterns
    for (const pattern of NOT_IMPLEMENTED_PATTERNS) {
      if (pattern.test(content)) {
        // Reset regex lastIndex after test
        pattern.lastIndex = 0;
        const match = content.match(pattern);
        const line = match?.index !== undefined ? getLineNumber(content, match.index) : 1;
        
        return {
          ruleId: 'quality/no-stubbed-handlers',
          ruleName: 'No Stubbed Handlers',
          severity: 'error',
          message: 'STUBBED HANDLER: "Not implemented" error cannot ship - implementation required',
          tier: 'hard_block',
          location: {
            file: ctx.filePath,
            line,
          },
          suggestion: 'Implement the handler logic or remove the stub',
          metadata: {
            stubType: 'not_implemented',
            pattern: match?.[0],
          },
        };
      }
    }

    // Check for TODO in postconditions
    for (const pattern of TODO_POSTCONDITION_PATTERNS) {
      if (pattern.test(content)) {
        const line = findPatternLine(content, pattern);
        
        return {
          ruleId: 'quality/no-stubbed-handlers',
          ruleName: 'No Stubbed Handlers',
          severity: 'error',
          message: 'TODO POSTCONDITION: TODO markers remain under "ISL postconditions to satisfy" - must be implemented',
          tier: 'hard_block',
          location: {
            file: ctx.filePath,
            line,
          },
          suggestion: 'Implement all postconditions marked with TODO',
          metadata: {
            stubType: 'todo_postcondition',
          },
        };
      }
    }

    // Check for placeholder implementations
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(content)) {
        const line = findPatternLine(content, pattern);
        
        return {
          ruleId: 'quality/no-stubbed-handlers',
          ruleName: 'No Stubbed Handlers',
          severity: 'error',
          message: 'PLACEHOLDER CODE: Placeholder implementation cannot ship',
          tier: 'hard_block',
          location: {
            file: ctx.filePath,
            line,
          },
          suggestion: 'Complete the implementation before shipping',
          metadata: {
            stubType: 'placeholder',
          },
        };
      }
    }

    // Check for placeholder function bodies
    for (const pattern of PLACEHOLDER_FUNCTION_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const match = content.match(pattern);
        const line = match?.index !== undefined ? getLineNumber(content, match.index) : 1;
        
        return {
          ruleId: 'quality/no-stubbed-handlers',
          ruleName: 'No Stubbed Handlers',
          severity: 'error',
          message: 'STUBBED FUNCTION: Function throws TODO/FIXME error - implementation required',
          tier: 'hard_block',
          location: {
            file: ctx.filePath,
            line,
          },
          suggestion: 'Implement the function body',
          metadata: {
            stubType: 'stubbed_function',
          },
        };
      }
    }

    // Check for common stubbed handlers (like userLogin)
    for (const pattern of COMMON_STUBBED_HANDLER_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        const match = content.match(pattern);
        const line = match?.index !== undefined ? getLineNumber(content, match.index) : 1;
        
        // Extract function name from match
        const funcNameMatch = match?.[0]?.match(/(?:function\s+)?(\w+)\s*\(/i);
        const funcName = funcNameMatch?.[1] || 'handler';
        
        return {
          ruleId: 'quality/no-stubbed-handlers',
          ruleName: 'No Stubbed Handlers',
          severity: 'error',
          message: `STUBBED HANDLER: ${funcName}() throws error - implementation required before ship`,
          tier: 'hard_block',
          location: {
            file: ctx.filePath,
            line,
          },
          suggestion: `Implement ${funcName}() with proper logic`,
          metadata: {
            stubType: 'common_handler',
            functionName: funcName,
          },
        };
      }
    }

    return null;
  },
};

/**
 * Rule: quality/no-todo-comments
 * Detects TODO/FIXME comments that should be resolved before shipping.
 * This is a softer version - warning instead of error.
 */
const noTodoCommentsRule: PolicyRule = {
  id: 'quality/no-todo-comments',
  name: 'No TODO Comments',
  description: 'Detects TODO/FIXME comments that indicate incomplete work',
  severity: 'warning',
  category: 'quality',
  tags: ['quality', 'todos', 'comments'],
  config: {
    allowlist: DEFAULT_STUB_ALLOWLIST,
    criticalPatterns: ['TODO: CRITICAL', 'FIXME: BLOCKER', 'XXX:'],
  },
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const allowlist = (ctx.truthpack as { stubAllowlist?: string[] }).stubAllowlist || 
                      (noTodoCommentsRule.config?.allowlist as string[]) ||
                      DEFAULT_STUB_ALLOWLIST;
    
    // Skip if file is in allowlist
    if (isAllowedStubFile(ctx.filePath, allowlist)) {
      return null;
    }

    const content = ctx.content || '';

    // Check for critical TODO patterns (hard block)
    const criticalPatterns = [
      /\/\/\s*TODO:\s*CRITICAL/i,
      /\/\/\s*FIXME:\s*BLOCKER/i,
      /\/\/\s*XXX:/i,
      /\/\/\s*HACK:\s*MUST\s*FIX/i,
    ];

    for (const pattern of criticalPatterns) {
      if (pattern.test(content)) {
        const line = findPatternLine(content, pattern);
        
        return {
          ruleId: 'quality/no-todo-comments',
          ruleName: 'No TODO Comments',
          severity: 'error',
          message: 'CRITICAL TODO: Blocker TODO comment must be resolved before shipping',
          tier: 'hard_block',
          location: {
            file: ctx.filePath,
            line,
          },
          suggestion: 'Resolve the critical TODO or remove if no longer needed',
          metadata: {
            todoType: 'critical',
          },
        };
      }
    }

    // Count regular TODOs (soft warning - doesn't block by default)
    const todoCount = (content.match(/\/\/\s*TODO(?!:\s*CRITICAL)/gi) || []).length;
    const fixmeCount = (content.match(/\/\/\s*FIXME(?!:\s*BLOCKER)/gi) || []).length;
    
    if (todoCount + fixmeCount > 5) {
      return {
        ruleId: 'quality/no-todo-comments',
        ruleName: 'No TODO Comments',
        severity: 'warning',
        message: `HIGH TODO COUNT: ${todoCount + fixmeCount} TODO/FIXME comments found - consider resolving before ship`,
        tier: 'warn',
        location: {
          file: ctx.filePath,
        },
        suggestion: 'Review and resolve TODO comments, or convert to tracked issues',
        metadata: {
          todoCount,
          fixmeCount,
          total: todoCount + fixmeCount,
        },
      };
    }

    return null;
  },
};

/**
 * Rule: quality/no-debug-code
 * Detects debug code that should not ship.
 */
const noDebugCodeRule: PolicyRule = {
  id: 'quality/no-debug-code',
  name: 'No Debug Code',
  description: 'Detects debug code like debugger statements and debug flags',
  severity: 'error',
  category: 'quality',
  tags: ['quality', 'debug', 'production'],
  config: {
    allowlist: DEFAULT_STUB_ALLOWLIST,
  },
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const allowlist = (ctx.truthpack as { stubAllowlist?: string[] }).stubAllowlist || 
                      (noDebugCodeRule.config?.allowlist as string[]) ||
                      DEFAULT_STUB_ALLOWLIST;
    
    // Skip if file is in allowlist
    if (isAllowedStubFile(ctx.filePath, allowlist)) {
      return null;
    }

    const content = ctx.content || '';

    // Check for debugger statements
    const debuggerPattern = /\bdebugger\s*;?/g;
    if (debuggerPattern.test(content)) {
      debuggerPattern.lastIndex = 0;
      const match = content.match(debuggerPattern);
      const line = match?.index !== undefined ? getLineNumber(content, match.index) : 1;
      
      return {
        ruleId: 'quality/no-debug-code',
        ruleName: 'No Debug Code',
        severity: 'error',
        message: 'DEBUG CODE: debugger statement cannot ship',
        tier: 'hard_block',
        location: {
          file: ctx.filePath,
          line,
        },
        suggestion: 'Remove debugger statements before shipping',
        metadata: {
          debugType: 'debugger_statement',
        },
      };
    }

    // Check for debug flags
    const debugFlagPatterns = [
      /DEBUG\s*[=:]\s*true/gi,
      /ENABLE_DEBUG\s*[=:]\s*true/gi,
      /IS_DEBUG\s*[=:]\s*true/gi,
      /\.debug\s*=\s*true/gi,
    ];

    for (const pattern of debugFlagPatterns) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        
        return {
          ruleId: 'quality/no-debug-code',
          ruleName: 'No Debug Code',
          severity: 'warning',
          message: 'DEBUG FLAG: Debug flag enabled in code',
          tier: 'soft_block',
          location: {
            file: ctx.filePath,
          },
          suggestion: 'Set debug flags to false or use environment variables',
          metadata: {
            debugType: 'debug_flag',
          },
        };
      }
    }

    return null;
  },
};

// ============================================================================
// Policy Pack Export
// ============================================================================

export const qualityPolicyPack: PolicyPack = {
  id: 'quality',
  name: 'Code Quality',
  description: 'Rules that enforce code quality standards and prevent shipping incomplete implementations',
  version: '0.1.0',
  rules: [
    noStubbedHandlersRule,
    noTodoCommentsRule,
    noDebugCodeRule,
  ],
  defaultConfig: {
    enabled: true,
  },
};

// Export individual rules for direct access
export const qualityRules: PolicyRule[] = qualityPolicyPack.rules;
export { noStubbedHandlersRule, noTodoCommentsRule, noDebugCodeRule };

export default qualityPolicyPack;
