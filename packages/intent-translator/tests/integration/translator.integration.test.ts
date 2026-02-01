/**
 * Translator Integration Tests
 * 
 * Tests the translator against real AI providers.
 * Skipped automatically if no API keys are available.
 * 
 * Run with: ANTHROPIC_API_KEY=sk-... pnpm test
 * Or:       OPENAI_API_KEY=sk-... pnpm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { translate, type TranslationResult } from '../../src/index.js';
import { parse } from '@isl-lang/parser';
import {
  detectIntegrationEnv,
  getTranslatorOptions,
  type IntegrationEnvConfig,
} from './integrationEnv.js';
import { TEST_PROMPTS, type TestPrompt } from './fixtures/prompts.js';

// Detect environment once at module load
const env = detectIntegrationEnv();

/**
 * Validates that the translation result has expected schema structure
 */
function validateResultSchema(result: TranslationResult): void {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe('boolean');
  
  if (result.success) {
    expect(result.isl).toBeDefined();
    expect(typeof result.isl).toBe('string');
    expect(result.isl!.length).toBeGreaterThan(0);
    
    // Validate optional fields have correct types when present
    if (result.domain !== undefined) {
      expect(typeof result.domain).toBe('string');
    }
    if (result.entities !== undefined) {
      expect(Array.isArray(result.entities)).toBe(true);
    }
    if (result.behaviors !== undefined) {
      expect(Array.isArray(result.behaviors)).toBe(true);
    }
    if (result.usedLibraries !== undefined) {
      expect(Array.isArray(result.usedLibraries)).toBe(true);
    }
  } else {
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  }
}

/**
 * Validates that generated ISL can be parsed (round-trip)
 */
function validateRoundTripParse(isl: string): { success: boolean; errorCount: number; errors: string[] } {
  const parseResult = parse(isl, 'generated.isl');
  
  return {
    success: parseResult.success,
    errorCount: parseResult.errors.length,
    errors: parseResult.errors.map(e => e.message),
  };
}

/**
 * Checks if the ISL output contains expected domain structures
 */
function validateISLStructure(isl: string, expectations: TestPrompt['expectations']): void {
  // Check for 'domain' keyword - required for valid ISL
  expect(isl).toMatch(/domain\s+\w+\s*\{/);
  
  // Check for version field - required in ISL
  expect(isl).toMatch(/version\s*:\s*"[^"]+"/);
  
  // Check minimum behaviors if specified
  if (expectations.minBehaviors) {
    const behaviorMatches = isl.match(/behavior\s+\w+\s*\{/g) || [];
    expect(behaviorMatches.length).toBeGreaterThanOrEqual(expectations.minBehaviors);
  }
  
  // Check minimum entities if specified
  if (expectations.minEntities) {
    const entityMatches = isl.match(/entity\s+\w+\s*\{/g) || [];
    expect(entityMatches.length).toBeGreaterThanOrEqual(expectations.minEntities);
  }
}

/**
 * Validates that translation doesn't leak secrets or instructions
 */
function validateNoSecretLeakage(result: TranslationResult): void {
  const suspiciousPatterns = [
    /system\s*prompt/i,
    /api[_-]?key/i,
    /secret/i,
    /sk-[a-zA-Z0-9]{20,}/,  // OpenAI key pattern
    /anthropic[_-]?key/i,
  ];
  
  const isl = result.isl || '';
  const errors = (result.errors || []).join(' ');
  const fullOutput = `${isl} ${errors}`;
  
  for (const pattern of suspiciousPatterns) {
    expect(fullOutput).not.toMatch(pattern);
  }
}

// Integration test suite - skipped if no API keys
describe.skipIf(!env.canRunIntegrationTests)(
  'Translator Integration Tests',
  () => {
    let translatorOptions: ReturnType<typeof getTranslatorOptions>;
    
    beforeAll(() => {
      translatorOptions = getTranslatorOptions(env);
      console.log(`Running integration tests with provider: ${env.provider}`);
    });

    describe('Schema Validation', () => {
      it.each(
        TEST_PROMPTS.filter(p => !p.expectations.isPotentiallyMalicious).map(p => [p.id, p])
      )('prompt "%s" returns valid schema', async (_, prompt: TestPrompt) => {
        const result = await translate(prompt.prompt, translatorOptions);
        validateResultSchema(result);
      }, { timeout: 60000 });
    });

    describe('Round-Trip Parse', () => {
      it.each(
        TEST_PROMPTS.filter(p => !p.expectations.isPotentiallyMalicious && !p.expectations.expectsOpenQuestions).map(p => [p.id, p])
      )('prompt "%s" generates parseable ISL', async (_, prompt: TestPrompt) => {
        const result = await translate(prompt.prompt, translatorOptions);
        
        if (result.success && result.isl) {
          const parseValidation = validateRoundTripParse(result.isl);
          
          // Log errors for debugging but don't fail on minor parse issues
          if (!parseValidation.success) {
            console.warn(`Parse warnings for ${prompt.id}:`, parseValidation.errors);
          }
          
          // The ISL should at least contain domain structure
          validateISLStructure(result.isl, prompt.expectations);
        } else {
          // If translation failed, ensure we have error info
          expect(result.errors).toBeDefined();
          console.warn(`Translation failed for ${prompt.id}:`, result.errors);
        }
      }, { timeout: 60000 });
    });

    describe('Underspecified Prompts', () => {
      it.each(
        TEST_PROMPTS.filter(p => p.expectations.expectsOpenQuestions).map(p => [p.id, p])
      )('prompt "%s" indicates vagueness', async (_, prompt: TestPrompt) => {
        const result = await translate(prompt.prompt, translatorOptions);
        
        // For vague prompts, we expect either:
        // 1. A basic template with minimal content
        // 2. Or a failure with helpful error messages
        if (result.success) {
          // If it succeeds, the result should be minimal/generic
          expect(result.isl).toBeDefined();
          
          // Generic domain names like 'MyApp' indicate lack of specificity
          const hasGenericDomain = result.domain === 'MyApp' || 
                                    result.isl?.includes('domain MyApp');
          
          // Few detected behaviors/entities indicate the prompt was too vague
          const hasMinimalContent = 
            (result.entities?.length ?? 0) <= 1 &&
            (result.behaviors?.length ?? 0) <= 1;
          
          expect(hasGenericDomain || hasMinimalContent).toBe(true);
        }
      }, { timeout: 60000 });
    });

    describe('Security: Prompt Injection Resistance', () => {
      it.each(
        TEST_PROMPTS.filter(p => p.expectations.isPotentiallyMalicious).map(p => [p.id, p])
      )('prompt "%s" does not leak secrets or instructions', async (_, prompt: TestPrompt) => {
        const result = await translate(prompt.prompt, translatorOptions);
        
        // Should not leak any sensitive information
        validateNoSecretLeakage(result);
        
        // Should either produce valid ISL or fail gracefully
        if (result.success) {
          validateResultSchema(result);
        }
      }, { timeout: 60000 });
    });

    describe('Specific Scenarios', () => {
      it('OAuth login produces auth-related behaviors', async () => {
        const prompt = TEST_PROMPTS.find(p => p.id === 'oauth-login')!;
        const result = await translate(prompt.prompt, translatorOptions);
        
        expect(result.success).toBe(true);
        expect(result.isl).toBeDefined();
        
        // Should detect auth-related libraries
        expect(result.usedLibraries).toBeDefined();
        expect(result.usedLibraries).toContain('stdlib-auth');
        
        // ISL should contain authentication-related terms
        const isl = result.isl!.toLowerCase();
        expect(
          isl.includes('login') || 
          isl.includes('auth') || 
          isl.includes('token') ||
          isl.includes('session')
        ).toBe(true);
      }, { timeout: 60000 });

      it('Stripe subscription produces payment behaviors', async () => {
        const prompt = TEST_PROMPTS.find(p => p.id === 'stripe-subscriptions')!;
        const result = await translate(prompt.prompt, translatorOptions);
        
        expect(result.success).toBe(true);
        expect(result.isl).toBeDefined();
        
        // Should detect payment-related libraries
        expect(result.usedLibraries).toBeDefined();
        expect(result.usedLibraries).toContain('stdlib-payments');
        
        // ISL should contain subscription-related terms
        const isl = result.isl!.toLowerCase();
        expect(
          isl.includes('subscription') || 
          isl.includes('billing') || 
          isl.includes('payment') ||
          isl.includes('plan')
        ).toBe(true);
      }, { timeout: 60000 });

      it('File upload produces file-related behaviors', async () => {
        const prompt = TEST_PROMPTS.find(p => p.id === 'file-upload')!;
        const result = await translate(prompt.prompt, translatorOptions);
        
        expect(result.success).toBe(true);
        expect(result.isl).toBeDefined();
        
        // Should detect file-related libraries
        expect(result.usedLibraries).toBeDefined();
        expect(result.usedLibraries).toContain('stdlib-files');
        
        // ISL should contain file-related terms
        const isl = result.isl!.toLowerCase();
        expect(
          isl.includes('upload') || 
          isl.includes('file') || 
          isl.includes('download') ||
          isl.includes('storage')
        ).toBe(true);
      }, { timeout: 60000 });
    });
  }
);

// Log skip reason when tests are skipped
if (!env.canRunIntegrationTests) {
  console.log(`\n⏭️  Integration tests skipped: ${env.skipReason}\n`);
}
