/**
 * AI Generator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractCode,
  extractPrimaryCode,
  extractMultipleCodeBlocks,
  validateExtraction,
  ExtractionError,
} from '../src/extraction.js';
import {
  validateCode,
  quickValidate,
  formatValidationResult,
} from '../src/validation.js';
import {
  getSystemPrompt,
  getCompleteSystemPrompt,
  getLanguageAdditions,
} from '../src/prompts/system.js';
import {
  expressionToReadable,
  typeToString,
} from '../src/prompts/behavior.js';

// ============================================================================
// Extraction Tests
// ============================================================================

describe('Code Extraction', () => {
  describe('extractCode', () => {
    it('extracts code from TypeScript markdown block', () => {
      const response = `Here's the implementation:

\`\`\`typescript
export function login(input: LoginInput): Promise<LoginResult> {
  return Promise.resolve({ success: true, data: {} });
}
\`\`\`

That should work!`;

      const result = extractCode(response, { expectedLanguage: 'typescript' });

      expect(result.code).toContain('export function login');
      expect(result.language).toBe('typescript');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('extracts code from ts alias block', () => {
      const response = `\`\`\`ts
const x = 1;
\`\`\``;

      const result = extractCode(response, { expectedLanguage: 'typescript' });
      expect(result.code).toBe('const x = 1;');
    });

    it('extracts from any code block when language not matched', () => {
      const response = `\`\`\`
function test() { return true; }
\`\`\``;

      const result = extractCode(response, { expectedLanguage: 'typescript' });
      expect(result.code).toContain('function test');
    });

    it('throws ExtractionError when no code found', () => {
      const response = 'This is just text without any code.';

      expect(() => extractCode(response)).toThrow(ExtractionError);
    });

    it('handles code with multiple functions', () => {
      const response = `\`\`\`typescript
export function createLogin(deps: Dependencies) {
  return async function login(input: LoginInput): Promise<LoginResult> {
    // Validate preconditions
    if (!input.email) {
      throw new Error('Email required');
    }
    
    // Execute
    const user = await deps.userRepo.findByEmail(input.email);
    
    return { success: true, data: user };
  };
}
\`\`\``;

      const result = extractCode(response, { expectedLanguage: 'typescript' });
      expect(result.code).toContain('createLogin');
      expect(result.code).toContain('login');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('extractMultipleCodeBlocks', () => {
    it('extracts multiple code blocks from response', () => {
      const response = `Implementation:

\`\`\`typescript
export function login() {}
\`\`\`

Tests:

\`\`\`typescript
describe('login', () => {});
\`\`\``;

      const blocks = extractMultipleCodeBlocks(response);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]!.code).toContain('login');
      expect(blocks[1]!.code).toContain('describe');
    });
  });

  describe('validateExtraction', () => {
    it('validates balanced braces', () => {
      const valid = validateExtraction({
        code: 'function test() { return { a: 1 }; }',
        language: 'typescript',
        raw: '',
        confidence: 0.8,
      });
      expect(valid.valid).toBe(true);
      expect(valid.issues).toHaveLength(0);
    });

    it('detects unbalanced braces', () => {
      const invalid = validateExtraction({
        code: 'function test() { return { a: 1 }',
        language: 'typescript',
        raw: '',
        confidence: 0.8,
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.issues).toContain(expect.stringContaining('Unbalanced braces'));
    });

    it('detects truncated code', () => {
      const truncated = validateExtraction({
        code: 'function test() {\n  // ...\n}',
        language: 'typescript',
        raw: '',
        confidence: 0.8,
      });
      expect(truncated.valid).toBe(false);
      expect(truncated.issues).toContain(expect.stringContaining('truncated'));
    });

    it('warns about missing export', () => {
      const noExport = validateExtraction({
        code: 'function test() { return true; }',
        language: 'typescript',
        raw: '',
        confidence: 0.8,
      });
      expect(noExport.issues).toContain(expect.stringContaining('export'));
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Code Validation', () => {
  describe('validateCode', () => {
    it('validates valid TypeScript code', () => {
      const code = `
export function login(input: { email: string }): Promise<{ success: boolean }> {
  return Promise.resolve({ success: true });
}
`;
      const result = validateCode(code, { language: 'typescript' });
      expect(result.valid).toBe(true);
      expect(result.metrics.hasExport).toBe(true);
      expect(result.metrics.hasAsyncAwait).toBe(false);
    });

    it('validates async/await code', () => {
      const code = `
export async function fetchUser(id: string): Promise<User> {
  const user = await db.find(id);
  return user;
}
`;
      const result = validateCode(code, { language: 'typescript' });
      expect(result.metrics.hasAsyncAwait).toBe(true);
    });

    it('warns about console statements', () => {
      const code = `
export function debug() {
  console.log('debugging');
}
`;
      const result = validateCode(code, { language: 'typescript' });
      expect(result.warnings.some(w => w.message.includes('Console'))).toBe(true);
    });

    it('warns about TODO comments', () => {
      const code = `
export function incomplete() {
  // TODO: implement this
  return null;
}
`;
      const result = validateCode(code, { language: 'typescript' });
      expect(result.warnings.some(w => w.message.includes('TODO'))).toBe(true);
    });

    it('detects missing export in strict mode', () => {
      const code = `
function privateFunction() {
  return true;
}
`;
      const result = validateCode(code, { language: 'typescript', strict: true });
      expect(result.errors.some(e => e.message.includes('export'))).toBe(true);
    });

    it('calculates complexity metrics', () => {
      const code = `
export function complex(x: number): string {
  if (x > 10) {
    if (x > 20) {
      return 'high';
    }
    return 'medium';
  } else if (x > 5) {
    return 'low';
  }
  return x > 0 ? 'positive' : 'negative';
}
`;
      const result = validateCode(code, { language: 'typescript' });
      expect(result.metrics.complexity).toBeGreaterThan(4);
    });

    it('warns about any type usage', () => {
      const code = `
export function unsafe(x: any): any {
  return x;
}
`;
      const result = validateCode(code, { language: 'typescript' });
      expect(result.warnings.some(w => w.message.includes('any'))).toBe(true);
    });
  });

  describe('quickValidate', () => {
    it('returns true for valid code', () => {
      expect(quickValidate('const x = 1;', 'typescript')).toBe(true);
    });

    it('returns true for valid JavaScript', () => {
      expect(quickValidate('function test() { return 1; }', 'javascript')).toBe(true);
    });
  });

  describe('formatValidationResult', () => {
    it('formats passed validation', () => {
      const result = validateCode('export const x = 1;', { language: 'typescript' });
      const formatted = formatValidationResult(result);
      expect(formatted).toContain('Validation passed');
    });

    it('formats failed validation with errors', () => {
      const result = validateCode('function x() {}', { language: 'typescript', strict: true });
      const formatted = formatValidationResult(result);
      expect(formatted).toContain('Errors:');
    });
  });
});

// ============================================================================
// Prompt Tests
// ============================================================================

describe('System Prompts', () => {
  describe('getSystemPrompt', () => {
    it('generates TypeScript system prompt', () => {
      const prompt = getSystemPrompt({ language: 'typescript' });
      expect(prompt).toContain('typescript');
      expect(prompt).toContain('preconditions');
      expect(prompt).toContain('postconditions');
    });

    it('includes strict rules by default', () => {
      const prompt = getSystemPrompt({ language: 'typescript', strict: true });
      expect(prompt).toContain('Strict Mode');
    });

    it('can use relaxed rules', () => {
      const prompt = getSystemPrompt({ language: 'typescript', strict: false });
      expect(prompt).toContain('Relaxed Mode');
    });
  });

  describe('getLanguageAdditions', () => {
    it('returns TypeScript additions', () => {
      const additions = getLanguageAdditions('typescript');
      expect(additions).toContain('TypeScript');
      expect(additions).toContain('interface');
    });

    it('returns Python additions', () => {
      const additions = getLanguageAdditions('python');
      expect(additions).toContain('Python');
      expect(additions).toContain('type hints');
    });

    it('returns empty for unknown language', () => {
      const additions = getLanguageAdditions('cobol');
      expect(additions).toBe('');
    });
  });

  describe('getCompleteSystemPrompt', () => {
    it('combines base and language-specific prompts', () => {
      const prompt = getCompleteSystemPrompt({ language: 'typescript' });
      expect(prompt).toContain('TypeScript-Specific Guidelines');
      expect(prompt).toContain('preconditions');
    });
  });
});

// ============================================================================
// Behavior Prompt Utilities Tests
// ============================================================================

describe('Behavior Prompt Utilities', () => {
  describe('expressionToReadable', () => {
    it('converts identifier to string', () => {
      const expr = { kind: 'Identifier' as const, name: 'user', span: {} as any };
      expect(expressionToReadable(expr)).toBe('user');
    });

    it('converts string literal', () => {
      const expr = { kind: 'StringLiteral' as const, value: 'hello', span: {} as any };
      expect(expressionToReadable(expr)).toBe('"hello"');
    });

    it('converts member expression', () => {
      const expr = {
        kind: 'MemberExpression' as const,
        object: { kind: 'Identifier' as const, name: 'user', span: {} as any },
        property: { kind: 'Identifier' as const, name: 'email', span: {} as any },
        span: {} as any,
      };
      expect(expressionToReadable(expr)).toBe('user.email');
    });

    it('converts comparison expression', () => {
      const expr = {
        kind: 'ComparisonExpression' as const,
        operator: '==' as const,
        left: { kind: 'Identifier' as const, name: 'x', span: {} as any },
        right: { kind: 'NumberLiteral' as const, value: 10, span: {} as any },
        span: {} as any,
      };
      expect(expressionToReadable(expr)).toBe('x == 10');
    });
  });

  describe('typeToString', () => {
    it('converts simple type', () => {
      const type = {
        kind: 'SimpleType' as const,
        name: { kind: 'Identifier' as const, name: 'String', span: {} as any },
        span: {} as any,
      };
      expect(typeToString(type)).toBe('String');
    });

    it('converts generic type', () => {
      const type = {
        kind: 'GenericType' as const,
        name: { kind: 'Identifier' as const, name: 'List', span: {} as any },
        typeArguments: [
          {
            kind: 'SimpleType' as const,
            name: { kind: 'Identifier' as const, name: 'User', span: {} as any },
            span: {} as any,
          },
        ],
        span: {} as any,
      };
      expect(typeToString(type)).toBe('List<User>');
    });
  });
});

// ============================================================================
// Integration Tests (mocked)
// ============================================================================

describe('Generator Integration', () => {
  it('module exports expected functions', async () => {
    const module = await import('../src/index.js');
    
    expect(typeof module.generate).toBe('function');
    expect(typeof module.generateAll).toBe('function');
    expect(typeof module.generateStream).toBe('function');
    expect(typeof module.createGenerator).toBe('function');
    expect(typeof module.createAnthropicGenerator).toBe('function');
    expect(typeof module.createOpenAIGenerator).toBe('function');
  });

  it('exports validation utilities', async () => {
    const module = await import('../src/index.js');
    
    expect(typeof module.validateCode).toBe('function');
    expect(typeof module.quickValidate).toBe('function');
    expect(typeof module.extractCode).toBe('function');
  });

  it('exports prompt utilities', async () => {
    const module = await import('../src/index.js');
    
    expect(typeof module.getSystemPrompt).toBe('function');
    expect(typeof module.generateBehaviorPrompt).toBe('function');
  });
});
