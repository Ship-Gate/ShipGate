/**
 * Unit tests for input parsing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseInputs, validateInputs } from '../src/utils/inputs.js';

describe('parseInputs', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.INPUT_MODE;
    delete process.env.INPUT_THRESHOLD;
    delete process.env.INPUT_CONFIG_PATH;
    delete process.env.INPUT_FAIL_ON;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_WORKSPACE;
    delete process.env.GITHUB_EVENT_NAME;
  });

  it('should parse valid inputs', () => {
    process.env.INPUT_MODE = 'enforce';
    process.env.INPUT_THRESHOLD = '80';
    process.env.INPUT_CONFIG_PATH = '.islstudio/config.json';
    process.env.INPUT_FAIL_ON = 'blocker';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_WORKSPACE = '/github/workspace';
    process.env.GITHUB_EVENT_NAME = 'pull_request';

    const inputs = parseInputs();

    expect(inputs.mode).toBe('enforce');
    expect(inputs.threshold).toBe(80);
    expect(inputs.configPath).toBe('.islstudio/config.json');
    expect(inputs.failOn).toBe('blocker');
    expect(inputs.token).toBe('test-token');
    expect(inputs.repositoryPath).toBe('/github/workspace');
    expect(inputs.changedOnly).toBe(true);
    expect(inputs.enableComment).toBe(true);
    expect(inputs.enableCheckRun).toBe(true);
  });

  it('should throw error for invalid mode', () => {
    process.env.INPUT_MODE = 'invalid';
    process.env.INPUT_THRESHOLD = '80';
    process.env.INPUT_FAIL_ON = 'blocker';

    expect(() => parseInputs()).toThrow('Invalid mode: invalid');
  });

  it('should throw error for invalid threshold', () => {
    process.env.INPUT_MODE = 'enforce';
    process.env.INPUT_THRESHOLD = 'invalid';
    process.env.INPUT_FAIL_ON = 'blocker';

    expect(() => parseInputs()).toThrow('Invalid threshold: invalid');
  });

  it('should throw error for threshold out of range', () => {
    process.env.INPUT_MODE = 'enforce';
    process.env.INPUT_THRESHOLD = '150';
    process.env.INPUT_FAIL_ON = 'blocker';

    expect(() => parseInputs()).toThrow('Invalid threshold: 150');
  });

  it('should disable comments without token', () => {
    process.env.INPUT_MODE = 'enforce';
    process.env.INPUT_THRESHOLD = '80';
    process.env.INPUT_FAIL_ON = 'blocker';
    delete process.env.GITHUB_TOKEN;

    const inputs = parseInputs();

    expect(inputs.enableComment).toBe(false);
    expect(inputs.enableCheckRun).toBe(false);
  });

  it('should disable comments for non-PR events', () => {
    process.env.INPUT_MODE = 'enforce';
    process.env.INPUT_THRESHOLD = '80';
    process.env.INPUT_FAIL_ON = 'blocker';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_EVENT_NAME = 'push';

    const inputs = parseInputs();

    expect(inputs.enableComment).toBe(false);
    expect(inputs.enableCheckRun).toBe(true);
  });
});

describe('validateInputs', () => {
  it('should validate correct inputs', () => {
    const inputs = {
      mode: 'enforce' as const,
      threshold: 80,
      configPath: '.islstudio/config.json',
      failOn: 'blocker' as const,
      token: 'test-token',
      repositoryPath: '/github/workspace',
      changedOnly: true,
      enableComment: true,
      enableCheckRun: true,
    };

    expect(() => validateInputs(inputs)).not.toThrow();
  });

  it('should throw error when token is required but not provided', () => {
    const inputs = {
      mode: 'enforce' as const,
      threshold: 80,
      configPath: '.islstudio/config.json',
      failOn: 'blocker' as const,
      token: '',
      repositoryPath: '/github/workspace',
      changedOnly: true,
      enableComment: true,
      enableCheckRun: true,
    };

    expect(() => validateInputs(inputs)).toThrow('GitHub token is required');
  });
});
