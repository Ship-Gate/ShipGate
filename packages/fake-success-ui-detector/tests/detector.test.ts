/**
 * Tests for Fake Success UI Detector
 */

import { describe, it, expect } from 'vitest';
import { detectFakeSuccess } from '../src/detector.js';
import * as fixtures from './fixtures/catch-returns-success.js';
import * as toastFixtures from './fixtures/try-catch-toast-success.js';
import * as promiseFixtures from './fixtures/promise-catch-default-success.js';

describe('Fake Success UI Detector', () => {
  describe('catch-returns-success pattern', () => {
    it('should detect catch block returning success object', () => {
      const result = detectFakeSuccess(
        fixtures.fixture1,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims[0];
      expect(claim.patternType).toBe('catch-returns-success');
      expect(claim.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect catch block returning true', () => {
      const result = detectFakeSuccess(
        fixtures.fixture2,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims[0].patternType).toBe('catch-returns-success');
    });

    it('should detect catch block returning success string', () => {
      const result = detectFakeSuccess(
        fixtures.fixture3,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims[0].patternType).toBe('catch-returns-success');
    });

    it('should detect catch block returning ok object', () => {
      const result = detectFakeSuccess(
        fixtures.fixture4,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims[0].patternType).toBe('catch-returns-success');
    });

    it('should not flag valid error handling', () => {
      const result = detectFakeSuccess(
        fixtures.validFixture1,
        'test.ts',
        { minConfidence: 0.7 }
      );

      // Should not detect fake success if error is properly handled
      const fakeSuccessClaims = result.claims.filter(
        c => c.patternType === 'catch-returns-success'
      );
      expect(fakeSuccessClaims.length).toBe(0);
    });
  });

  describe('try-catch-toast-success pattern', () => {
    it('should detect try/catch with toast.success in catch', () => {
      const result = detectFakeSuccess(
        toastFixtures.fixture1,
        'test.tsx',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'try-catch-toast-success'
      );
      expect(claim).toBeDefined();
      expect(claim?.framework).toBe('react');
    });

    it('should detect react-toastify usage', () => {
      const result = detectFakeSuccess(
        toastFixtures.fixture3,
        'test.tsx',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'try-catch-toast-success'
      );
      expect(claim).toBeDefined();
    });

    it('should detect sonner usage', () => {
      const result = detectFakeSuccess(
        toastFixtures.fixture4,
        'test.tsx',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'try-catch-toast-success'
      );
      expect(claim).toBeDefined();
    });

    it('should not flag valid error handling with error toast', () => {
      const result = detectFakeSuccess(
        toastFixtures.validFixture1,
        'test.tsx',
        { minConfidence: 0.7 }
      );

      const fakeSuccessClaims = result.claims.filter(
        c => c.patternType === 'try-catch-toast-success'
      );
      expect(fakeSuccessClaims.length).toBe(0);
    });

    it('should not flag success toast in try block', () => {
      const result = detectFakeSuccess(
        toastFixtures.validFixture2,
        'test.tsx',
        { minConfidence: 0.7 }
      );

      const fakeSuccessClaims = result.claims.filter(
        c => c.patternType === 'try-catch-toast-success'
      );
      expect(fakeSuccessClaims.length).toBe(0);
    });
  });

  describe('promise-catch-default-success pattern', () => {
    it('should detect .catch(() => true)', () => {
      const result = detectFakeSuccess(
        promiseFixtures.fixture1,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'promise-catch-default-success'
      );
      expect(claim).toBeDefined();
    });

    it('should detect .catch(() => ({ success: true }))', () => {
      const result = detectFakeSuccess(
        promiseFixtures.fixture2,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'promise-catch-default-success'
      );
      expect(claim).toBeDefined();
    });

    it('should detect .catch(() => toast.success())', () => {
      const result = detectFakeSuccess(
        promiseFixtures.fixture3,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'promise-catch-default-success'
      );
      expect(claim).toBeDefined();
    });

    it('should detect .catch(() => "success")', () => {
      const result = detectFakeSuccess(
        promiseFixtures.fixture4,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'promise-catch-default-success'
      );
      expect(claim).toBeDefined();
    });

    it('should not flag valid error handling in catch', () => {
      const result = detectFakeSuccess(
        promiseFixtures.validFixture1,
        'test.ts',
        { minConfidence: 0.7 }
      );

      const fakeSuccessClaims = result.claims.filter(
        c => c.patternType === 'promise-catch-default-success'
      );
      expect(fakeSuccessClaims.length).toBe(0);
    });

    it('should not flag error toast in catch', () => {
      const result = detectFakeSuccess(
        promiseFixtures.validFixture2,
        'test.ts',
        { minConfidence: 0.7 }
      );

      const fakeSuccessClaims = result.claims.filter(
        c => c.patternType === 'promise-catch-default-success'
      );
      expect(fakeSuccessClaims.length).toBe(0);
    });
  });

  describe('call chain evidence', () => {
    it('should include error origin in call chain', () => {
      const result = detectFakeSuccess(
        fixtures.fixture1,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims[0];
      expect(claim.callChain.errorOrigin).toBeDefined();
      expect(claim.callChain.errorOrigin.type).toBe('catch');
    });

    it('should include success display in call chain', () => {
      const result = detectFakeSuccess(
        toastFixtures.fixture1,
        'test.tsx',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims.find(
        c => c.patternType === 'try-catch-toast-success'
      );
      expect(claim?.callChain.successDisplay).toBeDefined();
      expect(claim?.callChain.successDisplay.type).toBe('toast');
    });

    it('should include swallowed error information', () => {
      const result = detectFakeSuccess(
        fixtures.fixture1,
        'test.ts',
        { minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims[0];
      expect(claim.swallowedError).toBeDefined();
      expect(claim.swallowedError?.line).toBeGreaterThan(0);
    });
  });

  describe('snippet extraction', () => {
    it('should include code snippet in claim', () => {
      const result = detectFakeSuccess(
        fixtures.fixture1,
        'test.ts',
        { includeSnippets: true, minConfidence: 0.7 }
      );

      expect(result.claims.length).toBeGreaterThan(0);
      const claim = result.claims[0];
      expect(claim.snippet).toBeDefined();
      expect(claim.snippet.length).toBeGreaterThan(0);
    });
  });
});
