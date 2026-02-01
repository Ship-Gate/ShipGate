// ============================================================================
// Implementation Scanners Index
// ============================================================================

export * from './typescript';
export * from './python';

import { Finding } from '../severity';
import { scanTypeScript, TypeScriptScanOptions } from './typescript';
import { scanPython, PythonScanOptions } from './python';

// ============================================================================
// Unified Implementation Scanner
// ============================================================================

export type SupportedLanguage = 'typescript' | 'javascript' | 'python';

export interface ImplementationScanOptions {
  language?: SupportedLanguage;
  filePath?: string;
  typescript?: TypeScriptScanOptions;
  python?: PythonScanOptions;
}

export interface ImplementationScanResult {
  findings: Finding[];
  language: SupportedLanguage;
  linesScanned: number;
  patternsMatched: number;
}

/**
 * Scan implementation source code for security vulnerabilities
 */
export function scanImplementation(
  source: string,
  options: ImplementationScanOptions = {}
): ImplementationScanResult {
  const language = options.language || detectLanguage(source, options.filePath);
  const filePath = options.filePath || getDefaultFilePath(language);

  switch (language) {
    case 'typescript':
    case 'javascript': {
      const result = scanTypeScript(source, filePath, options.typescript);
      return {
        ...result,
        language,
      };
    }

    case 'python': {
      const result = scanPython(source, filePath, options.python);
      return {
        ...result,
        language,
      };
    }

    default:
      return {
        findings: [],
        language,
        linesScanned: source.split('\n').length,
        patternsMatched: 0,
      };
  }
}

/**
 * Detect programming language from source code or file path
 */
export function detectLanguage(
  source: string,
  filePath?: string
): SupportedLanguage {
  // Check file extension first
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
      case 'pyw':
        return 'python';
    }
  }

  // Heuristic detection based on content
  const pythonIndicators = [
    /^import\s+\w+/m,
    /^from\s+\w+\s+import/m,
    /^def\s+\w+\s*\(/m,
    /^class\s+\w+.*:/m,
    /^\s*if\s+__name__\s*==\s*['"]__main__['"]/m,
    /:\s*$/m,
  ];

  const typescriptIndicators = [
    /^import\s+.*\s+from\s+['"][^'"]+['"]/m,
    /^export\s+(default\s+)?(function|class|const|interface|type)/m,
    /:\s*(string|number|boolean|any|void|never)\b/,
    /interface\s+\w+\s*\{/,
    /type\s+\w+\s*=/,
    /<\w+>/,
  ];

  let pythonScore = 0;
  let tsScore = 0;

  for (const pattern of pythonIndicators) {
    if (pattern.test(source)) pythonScore++;
  }

  for (const pattern of typescriptIndicators) {
    if (pattern.test(source)) tsScore++;
  }

  if (pythonScore > tsScore) return 'python';
  if (tsScore > 0) return 'typescript';
  
  // Default to TypeScript
  return 'typescript';
}

function getDefaultFilePath(language: SupportedLanguage): string {
  switch (language) {
    case 'typescript':
      return 'source.ts';
    case 'javascript':
      return 'source.js';
    case 'python':
      return 'source.py';
    default:
      return 'source.txt';
  }
}

// ============================================================================
// Language-specific pattern counts
// ============================================================================

import { getTypeScriptPatternCount } from './typescript';
import { getPythonPatternCount } from './python';

export function getTotalPatternCount(): number {
  return getTypeScriptPatternCount() + getPythonPatternCount();
}

export function getPatternCountByLanguage(): Record<SupportedLanguage, number> {
  return {
    typescript: getTypeScriptPatternCount(),
    javascript: getTypeScriptPatternCount(), // Same as TS
    python: getPythonPatternCount(),
  };
}
