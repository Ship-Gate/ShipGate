/**
 * Integration tests for mock detector
 */

import { describe, it, expect } from 'vitest';
import { scanFile, calculateSummary } from '../src/detector.js';
import { isAllowlisted } from '../src/allowlist.js';
import type { MockDetectorConfig } from '../src/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Integration tests', () => {
  const config: MockDetectorConfig = {
    allowlist: [],
    checkDevPaths: true,
    minConfidence: 0.5,
  };

  it('should scan fixture files', () => {
    const fixturePath = path.join(__dirname, 'fixtures/should-flag/hardcoded-success.ts');
    if (fs.existsSync(fixturePath)) {
      const content = fs.readFileSync(fixturePath, 'utf-8');
      const findings = scanFile({
        filePath: fixturePath,
        content,
        config,
      });

      expect(findings.length).toBeGreaterThan(0);
    }
  });

  it('should allowlist test files', () => {
    expect(isAllowlisted('src/services/user.test.ts', [])).toBe(true);
    expect(isAllowlisted('src/mocks/users.ts', [])).toBe(true);
    expect(isAllowlisted('tests/fixtures/data.ts', [])).toBe(true);
    expect(isAllowlisted('src/components/UserCard.stories.tsx', [])).toBe(true);
  });

  it('should NOT allowlist production files', () => {
    expect(isAllowlisted('src/services/user.ts', [])).toBe(false);
    expect(isAllowlisted('src/api/handler.ts', [])).toBe(false);
    expect(isAllowlisted('src/utils/data.ts', [])).toBe(false);
  });
});
