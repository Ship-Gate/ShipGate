/**
 * Input parsing and validation utilities
 */

import { setFailed, info, warning } from '@actions/core';
import { ActionInputs } from '../types.js';

/**
 * Parse and validate action inputs from environment variables
 */
export function parseInputs(): ActionInputs {
  const inputs: Partial<ActionInputs> = {};

  // Mode
  const mode = process.env.INPUT_MODE?.toLowerCase();
  if (mode === 'check' || mode === 'enforce') {
    inputs.mode = mode;
  } else {
    throw new Error(`Invalid mode: ${mode}. Must be 'check' or 'enforce'`);
  }

  // Threshold
  const thresholdStr = process.env.INPUT_THRESHOLD;
  if (!thresholdStr) {
    throw new Error('Threshold input is required');
  }
  const threshold = parseInt(thresholdStr, 10);
  if (isNaN(threshold) || threshold < 0 || threshold > 100) {
    throw new Error(`Invalid threshold: ${thresholdStr}. Must be between 0 and 100`);
  }
  inputs.threshold = threshold;

  // Config path
  inputs.configPath = process.env.INPUT_CONFIG_PATH || '.islstudio/config.json';

  // Fail on
  const failOn = process.env.INPUT_FAIL_ON?.toLowerCase();
  if (failOn === 'any' || failOn === 'blocker' || failOn === 'none') {
    inputs.failOn = failOn;
  } else {
    throw new Error(`Invalid fail-on: ${failOn}. Must be 'any', 'blocker', or 'none'`);
  }

  // GitHub token
  inputs.token = process.env.GITHUB_TOKEN || '';
  if (!inputs.token) {
    warning('GITHUB_TOKEN not found. PR comments and check runs will be disabled.');
    inputs.enableComment = false;
    inputs.enableCheckRun = false;
  } else {
    inputs.enableComment = true;
    inputs.enableCheckRun = true;
  }

  // Repository path
  inputs.repositoryPath = process.env.GITHUB_WORKSPACE || process.cwd();

  // Changed files only (default: true for PR events)
  const eventName = process.env.GITHUB_EVENT_NAME;
  inputs.changedOnly = eventName === 'pull_request' && 
    (process.env.INPUT_CHANGED_ONLY !== 'false');

  // Enable outputs based on context
  if (eventName !== 'pull_request') {
    info('Not a pull request event. PR comments will be disabled.');
    inputs.enableComment = false;
  }

  return inputs as ActionInputs;
}

/**
 * Validate that required inputs are present
 */
export function validateInputs(inputs: ActionInputs): void {
  if (!inputs.token && (inputs.enableComment || inputs.enableCheckRun)) {
    throw new Error('GitHub token is required for PR comments and check runs');
  }

  if (inputs.threshold < 0 || inputs.threshold > 100) {
    throw new Error('Threshold must be between 0 and 100');
  }

  info(`Inputs validated:`);
  info(`  Mode: ${inputs.mode}`);
  info(`  Threshold: ${inputs.threshold}`);
  info(`  Config path: ${inputs.configPath}`);
  info(`  Fail on: ${inputs.failOn}`);
  info(`  Changed only: ${inputs.changedOnly}`);
  info(`  Enable comment: ${inputs.enableComment}`);
  info(`  Enable check run: ${inputs.enableCheckRun}`);
}
