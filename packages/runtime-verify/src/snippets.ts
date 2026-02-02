// ============================================================================
// Deterministic Snippet Generators for Codegen Consumers
// ============================================================================

import type { SnippetOptions, GeneratedSnippet } from './types';

/**
 * Simple hash function for determinism verification
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normalize code for consistent formatting
 */
function normalizeCode(code: string): string {
  return code
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Default snippet options
 */
const defaultOptions: Required<SnippetOptions> = {
  indent: '  ',
  includeTypes: true,
  language: 'typescript',
  errorClass: 'VerifyError',
};

/**
 * Generate a require() precondition check snippet
 * 
 * @param expression - The condition expression
 * @param message - Error message
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 * 
 * @example
 * ```typescript
 * const snippet = generateRequireSnippet('amount > 0', 'Amount must be positive');
 * // snippet.code: 'require(amount > 0, "Amount must be positive");'
 * ```
 */
export function generateRequireSnippet(
  expression: string,
  message: string,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  
  const escapedMessage = message.replace(/"/g, '\\"');
  const code = `require(${expression}, "${escapedMessage}");`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: ['require'],
  };
}

/**
 * Generate an ensure() postcondition check snippet
 * 
 * @param expression - The condition expression
 * @param message - Error message
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 */
export function generateEnsureSnippet(
  expression: string,
  message: string,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  
  const escapedMessage = message.replace(/"/g, '\\"');
  const code = `ensure(${expression}, "${escapedMessage}");`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: ['ensure'],
  };
}

/**
 * Generate an invariant() check snippet
 * 
 * @param expression - The condition expression
 * @param message - Error message
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 */
export function generateInvariantSnippet(
  expression: string,
  message: string,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  
  const escapedMessage = message.replace(/"/g, '\\"');
  const code = `invariant(${expression}, "${escapedMessage}");`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: ['invariant'],
  };
}

/**
 * Generate a batch of require() checks
 * 
 * @param checks - Array of [expression, message] tuples
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 */
export function generateRequireAllSnippet(
  checks: Array<[string, string]>,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  const { indent } = opts;
  
  const checkLines = checks.map(([expr, msg]) => {
    const escapedMsg = msg.replace(/"/g, '\\"');
    return `${indent}[${expr}, "${escapedMsg}"],`;
  });
  
  const code = `requireAll([
${checkLines.join('\n')}
]);`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: ['requireAll'],
  };
}

/**
 * Generate a batch of ensure() checks
 * 
 * @param checks - Array of [expression, message] tuples
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 */
export function generateEnsureAllSnippet(
  checks: Array<[string, string]>,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  const { indent } = opts;
  
  const checkLines = checks.map(([expr, msg]) => {
    const escapedMsg = msg.replace(/"/g, '\\"');
    return `${indent}[${expr}, "${escapedMsg}"],`;
  });
  
  const code = `ensureAll([
${checkLines.join('\n')}
]);`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: ['ensureAll'],
  };
}

/**
 * Generate a batch of invariant() checks
 * 
 * @param checks - Array of [expression, message] tuples
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 */
export function generateInvariantAllSnippet(
  checks: Array<[string, string]>,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  const { indent } = opts;
  
  const checkLines = checks.map(([expr, msg]) => {
    const escapedMsg = msg.replace(/"/g, '\\"');
    return `${indent}[${expr}, "${escapedMsg}"],`;
  });
  
  const code = `invariantAll([
${checkLines.join('\n')}
]);`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: ['invariantAll'],
  };
}

/**
 * Generate a complete verification wrapper for a function
 * 
 * @param functionName - Name of the function to wrap
 * @param preconditions - Array of [expression, message] for preconditions
 * @param postconditions - Array of [expression, message] for postconditions
 * @param invariants - Array of [expression, message] for invariants
 * @param options - Generation options
 * @returns Generated snippet with code and hash
 */
export function generateVerifiedFunctionWrapper(
  functionName: string,
  preconditions: Array<[string, string]>,
  postconditions: Array<[string, string]>,
  invariants: Array<[string, string]>,
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  const { indent, includeTypes, language } = opts;
  
  const lines: string[] = [];
  const imports = new Set<string>();
  
  // Generate function signature
  if (includeTypes && language === 'typescript') {
    lines.push(`export async function verified_${functionName}<TInput, TResult>(`);
    lines.push(`${indent}input: TInput,`);
    lines.push(`${indent}impl: (input: TInput) => Promise<TResult>`);
    lines.push(`): Promise<TResult> {`);
  } else {
    lines.push(`export async function verified_${functionName}(input, impl) {`);
  }
  
  // Preconditions
  if (preconditions.length > 0) {
    lines.push(`${indent}// Preconditions`);
    for (const [expr, msg] of preconditions) {
      const escapedMsg = msg.replace(/"/g, '\\"');
      lines.push(`${indent}require(${expr}, "${escapedMsg}");`);
    }
    imports.add('require');
    lines.push('');
  }
  
  // Invariants (before)
  if (invariants.length > 0) {
    lines.push(`${indent}// Capture state for invariants`);
    lines.push(`${indent}const __oldState = captureState();`);
    imports.add('captureState');
    lines.push('');
  }
  
  // Execute implementation
  lines.push(`${indent}// Execute implementation`);
  lines.push(`${indent}const result = await impl(input);`);
  lines.push('');
  
  // Postconditions
  if (postconditions.length > 0) {
    lines.push(`${indent}// Postconditions`);
    for (const [expr, msg] of postconditions) {
      const escapedMsg = msg.replace(/"/g, '\\"');
      lines.push(`${indent}ensure(${expr}, "${escapedMsg}");`);
    }
    imports.add('ensure');
    lines.push('');
  }
  
  // Invariants (after)
  if (invariants.length > 0) {
    lines.push(`${indent}// Invariants`);
    for (const [expr, msg] of invariants) {
      const escapedMsg = msg.replace(/"/g, '\\"');
      lines.push(`${indent}invariant(${expr}, "${escapedMsg}");`);
    }
    imports.add('invariant');
    lines.push('');
  }
  
  // Return result
  lines.push(`${indent}return result;`);
  lines.push('}');
  
  const code = lines.join('\n');
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: Array.from(imports),
  };
}

/**
 * Generate import statement for runtime-verify
 * 
 * @param symbols - Symbols to import
 * @param options - Generation options
 * @returns Generated import snippet
 */
export function generateImportSnippet(
  symbols: string[],
  options?: SnippetOptions
): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  
  const sortedSymbols = [...symbols].sort();
  const code = `import { ${sortedSymbols.join(', ')} } from '@isl-lang/runtime-verify';`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: [],
  };
}

/**
 * Generate a complete verification module header
 * 
 * @param options - Generation options
 * @returns Generated snippet with all standard imports
 */
export function generateModuleHeader(options?: SnippetOptions): GeneratedSnippet {
  const opts = { ...defaultOptions, ...options };
  
  const code = `// Generated by @isl-lang/runtime-verify
import {
  require,
  ensure,
  invariant,
  requireAll,
  ensureAll,
  invariantAll,
  PreconditionError,
  PostconditionError,
  InvariantError,
} from '@isl-lang/runtime-verify';`;
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: [],
  };
}

/**
 * Verify that a snippet is deterministic by checking its hash
 * 
 * @param snippet - The generated snippet to verify
 * @returns true if the snippet hash matches its content
 */
export function verifySnippetDeterminism(snippet: GeneratedSnippet): boolean {
  const expectedHash = hashString(snippet.code);
  return snippet.hash === expectedHash;
}

/**
 * Combine multiple snippets into a single code block
 * 
 * @param snippets - Snippets to combine
 * @param separator - Line separator (default: '\n\n')
 * @returns Combined snippet with merged imports
 */
export function combineSnippets(
  snippets: GeneratedSnippet[],
  separator: string = '\n\n'
): GeneratedSnippet {
  const allImports = new Set<string>();
  const codeParts: string[] = [];
  
  for (const snippet of snippets) {
    codeParts.push(snippet.code);
    for (const imp of snippet.imports) {
      allImports.add(imp);
    }
  }
  
  const code = codeParts.join(separator);
  
  return {
    code: normalizeCode(code),
    hash: hashString(code),
    imports: Array.from(allImports).sort(),
  };
}
