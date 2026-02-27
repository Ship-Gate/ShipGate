/**
 * ISL Code Formatter
 * 
 * Provides consistent indentation and formatting for ISL documents.
 */

import {
  TextEdit,
  FormattingOptions,
  Range,
  Position,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocument } from './documents.js';

interface FormatState {
  indentLevel: number;
  indentString: string;
  options: FormattingOptions;
}

export function formatDocument(
  islDoc: ISLDocument,
  document: TextDocument,
  options: FormattingOptions
): TextEdit[] {
  const text = document.getText();
  const formatted = formatISL(text, options);

  // If no changes, return empty
  if (formatted === text) {
    return [];
  }

  // Return a single edit that replaces the entire document
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: document.positionAt(text.length),
      },
      newText: formatted,
    },
  ];
}

/**
 * Format ISL source code
 */
export function formatISL(source: string, options: FormattingOptions): string {
  const state: FormatState = {
    indentLevel: 0,
    indentString: options.insertSpaces ? ' '.repeat(options.tabSize) : '\t',
    options,
  };

  const lines = source.split('\n');
  const formattedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines but preserve them
    if (trimmed === '') {
      formattedLines.push('');
      continue;
    }

    // Handle comments
    if (trimmed.startsWith('#')) {
      formattedLines.push(getIndent(state) + trimmed);
      continue;
    }

    // Decrease indent before closing braces
    if (trimmed.startsWith('}')) {
      state.indentLevel = Math.max(0, state.indentLevel - 1);
    }

    // Format the line
    const formattedLine = formatLine(trimmed, state);
    formattedLines.push(formattedLine);

    // Increase indent after opening braces
    if (trimmed.endsWith('{')) {
      state.indentLevel++;
    }
  }

  // Clean up trailing whitespace and ensure final newline
  const result = formattedLines
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd() + '\n';

  return result;
}

function formatLine(line: string, state: FormatState): string {
  const indent = getIndent(state);
  
  // Handle list items (dash prefix)
  if (line.startsWith('-')) {
    return indent + formatDashLine(line);
  }

  // Handle field declarations
  if (line.includes(':') && !line.includes('{')) {
    return indent + formatFieldLine(line);
  }

  // Handle keyword lines
  if (isKeywordLine(line)) {
    return indent + formatKeywordLine(line);
  }

  // Default: just indent
  return indent + line;
}

function getIndent(state: FormatState): string {
  return state.indentString.repeat(state.indentLevel);
}

/**
 * Format a dash-prefixed line (list item)
 */
function formatDashLine(line: string): string {
  // Ensure space after dash
  if (line.startsWith('- ')) {
    return line;
  }
  if (line.startsWith('-')) {
    return '- ' + line.slice(1).trimStart();
  }
  return line;
}

/**
 * Format a field declaration line
 */
function formatFieldLine(line: string): string {
  // Split by first colon
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return line;

  const name = line.slice(0, colonIndex).trim();
  let rest = line.slice(colonIndex + 1).trim();

  // Check for annotations [...]
  let annotations = '';
  const bracketMatch = rest.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    rest = rest.replace(bracketMatch[0], '').trim();
    // Format annotation list
    const anns = bracketMatch[1]!.split(',').map((a) => a.trim()).join(', ');
    annotations = ` [${anns}]`;
  }

  // Check for constraints {...}
  let constraints = '';
  const braceMatch = rest.match(/\{([^}]+)\}/);
  if (braceMatch) {
    rest = rest.replace(braceMatch[0], '').trim();
    // Format constraint list
    const cons = braceMatch[1]!
      .split(',')
      .map((c) => {
        const [k, v] = c.split(':').map((x) => x.trim());
        return `${k}: ${v}`;
      })
      .join(', ');
    constraints = ` { ${cons} }`;
  }

  // Check for optional marker
  let optional = '';
  if (rest.endsWith('?')) {
    optional = '?';
    rest = rest.slice(0, -1).trim();
  }

  // Check for default value
  let defaultValue = '';
  const eqIndex = rest.indexOf('=');
  if (eqIndex !== -1) {
    defaultValue = ' = ' + rest.slice(eqIndex + 1).trim();
    rest = rest.slice(0, eqIndex).trim();
  }

  return `${name}: ${rest}${optional}${annotations}${constraints}${defaultValue}`;
}

/**
 * Check if a line starts with a keyword
 */
function isKeywordLine(line: string): boolean {
  const keywords = [
    'domain', 'entity', 'behavior', 'type', 'enum',
    'input', 'output', 'preconditions', 'postconditions',
    'invariants', 'temporal', 'security', 'compliance',
    'actors', 'success', 'failure', 'errors',
    'version', 'description', 'lifecycle', 'imports',
  ];

  const firstWord = line.split(/\s+/)[0]?.toLowerCase() || '';
  return keywords.includes(firstWord);
}

/**
 * Format a keyword line
 */
function formatKeywordLine(line: string): string {
  // Ensure space before opening brace
  if (line.includes('{')) {
    return line.replace(/\s*\{/, ' {');
  }

  // Ensure space around colon for key-value pairs
  if (line.includes(':') && !line.includes('{')) {
    const colonIndex = line.indexOf(':');
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    return `${key}: ${value}`;
  }

  return line;
}

/**
 * Format a range within a document
 */
export function formatRange(
  islDoc: ISLDocument,
  document: TextDocument,
  range: Range,
  options: FormattingOptions
): TextEdit[] {
  // For range formatting, we extract the range, format it, and replace
  const text = document.getText(range);
  
  // Determine the base indent level from the start of the range
  const startLine = document.getText({
    start: { line: range.start.line, character: 0 },
    end: range.start,
  });
  const baseIndent = startLine.match(/^(\s*)/)?.[1] || '';
  const baseIndentLevel = options.insertSpaces
    ? Math.floor(baseIndent.length / options.tabSize)
    : baseIndent.length;

  // Format the extracted text
  const state: FormatState = {
    indentLevel: baseIndentLevel,
    indentString: options.insertSpaces ? ' '.repeat(options.tabSize) : '\t',
    options,
  };

  const lines = text.split('\n');
  const formattedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === '') {
      formattedLines.push('');
      continue;
    }

    if (trimmed.startsWith('}')) {
      state.indentLevel = Math.max(baseIndentLevel, state.indentLevel - 1);
    }

    formattedLines.push(formatLine(trimmed, state));

    if (trimmed.endsWith('{')) {
      state.indentLevel++;
    }
  }

  const formatted = formattedLines.join('\n');

  if (formatted === text) {
    return [];
  }

  return [{ range, newText: formatted }];
}
