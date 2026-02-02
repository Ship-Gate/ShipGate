/**
 * API Surface Snapshot Test
 * 
 * Ensures the public API surface remains stable across versions.
 * If this test fails after intentional API changes, update the snapshot.
 */

import { describe, it, expect } from 'vitest';
import * as core from '../src/index.js';

describe('API Surface', () => {
  it('should export core parsing functions', () => {
    expect(typeof core.parseISL).toBe('function');
    expect(typeof core.compile).toBe('function');
    expect(typeof core.tokenize).toBe('function');
    expect(typeof core.parse).toBe('function');
  });

  it('should export type checker', () => {
    expect(typeof core.check).toBe('function');
    expect(typeof core.isValid).toBe('function');
    expect(typeof core.TypeChecker).toBe('function');
  });

  it('should export formatter', () => {
    expect(typeof core.format).toBe('function');
    expect(typeof core.fmt).toBe('function');
    expect(typeof core.Formatter).toBe('function');
  });

  it('should export linter', () => {
    expect(typeof core.lint).toBe('function');
    expect(typeof core.getRules).toBe('function');
    expect(typeof core.Linter).toBe('function');
    expect(Array.isArray(core.BUILTIN_RULES)).toBe(true);
  });

  it('should export import resolver', () => {
    expect(typeof core.resolveImports).toBe('function');
    expect(typeof core.allImportsResolved).toBe('function');
    expect(typeof core.getUnresolvedImports).toBe('function');
    expect(typeof core.ImportResolver).toBe('function');
  });

  it('should export verification namespace', () => {
    expect(core.verification).toBeDefined();
    expect(typeof core.verification.verify).toBe('function');
    expect(typeof core.verification.verifyWithClauses).toBe('function');
    expect(typeof core.verification.hasExplicitBindings).toBe('function');
    expect(typeof core.verification.formatVerificationSummary).toBe('function');
  });

  it('should export testgen namespace', () => {
    expect(core.testgen).toBeDefined();
    expect(typeof core.testgen.generateTests).toBe('function');
    expect(typeof core.testgen.generateBehaviorTests).toBe('function');
    expect(typeof core.testgen.generateTestCode).toBe('function');
    expect(typeof core.testgen.TestGenerator).toBe('function');
  });

  it('should export version info', () => {
    expect(typeof core.VERSION).toBe('string');
    expect(typeof core.API_VERSION).toBe('number');
    expect(core.VERSION).toBe('0.1.0');
    expect(core.API_VERSION).toBe(1);
  });

  it('should export lexer types and classes', () => {
    expect(typeof core.Lexer).toBe('function');
    expect(core.TokenType).toBeDefined();
  });

  it('should export parser types and classes', () => {
    expect(typeof core.Parser).toBe('function');
  });

  it('should export AST builders', () => {
    expect(typeof core.span).toBe('function');
    expect(typeof core.emptySpan).toBe('function');
    expect(typeof core.identifier).toBe('function');
    expect(typeof core.stringLiteral).toBe('function');
    expect(typeof core.domainDeclaration).toBe('function');
    expect(typeof core.entityDeclaration).toBe('function');
    expect(typeof core.behaviorDeclaration).toBe('function');
  });

  describe('API Surface Snapshot', () => {
    it('should match the expected export list', () => {
      const exportedKeys = Object.keys(core).sort();
      
      // This is the canonical list of exports
      // Update this when intentionally changing the API
      const expectedExports = [
        // Version info
        'API_VERSION',
        'VERSION',
        
        // High-level APIs
        'compile',
        'parseISL',
        
        // Lexer
        'KEYWORDS',
        'Lexer',
        'TokenType',
        'createToken',
        'getKeywordType',
        'isKeyword',
        'tokenTypeName',
        'tokenize',
        
        // Parser
        'ParseException',
        'Parser',
        'parse',
        
        // AST Builders
        'annotation',
        'arrayType',
        'behaviorDeclaration',
        'binaryExpression',
        'booleanLiteral',
        'callExpression',
        'comparisonExpression',
        'condition',
        'conditionBlock',
        'conditionStatement',
        'domainDeclaration',
        'durationLiteral',
        'emptySpan',
        'entityDeclaration',
        'errorDeclaration',
        'fieldDeclaration',
        'genericType',
        'identifier',
        'inputBlock',
        'invariantStatement',
        'logicalExpression',
        'memberExpression',
        'nullLiteral',
        'numberLiteral',
        'objectType',
        'oldExpression',
        'outputBlock',
        'simpleType',
        'span',
        'stringLiteral',
        'temporalBlock',
        'temporalRequirement',
        'typeConstraint',
        'unaryExpression',
        'unionType',
        
        // Type Checker
        'TypeChecker',
        'check',
        'isValid',
        
        // Formatter
        'Formatter',
        'format',
        'fmt',
        
        // Linter
        'BUILTIN_RULES',
        'Linter',
        'getRules',
        'lint',
        
        // Import Resolver
        'ImportResolver',
        'allImportsResolved',
        'getUnresolvedImports',
        'resolveImports',
        
        // Namespaces
        'testgen',
        'verification',
      ].sort();

      expect(exportedKeys).toEqual(expectedExports);
    });
  });
});

describe('Functional Tests', () => {
  const testSource = `
domain TestDomain {
  entity User {
    id: UUID
    email: String
    name: String
  }
  
  behavior CreateUser {
    description: "Creates a new user"
    
    input {
      email: String
      name: String
    }
    
    output {
      success: User
      errors {
        EmailExists
        InvalidEmail
      }
    }
    
    preconditions {
      - email.contains("@")
    }
    
    postconditions {
      success implies {
        - result.email == input.email
      }
    }
  }
}`;

  it('should parse valid ISL', () => {
    const result = core.parseISL(testSource);
    
    expect(result.errors).toHaveLength(0);
    expect(result.ast).not.toBeNull();
    expect(result.ast?.name.name).toBe('TestDomain');
    expect(result.ast?.entities).toHaveLength(1);
    expect(result.ast?.behaviors).toHaveLength(1);
  });

  it('should type check parsed AST', () => {
    const parseResult = core.parseISL(testSource);
    expect(parseResult.ast).not.toBeNull();
    
    const checkResult = core.check(parseResult.ast!);
    
    expect(checkResult.valid).toBe(true);
    expect(checkResult.diagnostics).toHaveLength(0);
    expect(checkResult.symbols).toBeDefined();
  });

  it('should format parsed AST', () => {
    const parseResult = core.parseISL(testSource);
    expect(parseResult.ast).not.toBeNull();
    
    const formatted = core.format(parseResult.ast!);
    
    expect(formatted).toContain('domain TestDomain');
    expect(formatted).toContain('entity User');
    expect(formatted).toContain('behavior CreateUser');
  });

  it('should lint parsed AST', () => {
    const parseResult = core.parseISL(testSource);
    expect(parseResult.ast).not.toBeNull();
    
    const lintResult = core.lint(parseResult.ast!);
    
    expect(lintResult.errorCount).toBe(0);
    // May have info/warning messages for best practices
    expect(lintResult.messages).toBeDefined();
  });

  it('should run full compile pipeline', () => {
    const result = core.compile(testSource);
    
    expect(result.parse.ast).not.toBeNull();
    expect(result.check).toBeDefined();
    expect(result.lint).toBeDefined();
    expect(result.formatted).toBeDefined();
  });

  it('should generate tests from AST', () => {
    const parseResult = core.parseISL(testSource);
    expect(parseResult.ast).not.toBeNull();
    
    const suite = core.testgen.generateTests(parseResult.ast!);
    
    expect(suite.name).toContain('TestDomain');
    expect(suite.tests.length).toBeGreaterThan(0);
    expect(suite.tests.some(t => t.category === 'happy-path')).toBe(true);
  });
});
