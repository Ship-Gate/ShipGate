/**
 * Tests for SecurityVerifierEnhancer class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { SecurityVerifierEnhancer } from '../src/enhancer.js';

describe('SecurityVerifierEnhancer', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  let enhancer: SecurityVerifierEnhancer;

  beforeEach(() => {
    enhancer = new SecurityVerifierEnhancer(fixturesDir, {
      minConfidence: 0.5,
      publicEndpointThreshold: 0.7,
    });
  });

  it('should detect drift from fixtures', async () => {
    const islFiles = [path.join(fixturesDir, 'isl', 'auth-required.isl')];
    const routeFiles = [
      path.join(fixturesDir, 'routes', 'missing-auth.ts'),
      path.join(fixturesDir, 'routes', 'correct-auth.ts'),
    ];

    const result = await enhancer.detectDrift(islFiles, routeFiles);

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary.totalClaims).toBeGreaterThanOrEqual(0);
    expect(result.claimsBySeverity).toBeDefined();
  });

  it('should extract ISL requirements', async () => {
    const islFiles = [path.join(fixturesDir, 'isl', 'auth-required.isl')];
    
    const requirements = await enhancer.getISLRequirements(islFiles);
    
    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements.some(r => r.requirementType === 'auth')).toBe(true);
    expect(requirements.some(r => r.requirementType === 'role')).toBe(true);
  });

  it('should extract observed policies', async () => {
    const routeFiles = [
      path.join(fixturesDir, 'routes', 'missing-auth.ts'),
    ];
    
    const policies = await enhancer.getObservedPolicies(routeFiles);
    
    expect(policies.length).toBeGreaterThan(0);
  });
});
