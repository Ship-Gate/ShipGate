import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { installHook, uninstallHook, initProvenanceSession } from './pre-commit.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-test-'));
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'pipe' });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('installHook', () => {
  it('installs the prepare-commit-msg hook', () => {
    const result = installHook(tmpDir);
    expect(result.installed).toBe(true);
    expect(result.hookPath).toContain('prepare-commit-msg');

    const hookContent = fs.readFileSync(result.hookPath, 'utf8');
    expect(hookContent).toContain('shipgate-provenance-hook');
    expect(hookContent).toContain('AI_TOOL');
  });

  it('reports already installed on second call', () => {
    installHook(tmpDir);
    const result = installHook(tmpDir);
    expect(result.installed).toBe(true);
    expect(result.message).toContain('already installed');
  });

  it('returns false for non-git directory', () => {
    const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    try {
      const result = installHook(nonGit);
      expect(result.installed).toBe(false);
      expect(result.message).toContain('Not a git repository');
    } finally {
      fs.rmSync(nonGit, { recursive: true, force: true });
    }
  });
});

describe('uninstallHook', () => {
  it('removes an installed hook', () => {
    installHook(tmpDir);
    const result = uninstallHook(tmpDir);
    expect(result.removed).toBe(true);
  });

  it('returns false when no hook is installed', () => {
    const result = uninstallHook(tmpDir);
    expect(result.removed).toBe(false);
  });
});

describe('initProvenanceSession', () => {
  it('creates .shipgate/provenance.json', () => {
    const result = initProvenanceSession(tmpDir, 'cursor', 'claude-sonnet-4');
    expect(result.session.generator).toBe('cursor');
    expect(result.session.model).toBe('claude-sonnet-4');

    const sessionPath = path.join(tmpDir, '.shipgate', 'provenance.json');
    expect(fs.existsSync(sessionPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    expect(content.generator).toBe('cursor');
  });

  it('preserves existing session start time on update', () => {
    const first = initProvenanceSession(tmpDir, 'cursor');
    const second = initProvenanceSession(tmpDir, 'copilot');

    expect(second.session.generator).toBe('copilot');
    expect(second.session.sessionStarted).toBe(first.session.sessionStarted);
  });
});

describe('end-to-end hook flow', () => {
  it('installs hook and verifies commit can be made', () => {
    installHook(tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello\n');
    execSync('git add test.txt', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "test commit"', { cwd: tmpDir, stdio: 'pipe' });

    const log = execSync('git log -1 --format=%B', { cwd: tmpDir, encoding: 'utf8' });
    expect(log).toContain('test commit');
  });
});
