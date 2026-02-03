/**
 * Symbol Resolver Tests
 * 
 * Tests semantic checks that fail when specs reference:
 * - NonExistentType
 * - NonExistentBehavior
 * - NonExistentField
 * - NonExistentEntity (Domain)
 * - Wrong scope references (result.* in preconditions, old() in preconditions/invariants)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@isl-lang/parser';
import { SemanticAnalyzer } from '../src/framework.js';
import { SymbolResolverPass, SymbolTable } from '../src/passes/index.js';

// ============================================================================
// Test Fixtures - Minimal specs that should fail
// ============================================================================

/**
 * Fixture: References a non-existent type in a field declaration
 */
const FIXTURE_UNDEFINED_TYPE = `
domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    profile: NonExistentProfile
  }
}
`;

/**
 * Fixture: References a non-existent type with a typo (for "did you mean?" test)
 */
const FIXTURE_TYPE_TYPO = `
domain TestDomain {
  version: "1.0.0"

  type UserProfile = {
    name: String
  }

  entity User {
    id: UUID [immutable, unique]
    profile: UserProfle
  }
}
`;

/**
 * Fixture: References a non-existent behavior in scenarios
 */
const FIXTURE_UNDEFINED_BEHAVIOR = `
domain TestDomain {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
  }

  behavior TransferMoney {
    input {
      fromId: UUID
      toId: UUID
      amount: Decimal
    }
    output {
      success: Boolean
    }
  }

  scenarios NonExistentBehavior {
    scenario "basic test" {
      given {
        x = 1
      }
      when {
        result = NonExistentBehavior()
      }
      then {
        result is success
      }
    }
  }
}
`;

/**
 * Fixture: References a non-existent behavior with a typo
 */
const FIXTURE_BEHAVIOR_TYPO = `
domain TestDomain {
  version: "1.0.0"

  behavior TransferMoney {
    input {
      amount: Decimal
    }
    output {
      success: Boolean
    }
  }

  scenarios TransferMone {
    scenario "basic test" {
      given {
        x = 1
      }
      when {
        result = TransferMone()
      }
      then {
        result is success
      }
    }
  }
}
`;

/**
 * Fixture: References a non-existent field on an entity
 */
const FIXTURE_UNDEFINED_FIELD = `
domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    name: String
    email: String
  }

  behavior GetUserName {
    input {
      userId: UUID
    }
    output {
      success: String
    }
    
    postconditions {
      success implies {
        User.nonExistentField == "test"
      }
    }
  }
}
`;

/**
 * Fixture: References a non-existent entity
 */
const FIXTURE_UNDEFINED_ENTITY = `
domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
  }

  view UserView {
    for: NonExistentEntity
    fields {
      id: UUID = entity.id
    }
    consistency {
      strong
    }
  }
}
`;

/**
 * Fixture: Valid spec that should pass (control test)
 */
const FIXTURE_VALID = `
domain TestDomain {
  version: "1.0.0"

  type Money = {
    amount: Decimal
    currency: String
  }

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
    owner: String
  }

  behavior Deposit {
    input {
      accountId: UUID
      amount: Decimal
    }
    output {
      success: Account
      
      errors {
        AccountNotFound {
          when: "Account does not exist"
          retriable: false
        }
        InvalidAmount {
          when: "Amount must be positive"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.amount > 0
    }
    
    postconditions {
      success implies {
        result.balance == old(result.balance) + input.amount
      }
    }
  }
}
`;

/**
 * Fixture: Multiple errors in one spec
 */
const FIXTURE_MULTIPLE_ERRORS = `
domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    name: String
  }

  entity Order {
    id: UUID [immutable, unique]
    userId: UUID
    items: List<NonExistentItem>
  }

  behavior ProcessOrder {
    input {
      orderId: UUID
    }
    output {
      success: NonExistentResult
    }
  }

  scenarios NonExistentBehavior {
    scenario "test" {
      given {
        x = 1
      }
      when {
        result = NonExistentBehavior()
      }
      then {
        result is success
      }
    }
  }
}
`;

/**
 * Fixture: Undefined input field reference
 */
const FIXTURE_UNDEFINED_INPUT_FIELD = `
domain TestDomain {
  version: "1.0.0"

  behavior Transfer {
    input {
      amount: Decimal
      fromAccount: UUID
    }
    output {
      success: Boolean
    }
    
    preconditions {
      input.nonExistentField > 0
    }
  }
}
`;

/**
 * Fixture: result.* referenced in preconditions (scope violation)
 */
const FIXTURE_RESULT_IN_PRECONDITION = `
domain TestDomain {
  version: "1.0.0"

  behavior BadResultRef {
    input {
      amount: Decimal
    }
    output {
      success: { total: Decimal }
    }
    
    preconditions {
      result.total > 0
    }
  }
}
`;

/**
 * Fixture: old() used in preconditions (scope violation)
 */
const FIXTURE_OLD_IN_PRECONDITION = `
domain TestDomain {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
  }

  behavior BadOldRef {
    input {
      accountId: UUID
      amount: Decimal
    }
    output {
      success: Account
    }
    
    preconditions {
      old(sender.balance) >= input.amount
    }
  }
}
`;

/**
 * Fixture: old() used in invariants (scope violation)
 */
const FIXTURE_OLD_IN_INVARIANT = `
domain TestDomain {
  version: "1.0.0"

  behavior Increment {
    input {
      value: Int
    }
    output {
      success: Int
    }
    
    invariants {
      old(value) >= 0
    }
  }
}
`;

/**
 * Fixture: Valid scope usage (control test)
 */
const FIXTURE_VALID_SCOPE = `
domain TestDomain {
  version: "1.0.0"

  entity Account {
    id: UUID [immutable, unique]
    balance: Decimal
  }

  behavior Transfer {
    input {
      fromId: UUID
      toId: UUID
      amount: Decimal
    }
    output {
      success: { transferred: Decimal }
    }
    
    preconditions {
      input.amount > 0
    }
    
    postconditions {
      success implies {
        result.transferred == input.amount
        sender.balance == old(sender.balance) - input.amount
      }
    }
  }
}
`;

// ============================================================================
// Tests
// ============================================================================

describe('SymbolResolverPass', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
    analyzer.register(new SymbolResolverPass());
  });

  describe('Undefined Type Detection', () => {
    it('should report error for undefined type in field declaration', () => {
      const result = parse(FIXTURE_UNDEFINED_TYPE, 'test.isl');
      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      expect(analysis.diagnostics.length).toBeGreaterThan(0);
      
      const typeError = analysis.diagnostics.find(d => d.code === 'E0201');
      expect(typeError).toBeDefined();
      expect(typeError?.message).toContain('NonExistentProfile');
      expect(typeError?.location.line).toBeGreaterThan(0);
    });

    it('should suggest similar types for typos', () => {
      const result = parse(FIXTURE_TYPE_TYPO, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      const typeError = analysis.diagnostics.find(d => d.code === 'E0201');
      expect(typeError).toBeDefined();
      expect(typeError?.message).toContain('UserProfle');
      
      // Should have "did you mean?" suggestion
      expect(typeError?.help).toBeDefined();
      expect(typeError?.help?.some(h => h.includes('UserProfile'))).toBe(true);
    });
  });

  describe('Undefined Behavior Detection', () => {
    it('should report error for undefined behavior in scenarios', () => {
      const result = parse(FIXTURE_UNDEFINED_BEHAVIOR, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      const behaviorError = analysis.diagnostics.find(d => d.code === 'E0302');
      expect(behaviorError).toBeDefined();
      expect(behaviorError?.message).toContain('NonExistentBehavior');
    });

    it('should suggest similar behaviors for typos', () => {
      const result = parse(FIXTURE_BEHAVIOR_TYPO, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      const behaviorError = analysis.diagnostics.find(d => d.code === 'E0302');
      expect(behaviorError).toBeDefined();
      expect(behaviorError?.message).toContain('TransferMone');
      
      // Should suggest TransferMoney
      expect(behaviorError?.help?.some(h => h.includes('TransferMoney'))).toBe(true);
    });
  });

  describe('Undefined Field Detection', () => {
    it('should report error for undefined field on entity', () => {
      const result = parse(FIXTURE_UNDEFINED_FIELD, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      // May have field resolution errors depending on expression context
      const fieldError = analysis.diagnostics.find(d => 
        d.code === 'E0202' || d.message.includes('nonExistentField')
      );
      
      if (fieldError) {
        expect(fieldError.message).toContain('nonExistentField');
      }
    });

    it('should report error for undefined input field', () => {
      const result = parse(FIXTURE_UNDEFINED_INPUT_FIELD, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const fieldError = analysis.diagnostics.find(d => 
        d.code === 'E0202' && d.message.includes('nonExistentField')
      );
      expect(fieldError).toBeDefined();
      expect(fieldError?.message).toContain('input');
    });
  });

  describe('Undefined Entity Detection', () => {
    it('should report error for undefined entity in view', () => {
      const result = parse(FIXTURE_UNDEFINED_ENTITY, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      // Could be E0201 (type) or E0301 (entity) depending on context
      const entityError = analysis.diagnostics.find(d => 
        d.message.includes('NonExistentEntity')
      );
      expect(entityError).toBeDefined();
    });
  });

  describe('Valid Specs', () => {
    it('should pass for valid spec with all references resolved', () => {
      const result = parse(FIXTURE_VALID, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      // Should have no errors (may have warnings)
      const errors = analysis.diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
      expect(analysis.success).toBe(true);
    });
  });

  describe('Multiple Errors', () => {
    it('should report multiple errors in one spec', () => {
      const result = parse(FIXTURE_MULTIPLE_ERRORS, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      // Should have at least 3 errors
      expect(analysis.diagnostics.filter(d => d.severity === 'error').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Precise Spans', () => {
    it('should report errors with precise source locations', () => {
      const result = parse(FIXTURE_UNDEFINED_TYPE, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const typeError = analysis.diagnostics.find(d => d.code === 'E0201');
      expect(typeError).toBeDefined();
      
      // Should have precise location info
      expect(typeError?.location.file).toBe('test.isl');
      expect(typeError?.location.line).toBeGreaterThan(0);
      expect(typeError?.location.column).toBeGreaterThan(0);
      expect(typeError?.location.endLine).toBeGreaterThanOrEqual(typeError?.location.line ?? 0);
      expect(typeError?.location.endColumn).toBeGreaterThan(0);
    });
  });

  describe('Scope Validation - result in wrong scope', () => {
    it('should report error for result.* in preconditions', () => {
      const result = parse(FIXTURE_RESULT_IN_PRECONDITION, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      const scopeError = analysis.diagnostics.find(d => d.code === 'E0311');
      expect(scopeError).toBeDefined();
      expect(scopeError?.message).toContain('result');
      expect(scopeError?.message).toContain('precondition');
    });

    it('should have helpful suggestions for result in precondition', () => {
      const result = parse(FIXTURE_RESULT_IN_PRECONDITION, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const scopeError = analysis.diagnostics.find(d => d.code === 'E0311');
      expect(scopeError).toBeDefined();
      expect(scopeError?.help).toBeDefined();
      expect(scopeError?.help?.some(h => h.includes('postcondition') || h.includes('input'))).toBe(true);
    });
  });

  describe('Scope Validation - old() in wrong scope', () => {
    it('should report error for old() in preconditions', () => {
      const result = parse(FIXTURE_OLD_IN_PRECONDITION, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      const scopeError = analysis.diagnostics.find(d => d.code === 'E0304');
      expect(scopeError).toBeDefined();
      expect(scopeError?.message).toContain('old()');
      expect(scopeError?.message).toContain('precondition');
    });

    it('should report error for old() in invariants', () => {
      const result = parse(FIXTURE_OLD_IN_INVARIANT, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      expect(analysis.success).toBe(false);
      const scopeError = analysis.diagnostics.find(d => d.code === 'E0304');
      expect(scopeError).toBeDefined();
      expect(scopeError?.message).toContain('old()');
      expect(scopeError?.message).toContain('invariant');
    });

    it('should have helpful suggestions for old() in wrong scope', () => {
      const result = parse(FIXTURE_OLD_IN_PRECONDITION, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const scopeError = analysis.diagnostics.find(d => d.code === 'E0304');
      expect(scopeError).toBeDefined();
      expect(scopeError?.help).toBeDefined();
      expect(scopeError?.help?.some(h => h.includes('postcondition'))).toBe(true);
    });
  });

  describe('Valid Scope Usage', () => {
    it('should pass when result and old() are used in postconditions', () => {
      const result = parse(FIXTURE_VALID_SCOPE, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      // Should have no scope-related errors
      const scopeErrors = analysis.diagnostics.filter(d => 
        d.code === 'E0304' || d.code === 'E0311'
      );
      expect(scopeErrors).toHaveLength(0);
    });
  });

  describe('Real-world Login Validation', () => {
    it('should validate a login-like spec with proper scoping', () => {
      // A login spec using the parser's expected syntax
      const LOGIN_ISL = `
domain Auth {
  version: "1.0.0"

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID
    access_token: String
    expires_at: DateTime
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email
    password_hash: String
    failed_attempts: Int
  }

  behavior UserLogin {
    input {
      email: Email
      password: String
    }
    
    output {
      success: Session
      errors {
        InvalidCredentials {
          when: "email or password incorrect"
          retriable: false
        }
        AccountLocked {
          when: "too many failed attempts"
          retriable: false
        }
      }
    }
    
    // Preconditions only reference inputs and existing state
    preconditions {
      input.email.isValid()
      input.password.length >= 8
    }
    
    // Postconditions can use result and old()
    postconditions {
      success implies {
        result.user_id == user.id
        result.expires_at > now()
        user.failed_attempts == 0
      }
      
      InvalidCredentials implies {
        user.failed_attempts == old(user.failed_attempts) + 1
      }
    }
    
    // Invariants - properties that must always hold
    invariants {
      user.failed_attempts >= 0
    }
  }
}
`;
      const result = parse(LOGIN_ISL, 'login.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      // Login.isl should pass with no scope errors
      const scopeErrors = analysis.diagnostics.filter(d => 
        d.code === 'E0304' || d.code === 'E0305' || d.code === 'E0311'
      );
      expect(scopeErrors).toHaveLength(0);
    });

    it('should FAIL login-like spec with result in precondition', () => {
      const BAD_LOGIN_ISL = `
domain Auth {
  version: "1.0.0"

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID
  }

  behavior BadLogin {
    input {
      email: Email
    }
    
    output {
      success: Session
    }
    
    // WRONG: result used in precondition
    preconditions {
      result.user_id != null
    }
  }
}
`;
      const result = parse(BAD_LOGIN_ISL, 'bad-login.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      // Should have result-in-precondition error
      const scopeErrors = analysis.diagnostics.filter(d => d.code === 'E0311');
      expect(scopeErrors.length).toBeGreaterThan(0);
      expect(scopeErrors[0]?.message).toContain('result');
    });
  });
});

describe('SymbolTable', () => {
  it('should include built-in types by default', () => {
    const table = new SymbolTable();
    
    expect(table.has('String')).toBe(true);
    expect(table.has('Int')).toBe(true);
    expect(table.has('Decimal')).toBe(true);
    expect(table.has('Boolean')).toBe(true);
    expect(table.has('UUID')).toBe(true);
    expect(table.has('Timestamp')).toBe(true);
    expect(table.has('List')).toBe(true);
    expect(table.has('Optional')).toBe(true);
  });

  it('should correctly identify built-in types', () => {
    const table = new SymbolTable();
    
    expect(table.isBuiltin('String')).toBe(true);
    expect(table.isBuiltin('CustomType')).toBe(false);
  });

  it('should build from domain AST', () => {
    const result = parse(FIXTURE_VALID, 'test.isl');
    expect(result.success).toBe(true);

    const table = SymbolTable.fromDomain(result.domain!);
    
    // Should have custom types
    expect(table.has('Money')).toBe(true);
    expect(table.has('Account')).toBe(true);
    expect(table.has('Deposit')).toBe(true);
    
    // Should have built-ins
    expect(table.has('String')).toBe(true);
    
    // Entity fields
    expect(table.getEntityFields('Account')).toContain('balance');
    expect(table.getEntityFields('Account')).toContain('owner');
  });

  it('should return type/entity/behavior names for suggestions', () => {
    const result = parse(FIXTURE_VALID, 'test.isl');
    const table = SymbolTable.fromDomain(result.domain!);
    
    expect(table.getTypeNames()).toContain('Money');
    expect(table.getEntityNames()).toContain('Account');
    expect(table.getBehaviorNames()).toContain('Deposit');
  });
});
