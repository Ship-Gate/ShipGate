/**
 * ISL Adapters - GitHub Context
 * 
 * Detects and parses GitHub Actions context from environment.
 * 
 * @module @isl-lang/adapters/github
 */

import type { GitHubContext } from './types.js';

/**
 * Check if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

/**
 * Get GitHub Actions context from environment
 */
export function getGitHubContext(): GitHubContext | null {
  if (!isGitHubActions()) {
    return null;
  }

  const context: GitHubContext = {
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    ref: process.env.GITHUB_REF ?? '',
    workflow: process.env.GITHUB_WORKFLOW ?? '',
    action: process.env.GITHUB_ACTION ?? '',
    actor: process.env.GITHUB_ACTOR ?? '',
    job: process.env.GITHUB_JOB ?? '',
    runNumber: parseInt(process.env.GITHUB_RUN_NUMBER ?? '0', 10),
    runId: parseInt(process.env.GITHUB_RUN_ID ?? '0', 10),
    repository: process.env.GITHUB_REPOSITORY ?? '',
    repositoryOwner: process.env.GITHUB_REPOSITORY_OWNER ?? '',
  };

  // Parse PR context if available
  if (context.eventName === 'pull_request' || context.eventName === 'pull_request_target') {
    const prNumber = parseInt(process.env.GITHUB_PR_NUMBER ?? '0', 10);
    if (prNumber > 0) {
      context.pullRequest = {
        number: prNumber,
        head: {
          sha: process.env.GITHUB_HEAD_SHA ?? context.sha,
          ref: process.env.GITHUB_HEAD_REF ?? '',
        },
        base: {
          sha: process.env.GITHUB_BASE_SHA ?? '',
          ref: process.env.GITHUB_BASE_REF ?? '',
        },
      };
    }
  }

  return context;
}

/**
 * Get repository owner and name
 */
export function parseRepository(repository: string): { owner: string; repo: string } | null {
  const parts = repository.split('/');
  if (parts.length !== 2) {
    return null;
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

/**
 * Check if this is a pull request event
 */
export function isPullRequest(): boolean {
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  return eventName === 'pull_request' || eventName === 'pull_request_target';
}

/**
 * Get PR number from environment
 */
export function getPRNumber(): number | null {
  const prNumber = process.env.GITHUB_PR_NUMBER;
  if (prNumber) {
    return parseInt(prNumber, 10);
  }
  
  // Try to extract from ref
  const ref = process.env.GITHUB_REF ?? '';
  const match = ref.match(/refs\/pull\/(\d+)/);
  if (match) {
    return parseInt(match[1]!, 10);
  }
  
  return null;
}

/**
 * Set GitHub Actions output
 */
export function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const fs = require('fs');
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  } else {
    // Fallback for older Actions runtime
    process.stdout.write(`::set-output name=${name}::${value}\n`);
  }
}

/**
 * Set GitHub Actions failed status
 */
export function setFailed(message: string): void {
  process.stdout.write(`::error::${message}\n`);
  process.exitCode = 1;
}

/**
 * Log info message
 */
export function logInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Log warning message
 */
export function logWarning(message: string): void {
  process.stdout.write(`::warning::${message}\n`);
}

/**
 * Log error message
 */
export function logError(message: string): void {
  process.stdout.write(`::error::${message}\n`);
}

/**
 * Start a log group
 */
export function startGroup(name: string): void {
  process.stdout.write(`::group::${name}\n`);
}

/**
 * End a log group
 */
export function endGroup(): void {
  process.stdout.write('::endgroup::\n');
}
