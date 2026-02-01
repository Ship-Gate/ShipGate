/**
 * CLI Utilities
 * 
 * Helper functions for the ISL CLI.
 */

import { readdir } from 'fs/promises';
import { dirname, basename, extname, join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// String Similarity (Levenshtein Distance)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity (0-1 score)
 */
export function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

/**
 * Find closest match from a list of candidates
 */
export function findClosestMatch(input: string, candidates: string[], threshold = 0.4): string | null {
  let bestMatch: string | null = null;
  let bestScore = threshold;
  
  for (const candidate of candidates) {
    const score = stringSimilarity(input, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

/**
 * Find all matches above threshold, sorted by similarity
 */
export function findSimilarMatches(input: string, candidates: string[], threshold = 0.3, maxResults = 3): string[] {
  const matches = candidates
    .map(candidate => ({ candidate, score: stringSimilarity(input, candidate) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ candidate }) => candidate);
  
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// File Suggestions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find similar files in the same directory
 */
export async function findSimilarFiles(filePath: string): Promise<string[]> {
  try {
    const dir = dirname(filePath);
    const file = basename(filePath);
    const ext = extname(filePath);
    
    const files = await readdir(dir);
    
    // Filter to same extension and find similar names
    const sameExtFiles = files.filter(f => extname(f) === ext);
    const matches = findSimilarMatches(file, sameExtFiles, 0.3, 3);
    
    return matches.map(f => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Find ISL files in directory
 */
export async function findISLFilesInDir(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files
      .filter(f => f.endsWith('.isl'))
      .map(f => join(dir, f));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Snippet Formatting
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeLocation {
  line: number;
  column: number;
}

/**
 * Extract lines around a location from source code
 */
export function extractCodeContext(
  source: string,
  location: CodeLocation,
  contextLines = 2
): { lines: string[]; startLine: number; highlightLine: number; highlightColumn: number } {
  const allLines = source.split('\n');
  const { line, column } = location;
  
  const startLine = Math.max(1, line - contextLines);
  const endLine = Math.min(allLines.length, line + contextLines);
  
  const lines = allLines.slice(startLine - 1, endLine);
  
  return {
    lines,
    startLine,
    highlightLine: line - startLine + 1,
    highlightColumn: column,
  };
}

/**
 * Format code snippet with line numbers and error caret
 */
export function formatCodeSnippet(
  source: string,
  location: CodeLocation,
  contextLines = 2
): string[] {
  const { lines, startLine, highlightLine, highlightColumn } = extractCodeContext(source, location, contextLines);
  const result: string[] = [];
  
  const maxLineNum = startLine + lines.length - 1;
  const lineNumWidth = String(maxLineNum).length;
  
  lines.forEach((line, idx) => {
    const lineNum = startLine + idx;
    const isErrorLine = idx === highlightLine - 1;
    const lineNumStr = String(lineNum).padStart(lineNumWidth, ' ');
    
    if (isErrorLine) {
      result.push(`  ${lineNumStr} │ ${line}`);
      // Add caret pointer
      const caretLine = ' '.repeat(lineNumWidth + 4 + Math.max(0, highlightColumn - 1)) + '^';
      result.push(caretLine);
    } else {
      result.push(`  ${lineNumStr} │ ${line}`);
    }
  });
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// TTY Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if running in a TTY environment
 */
export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.TRAVIS
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Pluralize a word
 */
export function plural(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural ?? `${singular}s`;
}

/**
 * Format count with plural noun
 */
export function formatCount(count: number, noun: string, pluralNoun?: string): string {
  return `${count} ${plural(count, noun, pluralNoun)}`;
}
