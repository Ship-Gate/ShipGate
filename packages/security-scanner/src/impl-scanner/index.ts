// ============================================================================
// Implementation Scanners Index
// ============================================================================

export * from './typescript';
export * from './python';
export * from './go';
export * from './java';

import { Finding } from '../severity';
import { scanTypeScript, TypeScriptScanOptions } from './typescript';
import { scanPython, PythonScanOptions } from './python';
import { scanGo, GoScanOptions } from './go';
import { scanJava, JavaScanOptions } from './java';

// ============================================================================
// Unified Implementation Scanner
// ============================================================================

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'java';

export interface ImplementationScanOptions {
  language?: SupportedLanguage;
  filePath?: string;
  typescript?: TypeScriptScanOptions;
  python?: PythonScanOptions;
  go?: GoScanOptions;
  java?: JavaScanOptions;
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

    case 'go': {
      const result = scanGo(source, filePath, options.go);
      return {
        ...result,
        language,
      };
    }

    case 'java': {
      const result = scanJava(source, filePath, options.java);
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
      case 'go':
        return 'go';
      case 'java':
        return 'java';
    }
  }

  const goIndicators = [
    /^package\s+\w+/m,
    /^import\s+\(/m,
    /^func\s+\w+\s*\(/m,
    /^func\s+\(\w+\s+\*?\w+\)\s+\w+/m,
    /:=\s/,
  ];

  const javaIndicators = [
    /^package\s+[\w.]+;/m,
    /^import\s+[\w.]+;/m,
    /public\s+class\s+\w+/m,
    /public\s+static\s+void\s+main/m,
    /System\.out\.println/,
    /@Override/m,
  ];

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

  let goScore = 0;
  let javaScore = 0;
  let pythonScore = 0;
  let tsScore = 0;

  for (const pattern of goIndicators) {
    if (pattern.test(source)) goScore++;
  }

  for (const pattern of javaIndicators) {
    if (pattern.test(source)) javaScore++;
  }

  for (const pattern of pythonIndicators) {
    if (pattern.test(source)) pythonScore++;
  }

  for (const pattern of typescriptIndicators) {
    if (pattern.test(source)) tsScore++;
  }

  const scores: [SupportedLanguage, number][] = [
    ['go', goScore],
    ['java', javaScore],
    ['python', pythonScore],
    ['typescript', tsScore],
  ];
  scores.sort((a, b) => b[1] - a[1]);

  if (scores[0]![1] > 0) return scores[0]![0];

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
    case 'go':
      return 'source.go';
    case 'java':
      return 'Source.java';
    default:
      return 'source.txt';
  }
}

// ============================================================================
// Language-specific pattern counts
// ============================================================================

import { getTypeScriptPatternCount } from './typescript';
import { getPythonPatternCount } from './python';
import { getGoPatternCount } from './go';
import { getJavaPatternCount } from './java';

export function getTotalPatternCount(): number {
  return getTypeScriptPatternCount() + getPythonPatternCount() + getGoPatternCount() + getJavaPatternCount();
}

export function getPatternCountByLanguage(): Record<SupportedLanguage, number> {
  return {
    typescript: getTypeScriptPatternCount(),
    javascript: getTypeScriptPatternCount(),
    python: getPythonPatternCount(),
    go: getGoPatternCount(),
    java: getJavaPatternCount(),
  };
}
