/**
 * Acceptance Test: Malicious Code Blocking
 * 
 * Verifies that malicious sample implementations attempting filesystem/network
 * access are blocked or require explicit unsafe mode.
 */

import { describe, it, expect } from 'vitest';
import { createSandboxRunner } from './index.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Acceptance Test: Malicious Code Blocking', () => {
  const workDir = join(tmpdir(), 'isl-sandbox-acceptance');

  beforeEach(async () => {
    await mkdir(workDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should block filesystem access outside work directory (worker mode)', async () => {
    const sandbox = createSandboxRunner({
      mode: 'worker',
      timeout: 5000,
      allowFilesystem: false,
      allowedEnvVars: ['PATH'],
    });

    // Create a malicious script that tries to read /etc/passwd
    const maliciousScript = join(workDir, 'malicious.js');
    await writeFile(
      maliciousScript,
      `
      const fs = require('fs');
      try {
        const content = fs.readFileSync('/etc/passwd', 'utf-8');
        console.log('SUCCESS: Read /etc/passwd');
        console.log(content.substring(0, 100));
      } catch (error) {
        console.log('BLOCKED: ' + error.message);
      }
    `
    );

    const result = await sandbox.execute('node', [maliciousScript], {
      cwd: workDir,
      env: { PATH: process.env.PATH },
    });

    // Should be blocked
    expect(result.stdout).toContain('BLOCKED');
    expect(result.stdout).not.toContain('SUCCESS');
    expect(result.stdout).not.toContain('/etc/passwd');

    await sandbox.cleanup();
  }, 15000);

  it('should block network access (worker mode)', async () => {
    const sandbox = createSandboxRunner({
      mode: 'worker',
      timeout: 5000,
      allowNetwork: false,
      allowedEnvVars: ['PATH'],
    });

    // Create a malicious script that tries to make HTTP request
    const maliciousScript = join(workDir, 'malicious.js');
    await writeFile(
      maliciousScript,
      `
      const http = require('http');
      try {
        const req = http.get('http://example.com', (res) => {
          console.log('SUCCESS: Network request made');
        });
        req.on('error', (error) => {
          console.log('BLOCKED: ' + error.message);
        });
        setTimeout(() => {
          req.destroy();
          if (!req.destroyed) {
            console.log('BLOCKED: Request timeout');
          }
        }, 1000);
      } catch (error) {
        console.log('BLOCKED: ' + error.message);
      }
    `
    );

    const result = await sandbox.execute('node', [maliciousScript], {
      cwd: workDir,
      env: { PATH: process.env.PATH },
    });

    // Should be blocked or timeout
    expect(result.stdout).toMatch(/BLOCKED|timeout/i);
    expect(result.stdout).not.toContain('SUCCESS');

    await sandbox.cleanup();
  }, 15000);

  it('should enforce timeout limits', async () => {
    const sandbox = createSandboxRunner({
      mode: 'worker',
      timeout: 1000, // 1 second timeout
      allowedEnvVars: ['PATH'],
    });

    // Create a script that runs forever
    const infiniteScript = join(workDir, 'infinite.js');
    await writeFile(
      infiniteScript,
      `
      while (true) {
        // Infinite loop
      }
    `
    );

    const result = await sandbox.execute('node', [infiniteScript], {
      cwd: workDir,
      env: { PATH: process.env.PATH },
    });

    // Should timeout
    expect(result.timedOut).toBe(true);
    expect(result.success).toBe(false);

    await sandbox.cleanup();
  }, 15000);

  it('should filter environment variables', async () => {
    const sandbox = createSandboxRunner({
      mode: 'worker',
      timeout: 5000,
      allowedEnvVars: ['NODE_ENV', 'PATH'],
    });

    // Create a script that tries to access SECRET_KEY
    const script = join(workDir, 'env-test.js');
    await writeFile(
      script,
      `
      console.log('SECRET_KEY:', process.env.SECRET_KEY || 'not found');
      console.log('NODE_ENV:', process.env.NODE_ENV || 'not found');
    `
    );

    const result = await sandbox.execute('node', [script], {
      cwd: workDir,
      env: {
        SECRET_KEY: 'should-be-hidden',
        NODE_ENV: 'test',
        PATH: process.env.PATH,
      },
    });

    // SECRET_KEY should not be accessible
    expect(result.stdout).toContain('SECRET_KEY: not found');
    // NODE_ENV should be accessible (in allowlist)
    expect(result.stdout).toContain('NODE_ENV: test');
    expect(result.stdout).not.toContain('should-be-hidden');

    await sandbox.cleanup();
  }, 15000);

  it('should mask secrets in output', async () => {
    const sandbox = createSandboxRunner({
      mode: 'worker',
      timeout: 5000,
      allowedEnvVars: ['PATH'],
    });

    // Create a script that outputs secrets
    const script = join(workDir, 'secrets.js');
    await writeFile(
      script,
      `
      console.log('API_KEY=sk_live_1234567890abcdef');
      console.log('password=mySecretPassword123');
      console.log('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjg');
    `
    );

    const result = await sandbox.execute('node', [script], {
      cwd: workDir,
      env: { PATH: process.env.PATH },
    });

    // Secrets should be masked
    expect(result.maskedStdout).toBeDefined();
    expect(result.maskedStdout).toContain('***');
    expect(result.maskedStdout).not.toContain('sk_live_1234567890abcdef');
    expect(result.maskedStdout).not.toContain('mySecretPassword123');
    expect(result.maskedStdout).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');

    await sandbox.cleanup();
  }, 15000);

  it('should allow filesystem access when allowFilesystem is true', async () => {
    const sandbox = createSandboxRunner({
      mode: 'worker',
      timeout: 5000,
      allowFilesystem: true,
      allowedEnvVars: ['PATH'],
    });

    // Create a script that reads a file in work directory
    const testFile = join(workDir, 'test.txt');
    await writeFile(testFile, 'test content');

    const script = join(workDir, 'read-file.js');
    await writeFile(
      script,
      `
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, 'test.txt'), 'utf-8');
      console.log('Content:', content);
    `
    );

    const result = await sandbox.execute('node', [script], {
      cwd: workDir,
      env: { PATH: process.env.PATH },
    });

    // Should be able to read file in work directory
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('test content');

    await sandbox.cleanup();
  }, 15000);
});
