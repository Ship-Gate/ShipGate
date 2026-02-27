/**
 * Tests for auth drift detection
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  extractISLAuthRequirements,
  extractObservedAuthPolicies,
  detectAuthDrift,
} from '../src/index.js';

describe('Auth Drift Detector', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  describe('ISL Auth Requirement Extraction', () => {
    it('should extract auth requirements from ISL files', async () => {
      const islPath = path.join(fixturesDir, 'isl', 'auth-required.isl');
      const content = await fs.readFile(islPath, 'utf-8');
      
      const requirements = await extractISLAuthRequirements(islPath, content);
      
      expect(requirements.length).toBeGreaterThan(0);
      
      // Check GetUser requires auth
      const getUserReq = requirements.find(r => r.behaviorName === 'GetUser');
      expect(getUserReq).toBeDefined();
      expect(getUserReq?.requirementType).toBe('auth');
      
      // Check UpdateUser requires role
      const updateUserReq = requirements.find(r => r.behaviorName === 'UpdateUser');
      expect(updateUserReq).toBeDefined();
      expect(updateUserReq?.requirementType).toBe('role');
      expect(updateUserReq?.requiredRoles).toContain('ADMIN');
      
      // Check PublicHealthCheck is public
      const publicReq = requirements.find(r => r.behaviorName === 'PublicHealthCheck');
      expect(publicReq).toBeDefined();
      expect(publicReq?.requirementType).toBe('public');
    });
  });

  describe('Route Auth Policy Extraction', () => {
    it('should detect missing auth in routes', async () => {
      const routePath = path.join(fixturesDir, 'routes', 'missing-auth.ts');
      const content = await fs.readFile(routePath, 'utf-8');
      
      const policies = await extractObservedAuthPolicies(routePath, content);
      
      expect(policies.length).toBeGreaterThan(0);
      
      // getUser route should have no auth
      const getUserPolicy = policies.find(p => p.routePath.includes('user') && p.httpMethod === 'GET');
      if (getUserPolicy) {
        expect(getUserPolicy.enforcementType).toBe('none');
      }
    });

    it('should detect correct auth in routes', async () => {
      const routePath = path.join(fixturesDir, 'routes', 'correct-auth.ts');
      const content = await fs.readFile(routePath, 'utf-8');
      
      const policies = await extractObservedAuthPolicies(routePath, content);
      
      // Should detect role checks
      const updatePolicy = policies.find(p => 
        p.routePath.includes('user') && 
        (p.detectedRoles?.includes('ADMIN') || p.authPatterns.length > 0)
      );
      
      // Either has role check or auth patterns
      expect(updatePolicy).toBeDefined();
    });
  });

  describe('Auth Drift Detection', () => {
    it('should detect missing auth drift', async () => {
      // Extract ISL requirements
      const islPath = path.join(fixturesDir, 'isl', 'auth-required.isl');
      const islContent = await fs.readFile(islPath, 'utf-8');
      const requirements = await extractISLAuthRequirements(islPath, islContent);
      
      // Extract route policies
      const routePath = path.join(fixturesDir, 'routes', 'missing-auth.ts');
      const routeContent = await fs.readFile(routePath, 'utf-8');
      const policies = await extractObservedAuthPolicies(routePath, routeContent);
      
      // Detect drift
      const result = detectAuthDrift(requirements, policies, {
        minConfidence: 0.5,
        publicEndpointThreshold: 0.7,
      });
      
      // Should have drift claims
      expect(result.claims.length).toBeGreaterThan(0);
      
      // Should have missing-auth claims
      const missingAuthClaims = result.claims.filter(c => c.driftType === 'missing-auth');
      expect(missingAuthClaims.length).toBeGreaterThan(0);
      
      // Check severity
      const criticalClaims = result.claimsBySeverity.critical;
      expect(criticalClaims.length).toBeGreaterThan(0);
    });

    it('should not flag public endpoints incorrectly', async () => {
      // Extract ISL requirements
      const islPath = path.join(fixturesDir, 'isl', 'auth-required.isl');
      const islContent = await fs.readFile(islPath, 'utf-8');
      const requirements = await extractISLAuthRequirements(islPath, islContent);
      
      // Extract public endpoint
      const routePath = path.join(fixturesDir, 'routes', 'public-endpoint.ts');
      const routeContent = await fs.readFile(routePath, 'utf-8');
      const policies = await extractObservedAuthPolicies(routePath, routeContent);
      
      // Detect drift with high public endpoint threshold
      const result = detectAuthDrift(requirements, policies, {
        minConfidence: 0.5,
        publicEndpointThreshold: 0.8, // High threshold - less likely to flag
      });
      
      // Public endpoints should not be flagged as missing auth
      const publicHealthCheckReq = requirements.find(r => r.behaviorName === 'PublicHealthCheck');
      if (publicHealthCheckReq) {
        const publicClaims = result.claims.filter(c => 
          c.expectedPolicy.behaviorName === 'PublicHealthCheck' &&
          c.driftType === 'missing-auth'
        );
        expect(publicClaims.length).toBe(0);
      }
    });

    it('should detect role mismatches', async () => {
      // Create test requirements and policies
      const requirements = [
        {
          behaviorName: 'UpdateUser',
          requirementType: 'role' as const,
          requiredRoles: ['ADMIN'],
          islFilePath: 'test.isl',
          line: 10,
          confidence: 0.9,
        },
      ];
      
      const policies = [
        {
          routePath: '/users/:id',
          httpMethod: 'PUT',
          filePath: 'test.ts',
          line: 20,
          enforcementType: 'manual-check' as const,
          detectedRoles: ['USER'], // Wrong role
          authPatterns: ['role check'],
          confidence: 0.8,
        },
      ];
      
      const result = detectAuthDrift(requirements, policies, {
        minConfidence: 0.5,
      });
      
      // Should detect role mismatch
      const roleMismatchClaims = result.claims.filter(c => c.driftType === 'role-mismatch');
      expect(roleMismatchClaims.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Thresholds', () => {
    it('should respect minConfidence threshold', async () => {
      const requirements = [
        {
          behaviorName: 'TestBehavior',
          requirementType: 'auth' as const,
          islFilePath: 'test.isl',
          line: 1,
          confidence: 0.3, // Low confidence
        },
      ];
      
      const policies = [
        {
          routePath: '/test',
          httpMethod: 'GET',
          filePath: 'test.ts',
          line: 1,
          enforcementType: 'none' as const,
          authPatterns: [],
          confidence: 0.3, // Low confidence
        },
      ];
      
      // High minConfidence threshold
      const result = detectAuthDrift(requirements, policies, {
        minConfidence: 0.7,
      });
      
      // Should filter out low-confidence claims
      expect(result.claims.length).toBe(0);
    });
  });
});
