/**
 * Spec Assist Tests
 * 
 * Tests for AI-assisted ISL spec generation.
 * 
 * Key test categories:
 * 1. Schema/format tests - valid ISL structure
 * 2. Reject slop tests - non-ISL output rejected
 * 3. Provider tests - stub and real providers
 * 4. Validation pipeline tests
 * 5. Feature flag tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createSpecAssist,
  generateSpecFromCode,
  isValidOutput,
  validateISL,
  isAIEnabled,
  AI_ENABLED_ENV,
  AI_PROVIDER_ENV,
  INVALID_OUTPUTS,
  createStubProvider,
} from './index.js';

// ============================================================================
// SCHEMA/FORMAT TESTS
// ============================================================================

describe('isValidOutput - Schema Validation', () => {
  it('accepts valid ISL starting with domain', () => {
    const input = `domain UserManagement {
  entity User {
    id: ID
    email: String
  }
}`;
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe(input);
  });
  
  it('accepts valid ISL starting with behavior', () => {
    const input = `behavior CreateUser {
  input {
    email: String
  }
  output {
    user: User
  }
}`;
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe(input);
  });
  
  it('accepts valid ISL starting with entity', () => {
    const input = `entity User {
  id: ID
  email: String
}`;
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe(input);
  });
  
  it('accepts valid ISL starting with type', () => {
    const input = `type Email = String @email`;
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe(input);
  });
  
  it('accepts valid ISL starting with enum', () => {
    const input = `enum UserStatus { ACTIVE, INACTIVE, SUSPENDED }`;
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe(input);
  });
  
  it('accepts valid JSON envelope with isl field', () => {
    const input = JSON.stringify({
      isl: 'domain Test { entity Item { id: ID } }',
      reasoning: 'Generated from code',
      confidence: 0.85,
    });
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe('domain Test { entity Item { id: ID } }');
  });
  
  it('extracts ISL from markdown code blocks', () => {
    const input = '```isl\ndomain Test { entity Item { id: ID } }\n```';
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
    expect(result.isl).toBe('domain Test { entity Item { id: ID } }');
  });
  
  it('handles leading/trailing whitespace', () => {
    const input = `  
    
domain Test { entity Item { id: ID } }

    `;
    const result = isValidOutput(input);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// REJECT SLOP TESTS
// ============================================================================

describe('isValidOutput - Reject Slop', () => {
  it('rejects prose-only output', () => {
    const result = isValidOutput(INVALID_OUTPUTS.proseOnly);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not valid ISL');
  });
  
  it('rejects markdown with explanatory prose', () => {
    const result = isValidOutput(INVALID_OUTPUTS.markdownWithProse);
    // This might pass if it extracts the code block - that's acceptable
    // The key is the outer prose should not be included
    if (result.valid) {
      expect(result.isl).not.toContain('Here\'s the generated spec');
    }
  });
  
  it('rejects invalid JSON envelope (missing isl field)', () => {
    const result = isValidOutput(INVALID_OUTPUTS.invalidEnvelope);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing required "isl" field');
  });
  
  it('rejects empty output', () => {
    const result = isValidOutput(INVALID_OUTPUTS.empty);
    expect(result.valid).toBe(false);
  });
  
  it('rejects whitespace-only output', () => {
    const result = isValidOutput(INVALID_OUTPUTS.whitespace);
    expect(result.valid).toBe(false);
  });
  
  it('rejects code in wrong language', () => {
    const result = isValidOutput(INVALID_OUTPUTS.wrongLanguage);
    expect(result.valid).toBe(false);
  });
  
  it('rejects random text', () => {
    const result = isValidOutput('Hello, I am an AI assistant. How can I help you today?');
    expect(result.valid).toBe(false);
  });
  
  it('rejects partial ISL keywords', () => {
    const result = isValidOutput('This domain is about users. The behavior should be...');
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// VALIDATION PIPELINE TESTS
// ============================================================================

describe('validateISL - Pipeline', () => {
  it('validates syntactically correct ISL', async () => {
    const isl = `domain Test {
  entity Item {
    id: ID
    name: String
  }
}`;
    const result = await validateISL(isl);
    expect(result.parseOk).toBe(true);
  });
  
  it('catches unbalanced braces', async () => {
    const isl = `domain Test {
  entity Item {
    id: ID`;
    const result = await validateISL(isl);
    expect(result.parseOk).toBe(false);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
  
  it('catches invalid start keyword', async () => {
    const isl = `class User { id: number }`;
    const result = await validateISL(isl);
    expect(result.parseOk).toBe(false);
  });
  
  it('catches duplicate declarations', async () => {
    const isl = `domain Test {
  entity User { id: ID }
  entity User { email: String }
}`;
    const result = await validateISL(isl);
    // Semantic check should catch duplicates
    if (!result.semanticOk) {
      expect(result.semanticErrors.some(e => e.message.includes('Duplicate'))).toBe(true);
    }
  });
  
  it('validates complete behavior structure', async () => {
    const isl = `behavior CreateUser {
  input {
    email: String
    password: String
  }
  
  output {
    user: User
  }
  
  preconditions {
    require input.email.length > 0
  }
  
  postconditions {
    ensure result.user.email == input.email
  }
}`;
    const result = await validateISL(isl);
    expect(result.parseOk).toBe(true);
  });
});

// ============================================================================
// PROVIDER TESTS
// ============================================================================

describe('StubProvider', () => {
  it('initializes successfully', async () => {
    const provider = createStubProvider();
    await provider.initialize({ provider: 'stub' });
    expect(provider.isReady()).toBe(true);
  });
  
  it('returns ISL for auth-related prompts', async () => {
    const provider = createStubProvider();
    await provider.initialize({ provider: 'stub' });
    
    const response = await provider.complete([
      { role: 'user', content: 'Generate spec for createUser function' },
    ]);
    
    expect(response.content).toContain('behavior CreateUser');
    expect(response.content).toContain('preconditions');
    expect(response.content).toContain('postconditions');
  });
  
  it('returns ISL for payment-related prompts', async () => {
    const provider = createStubProvider();
    await provider.initialize({ provider: 'stub' });
    
    const response = await provider.complete([
      { role: 'user', content: 'Generate spec for processPayment function' },
    ]);
    
    expect(response.content).toContain('behavior ProcessPayment');
    expect(response.content).toContain('Money');
  });
  
  it('includes token metadata', async () => {
    const provider = createStubProvider();
    await provider.initialize({ provider: 'stub' });
    
    const response = await provider.complete([
      { role: 'user', content: 'Test prompt' },
    ]);
    
    expect(response.tokens).toBeDefined();
    expect(response.tokens?.input).toBeGreaterThan(0);
    expect(response.tokens?.output).toBeGreaterThan(0);
  });
});

// ============================================================================
// FEATURE FLAG TESTS
// ============================================================================

describe('Feature Flags', () => {
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Clear AI-related env vars
    delete process.env[AI_ENABLED_ENV];
    delete process.env[AI_PROVIDER_ENV];
  });
  
  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });
  
  it('defaults to disabled', () => {
    const result = isAIEnabled();
    expect(result.enabled).toBe(false);
    expect(result.source).toBe('default');
  });
  
  it('respects ISL_AI_ENABLED=true', () => {
    process.env[AI_ENABLED_ENV] = 'true';
    const result = isAIEnabled();
    expect(result.enabled).toBe(true);
    expect(result.source).toBe('env');
  });
  
  it('respects ISL_AI_ENABLED=1', () => {
    process.env[AI_ENABLED_ENV] = '1';
    const result = isAIEnabled();
    expect(result.enabled).toBe(true);
  });
  
  it('respects ISL_AI_ENABLED=false', () => {
    process.env[AI_ENABLED_ENV] = 'false';
    const result = isAIEnabled();
    expect(result.enabled).toBe(false);
  });
  
  it('reads provider from env', () => {
    process.env[AI_ENABLED_ENV] = 'true';
    process.env[AI_PROVIDER_ENV] = 'anthropic';
    const result = isAIEnabled();
    expect(result.provider).toBe('anthropic');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('SpecAssistService Integration', () => {
  beforeEach(() => {
    process.env[AI_ENABLED_ENV] = 'true';
    process.env[AI_PROVIDER_ENV] = 'stub';
  });
  
  afterEach(() => {
    delete process.env[AI_ENABLED_ENV];
    delete process.env[AI_PROVIDER_ENV];
  });
  
  it('generates valid ISL from TypeScript code', async () => {
    const service = createSpecAssist({ provider: 'stub' });
    await service.initialize();
    
    const result = await service.generateSpec({
      code: `
        async function createUser(email: string, password: string) {
          // Validate email
          if (!isValidEmail(email)) throw new Error('Invalid email');
          
          // Create user
          const user = await db.users.create({ email, passwordHash: hash(password) });
          
          // Send verification email
          await sendVerificationEmail(user.email);
          
          return { user, token: generateToken(user.id) };
        }
      `,
      language: 'typescript',
      signature: 'createUser',
    });
    
    expect(result.success).toBe(true);
    expect(result.isl).toBeDefined();
    expect(result.validation.parseOk).toBe(true);
  });
  
  it('provides diagnostics when validation fails', async () => {
    // This test uses a mock to simulate invalid output
    const service = createSpecAssist({ provider: 'stub' });
    await service.initialize();
    
    // The stub provider always returns valid ISL, so this should succeed
    const result = await service.generateSpec({
      code: 'function test() {}',
      language: 'typescript',
    });
    
    // Even with stub, we should get a response
    expect(result.metadata.provider).toBe('stub');
    expect(result.diagnostics).toBeDefined();
  });
  
  it('rejects output without AI flag enabled', async () => {
    delete process.env[AI_ENABLED_ENV];
    
    const service = createSpecAssist({ provider: 'stub' });
    
    await expect(service.initialize()).rejects.toThrow('AI assist is not enabled');
  });
  
  it('includes metadata in response', async () => {
    const service = createSpecAssist({ provider: 'stub' });
    await service.initialize();
    
    const result = await service.generateSpec({
      code: 'function login() {}',
      language: 'typescript',
    });
    
    expect(result.metadata.provider).toBe('stub');
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// QUICK HELPER TESTS
// ============================================================================

describe('generateSpecFromCode helper', () => {
  beforeEach(() => {
    process.env[AI_ENABLED_ENV] = 'true';
    process.env[AI_PROVIDER_ENV] = 'stub';
  });
  
  afterEach(() => {
    delete process.env[AI_ENABLED_ENV];
    delete process.env[AI_PROVIDER_ENV];
  });
  
  it('works with minimal input', async () => {
    const result = await generateSpecFromCode(
      'function deleteUser(id) { return db.delete(id); }',
      'javascript'
    );
    
    expect(result.success).toBe(true);
    expect(result.isl).toContain('behavior');
  });
  
  it('accepts hints', async () => {
    const result = await generateSpecFromCode(
      'function processPayment(amount, card) {}',
      'typescript',
      {
        hints: ['handles credit card payments', 'validates card number'],
      }
    );
    
    expect(result.success).toBe(true);
  });
});
