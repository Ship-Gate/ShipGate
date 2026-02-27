// ============================================================================
// Parse @isl-bindings blocks from implementation code
// ============================================================================

import type { BindingEntry, ParsedBindings } from './types.js';

/**
 * Regex to match @isl-bindings block in comments
 * Supports both single-line and multi-line comment formats
 */
const BINDINGS_BLOCK_REGEX = /\/\*\*?[\s\S]*?@isl-bindings([\s\S]*?)\*\/|\/\/\s*@isl-bindings\s*\n((?:\/\/.*\n)*)/g;

/**
 * Regex to match individual binding entries
 * Format: clauseId -> type:location [description]
 */
const BINDING_ENTRY_REGEX = /^\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*->\s*(guard|assert|test):([^\s\[]+)(?:\s*\[(.*?)\])?\s*$/;

/**
 * Regex to match spec file declaration
 * Format: @spec path/to/file.isl
 */
const SPEC_REGEX = /@spec\s+([^\s]+)/;

/**
 * Parse @isl-bindings blocks from source code
 */
export function parseBindings(sourceCode: string): ParsedBindings | null {
  const bindings = new Map<string, BindingEntry[]>();
  let specFile: string | undefined;
  let rawBlocks: string[] = [];

  // Reset regex state
  BINDINGS_BLOCK_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BINDINGS_BLOCK_REGEX.exec(sourceCode)) !== null) {
    // Get content from either multi-line or single-line format
    const blockContent = match[1] || 
      (match[2] ? match[2].replace(/^\/\/\s*/gm, '') : '');
    
    if (!blockContent.trim()) continue;
    
    rawBlocks.push(blockContent);
    
    // Check for spec file
    const specMatch = SPEC_REGEX.exec(blockContent);
    if (specMatch) {
      specFile = specMatch[1];
    }

    // Parse each line for binding entries
    const lines = blockContent.split('\n');
    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*\s*/, '').trim();
      if (!trimmed || trimmed.startsWith('@')) continue;

      const entryMatch = BINDING_ENTRY_REGEX.exec(trimmed);
      if (entryMatch) {
        const entry: BindingEntry = {
          clauseId: entryMatch[1]!,
          type: entryMatch[2] as 'guard' | 'assert' | 'test',
          location: entryMatch[3]!,
          description: entryMatch[4],
        };

        const existing = bindings.get(entry.clauseId) || [];
        existing.push(entry);
        bindings.set(entry.clauseId, existing);
      }
    }
  }

  // Return null if no bindings found
  if (bindings.size === 0) {
    return null;
  }

  return {
    specFile,
    bindings,
    raw: rawBlocks.join('\n---\n'),
  };
}

/**
 * Check if source code contains @isl-bindings
 */
export function hasBindings(sourceCode: string): boolean {
  BINDINGS_BLOCK_REGEX.lastIndex = 0;
  return BINDINGS_BLOCK_REGEX.test(sourceCode);
}

/**
 * Extract all clause IDs from a parsed bindings object
 */
export function getBindingClauseIds(bindings: ParsedBindings): string[] {
  return Array.from(bindings.bindings.keys());
}

/**
 * Get bindings for a specific clause
 */
export function getClauseBindings(
  bindings: ParsedBindings,
  clauseId: string
): BindingEntry[] {
  return bindings.bindings.get(clauseId) || [];
}

/**
 * Validate binding entries against expected patterns
 */
export function validateBindings(
  bindings: ParsedBindings
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [clauseId, entries] of bindings.bindings) {
    // Check for duplicate locations
    const locations = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.type}:${entry.location}`;
      if (locations.has(key)) {
        errors.push(`Duplicate binding for ${clauseId}: ${key}`);
      }
      locations.add(key);

      // Validate location format
      if (!isValidLocation(entry.location)) {
        errors.push(
          `Invalid location format for ${clauseId}: ${entry.location}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a location string is valid
 * Supports: line numbers (L42), function names, or patterns (fn:name)
 */
function isValidLocation(location: string): boolean {
  // Line number format: L42 or L42-L50
  if (/^L\d+(-L\d+)?$/.test(location)) return true;
  
  // Function reference format: fn:functionName
  if (/^fn:[a-zA-Z_][a-zA-Z0-9_]*$/.test(location)) return true;
  
  // Simple identifier (function name)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(location)) return true;
  
  // Method reference: Class.method
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(location)) return true;

  return false;
}

/**
 * Format bindings for debugging/logging
 */
export function formatBindings(bindings: ParsedBindings): string {
  const lines: string[] = [];
  
  if (bindings.specFile) {
    lines.push(`@spec ${bindings.specFile}`);
  }
  
  lines.push(`Bindings (${bindings.bindings.size} clauses):`);
  
  for (const [clauseId, entries] of bindings.bindings) {
    for (const entry of entries) {
      const desc = entry.description ? ` [${entry.description}]` : '';
      lines.push(`  ${clauseId} -> ${entry.type}:${entry.location}${desc}`);
    }
  }
  
  return lines.join('\n');
}
