/**
 * @isl-lang/codegen-core - Deterministic Formatter
 *
 * Provides consistent code formatting using Prettier with fixed configuration.
 * All formatting decisions are deterministic and produce stable output.
 */

import * as prettier from 'prettier';
import type {
  FormatConfig,
  Language,
  HeaderConfig,
  CodePrinter,
} from './types.js';
import { DEFAULT_FORMAT_CONFIGS } from './types.js';

// ============================================================================
// Code Formatter
// ============================================================================

/**
 * Format code using Prettier with deterministic configuration
 */
export async function formatCode(
  code: string,
  language: Language,
  config?: Partial<FormatConfig>
): Promise<string> {
  const mergedConfig = {
    ...DEFAULT_FORMAT_CONFIGS[language],
    ...config,
  };

  const prettierParser = getPrettierParser(language);

  try {
    const formatted = await prettier.format(code, {
      parser: prettierParser,
      tabWidth: mergedConfig.indentSize,
      useTabs: mergedConfig.indent === 'tabs',
      printWidth: mergedConfig.printWidth,
      trailingComma: mergedConfig.trailingComma,
      singleQuote: mergedConfig.singleQuote,
      semi: mergedConfig.semi,
      endOfLine: mergedConfig.endOfLine,
    });

    return formatted;
  } catch {
    // If formatting fails, return original with normalized line endings
    return normalizeLineEndings(code, mergedConfig.endOfLine);
  }
}

/**
 * Synchronous formatting (for use when async is not available)
 * Falls back to manual formatting if Prettier sync is not available
 */
export function formatCodeSync(
  code: string,
  language: Language,
  config?: Partial<FormatConfig>
): string {
  const mergedConfig = {
    ...DEFAULT_FORMAT_CONFIGS[language],
    ...config,
  };

  // Apply basic normalization
  let result = normalizeLineEndings(code, mergedConfig.endOfLine);
  result = normalizeIndentation(result, mergedConfig);
  result = ensureTrailingNewline(result);

  return result;
}

/**
 * Get Prettier parser for a language
 */
function getPrettierParser(language: Language): string {
  const parserMap: Record<Language, string> = {
    typescript: 'typescript',
    javascript: 'babel',
    python: 'python',
    go: 'go',
    rust: 'rust',
    graphql: 'graphql',
  };

  return parserMap[language] ?? 'babel';
}

/**
 * Normalize line endings
 */
function normalizeLineEndings(
  code: string,
  endOfLine: 'lf' | 'crlf' | 'auto'
): string {
  const lineEnding = endOfLine === 'crlf' ? '\r\n' : '\n';
  return code.replace(/\r\n|\r|\n/g, lineEnding);
}

/**
 * Normalize indentation
 */
function normalizeIndentation(code: string, config: FormatConfig): string {
  const lines = code.split(/\r?\n/);
  const targetIndent =
    config.indent === 'tabs' ? '\t' : ' '.repeat(config.indentSize);

  return lines
    .map((line) => {
      // Detect current indentation
      const match = line.match(/^(\s*)/);
      if (!match) return line;

      const whitespace = match[1] ?? '';
      if (whitespace.length === 0) return line;

      // Count indentation level (normalize mixed tabs/spaces)
      let level = 0;
      for (const char of whitespace) {
        if (char === '\t') level += 1;
        else level += 1 / config.indentSize;
      }
      level = Math.round(level);

      // Apply target indentation
      return targetIndent.repeat(level) + line.slice(whitespace.length);
    })
    .join(config.endOfLine === 'crlf' ? '\r\n' : '\n');
}

/**
 * Ensure file ends with a single newline
 */
function ensureTrailingNewline(code: string): string {
  return code.replace(/\s*$/, '\n');
}

// ============================================================================
// Header Generation
// ============================================================================

/**
 * Generate a deterministic file header
 */
export function generateHeader(config: HeaderConfig): string {
  const lines: string[] = [
    '/**',
    ' * @generated - DO NOT EDIT',
  ];

  if (config.sourcePath) {
    lines.push(` * Source: ${config.sourcePath}`);
  }

  lines.push(` * Generator: ${config.generator}@${config.version}`);

  if (config.includeHash && config.metadata?.hash) {
    lines.push(` * Hash: ${config.metadata.hash}`);
  }

  // Add any additional metadata
  if (config.metadata) {
    for (const [key, value] of Object.entries(config.metadata)) {
      if (key !== 'hash') {
        lines.push(` * ${key}: ${value}`);
      }
    }
  }

  lines.push(' */');

  return lines.join('\n');
}

/**
 * Generate a section comment block
 */
export function generateSectionComment(title: string): string {
  const line = '='.repeat(76);
  return `// ${line}\n// ${title}\n// ${line}`;
}

// ============================================================================
// Content Hashing
// ============================================================================

/**
 * Generate a deterministic content hash
 *
 * Uses a simple hash function that works in all environments.
 * For cryptographic needs, use Node.js crypto module.
 */
export function hashContent(content: string, length = 8): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Convert to hex string
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return hex.slice(0, length);
}

// ============================================================================
// Code Printer
// ============================================================================

/**
 * Create a deterministic code printer
 */
export function createPrinter(config?: Partial<FormatConfig>): CodePrinter {
  const lines: string[] = [];
  let currentLine = '';
  let indentLevel = 0;

  const mergedConfig = {
    ...DEFAULT_FORMAT_CONFIGS.typescript,
    ...config,
  };

  const indentStr =
    mergedConfig.indent === 'tabs'
      ? '\t'
      : ' '.repeat(mergedConfig.indentSize);

  const getIndent = () => indentStr.repeat(indentLevel);

  const printer: CodePrinter = {
    get indentLevel() {
      return indentLevel;
    },

    writeLine(line: string): void {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(getIndent() + line);
    },

    write(text: string): void {
      if (!currentLine) {
        currentLine = getIndent();
      }
      currentLine += text;
    },

    blankLine(): void {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push('');
    },

    indent(): void {
      indentLevel++;
    },

    dedent(): void {
      if (indentLevel > 0) indentLevel--;
    },

    writeBlock(opener: string, closer: string, content: () => void): void {
      this.writeLine(opener);
      this.indent();
      content();
      this.dedent();
      this.writeLine(closer);
    },

    toString(): string {
      const allLines = currentLine ? [...lines, currentLine] : lines;
      return allLines.join('\n') + '\n';
    },
  };

  return printer;
}

// ============================================================================
// Deterministic String Utilities
// ============================================================================

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase())
    .replace(/\s/g, '');
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/**
 * Convert string to SCREAMING_SNAKE_CASE
 */
export function toScreamingSnakeCase(str: string): string {
  return toSnakeCase(str).toUpperCase();
}
