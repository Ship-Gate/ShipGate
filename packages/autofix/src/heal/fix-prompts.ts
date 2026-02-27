/**
 * Category-Specific Fix Prompts
 *
 * Each prompt sends ONLY relevant context, not entire files.
 * Returns a surgical diff or minimal patch, not a full file rewrite.
 */

import type { AnalyzedFailure, RootCauseCategory } from './types.js';

const INSTRUCTIONS_COMMON = `
RULES:
1. Return ONLY a surgical diff or the minimal changed lines — NOT the entire file
2. Do NOT modify lines that are correct (see "Do not modify" list)
3. Use unified diff format if possible, or return JSON: { "path": "file.ts", "diff": "..." }
4. No explanations, no markdown fences around code
`;

/**
 * Build a targeted fix prompt for a single failure
 */
export function buildFixPrompt(
  failure: AnalyzedFailure,
  options: {
    islContent?: string;
    packageJson?: string;
    manifestPaths?: string[];
    typeContext?: string;
  } = {},
): string {
  const sections: string[] = [];

  sections.push(`# Fix: ${failure.category}`);
  sections.push(`File: ${failure.file}`);
  sections.push(`Error: ${failure.message}`);
  if (failure.location) {
    sections.push(`Location: line ${failure.location.line}${failure.location.column ? `, col ${failure.location.column}` : ''}`);
  }

  if (failure.doNotModifyLines && failure.doNotModifyLines.length > 0) {
    sections.push(`\n## Do NOT modify these lines (they are correct): ${failure.doNotModifyLines.join(', ')}`);
  }

  switch (failure.category) {
    case 'IMPORT_ERROR':
      return buildImportErrorPrompt(failure, sections, options);
    case 'TYPE_ERROR':
      return buildTypeErrorPrompt(failure, sections, options);
    case 'MISSING_IMPLEMENTATION':
      return buildMissingImplPrompt(failure, sections, options);
    case 'AUTH_MISSING':
      return buildAuthMissingPrompt(failure, sections, options);
    case 'TEST_FAILURE':
      return buildTestFailurePrompt(failure, sections, options);
    case 'SPEC_MISMATCH':
      return buildSpecMismatchPrompt(failure, sections, options);
    default:
      return buildUnknownPrompt(failure, sections, options);
  }
}

function buildImportErrorPrompt(
  failure: AnalyzedFailure,
  sections: string[],
  options: { manifestPaths?: string[]; packageJson?: string },
): string {
  sections.push('\n## Fix: Check manifest, add missing file, or fix import path');
  if (failure.unresolvedImport) {
    sections.push(`Unresolved: ${failure.unresolvedImport}`);
  }
  if (failure.contextSnippet) {
    sections.push('\n## Relevant code (import section):');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  if (options.manifestPaths?.length) {
    sections.push(`\nKnown paths: ${options.manifestPaths.join(', ')}`);
  }
  if (options.packageJson) {
    sections.push('\n## package.json exports (if relevant):');
    sections.push('```json');
    sections.push(options.packageJson.slice(0, 500));
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  sections.push('Return a unified diff or JSON with path + diff.');
  return sections.join('\n');
}

function buildTypeErrorPrompt(
  failure: AnalyzedFailure,
  sections: string[],
  options: { typeContext?: string },
): string {
  sections.push('\n## Fix: Align types — send only the type error context + relevant type definitions');
  if (failure.typeContext) {
    sections.push('\n## Type definitions:');
    sections.push('```');
    sections.push(failure.typeContext);
    sections.push('```');
  }
  if (options.typeContext) {
    sections.push('\n## Additional type context:');
    sections.push('```');
    sections.push(options.typeContext);
    sections.push('```');
  }
  if (failure.contextSnippet) {
    sections.push('\n## Code at error location:');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  return sections.join('\n');
}

function buildMissingImplPrompt(
  failure: AnalyzedFailure,
  sections: string[],
  options: { islContent?: string },
): string {
  sections.push('\n## Fix: Implement the function — send function signature + ISL behavior it should implement');
  if (failure.implementationContext) {
    sections.push(`\nSignature: ${failure.implementationContext.signature}`);
    if (failure.implementationContext.islBehavior) {
      sections.push(`\nISL behavior:\n${failure.implementationContext.islBehavior}`);
    }
  }
  if (failure.contextSnippet) {
    sections.push('\n## Current stub:');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  if (options.islContent) {
    sections.push('\n## ISL spec (relevant behavior):');
    sections.push('```isl');
    sections.push(options.islContent.slice(0, 1500));
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  return sections.join('\n');
}

function buildAuthMissingPrompt(
  failure: AnalyzedFailure,
  sections: string[],
  _options: Record<string, unknown>,
): string {
  sections.push('\n## Fix: Add middleware import + wrapper for protected route');
  if (failure.routePath) {
    sections.push(`Route: ${failure.routePath}`);
  }
  if (failure.contextSnippet) {
    sections.push('\n## Current route handler:');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  sections.push('\nAdd: import auth middleware, wrap handler. Match existing protected routes pattern.');
  sections.push(INSTRUCTIONS_COMMON);
  return sections.join('\n');
}

function buildTestFailurePrompt(
  failure: AnalyzedFailure,
  sections: string[],
  _options: Record<string, unknown>,
): string {
  sections.push('\n## Fix: Send test + source function + error output');
  if (failure.testOutput) {
    sections.push('\n## Test output:');
    sections.push('```');
    sections.push(failure.testOutput);
    sections.push('```');
  }
  if (failure.contextSnippet) {
    sections.push('\n## Failing test or source:');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  return sections.join('\n');
}

function buildSpecMismatchPrompt(
  failure: AnalyzedFailure,
  sections: string[],
  options: { islContent?: string },
): string {
  sections.push('\n## Fix: Align code with ISL contract — send ISL contract + current code + specific mismatch');
  if (failure.islContract) {
    sections.push('\n## ISL contract:');
    sections.push('```isl');
    sections.push(failure.islContract);
    sections.push('```');
  }
  if (options.islContent) {
    sections.push('\n## Full ISL spec:');
    sections.push('```isl');
    sections.push(options.islContent.slice(0, 2000));
    sections.push('```');
  }
  if (failure.contextSnippet) {
    sections.push('\n## Current code:');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  return sections.join('\n');
}

function buildUnknownPrompt(
  failure: AnalyzedFailure,
  sections: string[],
  options: { islContent?: string },
): string {
  sections.push('\n## Fix: Address the error with minimal changes');
  if (failure.contextSnippet) {
    sections.push('\n## Relevant code:');
    sections.push('```');
    sections.push(failure.contextSnippet);
    sections.push('```');
  }
  if (options.islContent) {
    sections.push('\n## ISL spec (for context):');
    sections.push('```isl');
    sections.push(options.islContent.slice(0, 1000));
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  return sections.join('\n');
}

/**
 * Build a batch prompt for multiple failures of the same category
 */
export function buildBatchFixPrompt(
  failures: AnalyzedFailure[],
  category: RootCauseCategory,
  options: { islContent?: string },
): string {
  const sections: string[] = [];
  sections.push(`# Fix ${failures.length} ${category} failure(s)`);
  for (const f of failures) {
    sections.push(`\n## ${f.file}`);
    sections.push(`Error: ${f.message}`);
    if (f.contextSnippet) {
      sections.push('```');
      sections.push(f.contextSnippet);
      sections.push('```');
    }
  }
  if (options.islContent) {
    sections.push('\n## ISL spec:');
    sections.push('```isl');
    sections.push(options.islContent.slice(0, 1500));
    sections.push('```');
  }
  sections.push(INSTRUCTIONS_COMMON);
  sections.push('Return a JSON array: [{ "path": "file.ts", "diff": "unified diff or full replacement" }]');
  return sections.join('\n');
}
