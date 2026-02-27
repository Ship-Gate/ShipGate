/**
 * GitHub Annotations
 * 
 * Creates GitHub annotations for errors and warnings.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as path from 'path';

import type { Diagnostic } from './reporter.js';

// ============================================================================
// Types
// ============================================================================

interface AnnotationProperties {
  title?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
}

// ============================================================================
// Annotation Creator
// ============================================================================

/**
 * Create GitHub annotations for all diagnostics
 */
export async function createAnnotations(
  errors: Diagnostic[],
  warnings: Diagnostic[]
): Promise<void> {
  const context = github.context;
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();

  core.info(`Creating ${errors.length} error annotations and ${warnings.length} warning annotations`);

  // Create error annotations
  for (const error of errors) {
    const props = createAnnotationProperties(error, workspace);
    core.error(error.message, {
      ...props,
      title: `${error.code}: ${getTitleFromMessage(error.message)}`,
    });
  }

  // Create warning annotations
  for (const warning of warnings) {
    const props = createAnnotationProperties(warning, workspace);
    core.warning(warning.message, {
      ...props,
      title: `${warning.code}: ${getTitleFromMessage(warning.message)}`,
    });
  }

  // If running in a PR, also post as check run annotations via API
  if (context.payload.pull_request) {
    await createCheckRunAnnotations(errors, warnings, workspace);
  }
}

/**
 * Create annotation properties from a diagnostic
 */
function createAnnotationProperties(
  diag: Diagnostic,
  workspace: string
): AnnotationProperties {
  // Get relative file path
  let filePath = diag.file;
  if (path.isAbsolute(filePath)) {
    filePath = path.relative(workspace, filePath);
  }

  return {
    file: filePath,
    startLine: diag.line,
    endLine: diag.endLine ?? diag.line,
    startColumn: diag.column,
    endColumn: diag.endColumn ?? diag.column,
  };
}

/**
 * Extract a short title from a message
 */
function getTitleFromMessage(message: string): string {
  // Take first sentence or first 50 chars
  const firstSentence = message.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length <= 60) {
    return firstSentence;
  }
  return message.substring(0, 57) + '...';
}

/**
 * Create check run annotations via GitHub API
 * This provides richer annotations in the PR checks tab
 */
async function createCheckRunAnnotations(
  errors: Diagnostic[],
  warnings: Diagnostic[],
  workspace: string
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.debug('No GITHUB_TOKEN, skipping check run annotations');
    return;
  }

  const octokit = github.getOctokit(token);
  const context = github.context;

  // Build annotations array
  const annotations: Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'failure' | 'warning' | 'notice';
    message: string;
    title: string;
    raw_details?: string;
  }> = [];

  // Add errors
  for (const error of errors.slice(0, 50)) { // GitHub limits to 50 annotations per API call
    let filePath = error.file;
    if (path.isAbsolute(filePath)) {
      filePath = path.relative(workspace, filePath);
    }

    annotations.push({
      path: filePath,
      start_line: error.line,
      end_line: error.endLine ?? error.line,
      annotation_level: 'failure',
      message: error.message,
      title: `${error.code}: ${getTitleFromMessage(error.message)}`,
      raw_details: error.context,
    });
  }

  // Add warnings
  for (const warning of warnings.slice(0, 50 - annotations.length)) {
    let filePath = warning.file;
    if (path.isAbsolute(filePath)) {
      filePath = path.relative(workspace, filePath);
    }

    annotations.push({
      path: filePath,
      start_line: warning.line,
      end_line: warning.endLine ?? warning.line,
      annotation_level: 'warning',
      message: warning.message,
      title: `${warning.code}: ${getTitleFromMessage(warning.message)}`,
      raw_details: warning.context,
    });
  }

  if (annotations.length === 0) {
    return;
  }

  try {
    // Get the check run ID if we're in one
    const checkRunId = process.env.GITHUB_RUN_ID;
    
    if (checkRunId && context.payload.pull_request) {
      // Update the check run with annotations
      await octokit.rest.checks.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        check_run_id: parseInt(checkRunId, 10),
        output: {
          title: 'ISL Verification',
          summary: `Found ${errors.length} errors and ${warnings.length} warnings`,
          annotations,
        },
      });
      
      core.debug(`Added ${annotations.length} annotations to check run`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.debug(`Failed to create check run annotations: ${message}`);
    // Don't fail the action for annotation errors
  }
}

/**
 * Create a single annotation
 */
export function createAnnotation(
  type: 'error' | 'warning' | 'notice',
  message: string,
  options: AnnotationProperties
): void {
  switch (type) {
    case 'error':
      core.error(message, options);
      break;
    case 'warning':
      core.warning(message, options);
      break;
    case 'notice':
      core.notice(message, options);
      break;
  }
}

/**
 * Group diagnostics by file for cleaner output
 */
export function groupDiagnosticsByFile(
  diagnostics: Diagnostic[]
): Map<string, Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>();
  
  for (const diag of diagnostics) {
    const existing = grouped.get(diag.file) || [];
    existing.push(diag);
    grouped.set(diag.file, existing);
  }
  
  return grouped;
}
