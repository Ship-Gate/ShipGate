// ============================================================================
// Comprehensive Type Checker Tests
// Tests all error paths, operators, and expressions
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { TypeChecker, check } from '../src/index.js';
import { parse } from '@isl-lang/parser';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Helper to parse and check
function parseAndCheck(source: string): ReturnType<typeof check> {
  const parseResult = parse(source);
  if (!parseResult.success || !parseResult.domain) {
    throw new Error(`Parse failed: ${parseResult.errors.map(e => e.message).join(', ')}`);
  }
  return check(parseResult.domain);
}

// Helper to get errors only (no warnings)
function getErrors(result: ReturnType<typeof check>) {
  return result.diagnostics.filter(d => d.severity === 'error');
}

// Helper to get warnings
function getWarnings(result: ReturnType<typeof check>) {
  return result.diagnostics.filter(d => d.severity === 'warning');
}

// Path to test fixtures
const FIXTURES_ROOT = join(__dirname, '../../../test-fixtures');

describe('Type Resolution Errors', () => {
  describe('UNDEFINED_TYPE', () => {
    it('should detect undefined type in field', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            status: NonExistentType
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('NonExistentType'))).toBe(true);
    });

    it('should detect undefined type in behavior input', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { data: UnknownType }
            output { success: Boolean }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('UnknownType'))).toBe(true);
    });

    it('should suggest similar types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: Strng
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => 
        e.message.includes('Strng') || 
        (e.help && e.help.some(h => h.includes('String')))
      )).toBe(true);
    });
  });

  describe('UNDEFINED_ENTITY', () => {
    it('should detect undefined entity in behavior', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { id: UUID }
            output { success: Boolean }
            preconditions {
              NonExistentEntity.exists(input.id)
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('NonExistentEntity'))).toBe(true);
    });
  });

  describe('UNDEFINED_FIELD', () => {
    it('should detect undefined field access', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
          }
          behavior Update {
            input { id: UUID }
            output { success: User }
            preconditions {
              User.lookup(input.id).nonexistent > 0
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('nonexistent'))).toBe(true);
    });

    it('should detect undefined input field', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { name: String }
            output { success: Boolean }
            preconditions {
              input.email.length > 0
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('email'))).toBe(true);
    });
  });

  describe('UNDEFINED_BEHAVIOR', () => {
    it('should detect undefined behavior in scenario', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          scenarios NonExistent {
            scenario "test" {
              when { result = NonExistent() }
              then { result is success }
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('NonExistent'))).toBe(true);
    });
  });
});

describe('Duplicate Declaration Errors', () => {
  describe('DUPLICATE_TYPE', () => {
    it('should detect duplicate type definitions', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          type Email = String { max_length: 254 }
          type Email = String { max_length: 100 }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('Email') && e.message.includes('already'))).toBe(true);
    });
  });

  describe('DUPLICATE_ENTITY', () => {
    it('should detect duplicate entity definitions', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User { id: UUID }
          entity User { id: UUID; name: String }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('User') && e.message.includes('already'))).toBe(true);
    });
  });

  describe('DUPLICATE_FIELD', () => {
    it('should detect duplicate field in entity', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
            name: Int
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('name') && e.message.includes('already'))).toBe(true);
    });
  });

  describe('DUPLICATE_BEHAVIOR', () => {
    it('should detect duplicate behavior definitions', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create { input { name: String } output { success: Boolean } }
          behavior Create { input { email: String } output { success: Boolean } }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('Create') && e.message.includes('already'))).toBe(true);
    });
  });

  describe('DUPLICATE_ENUM_VARIANT', () => {
    it('should detect duplicate enum variants', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          enum Status {
            ACTIVE
            INACTIVE
            ACTIVE
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('ACTIVE'))).toBe(true);
    });
  });
});

describe('Type Mismatch Errors', () => {
  describe('TYPE_MISMATCH', () => {
    it('should detect string compared to number', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
            invariants {
              name > 10
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid assignment', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            age: Int
            invariants {
              age == "string"
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('INCOMPATIBLE_TYPES', () => {
    it('should detect incompatible operator types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            active: Boolean
            invariants {
              active + true
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('INVALID_OPERATOR', () => {
    it('should detect invalid operator for type', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            created: Timestamp
            invariants {
              created * 2
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Context Errors', () => {
  describe('OLD_OUTSIDE_POSTCONDITION', () => {
    it('should detect old() in precondition', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; value: Int }
          behavior Update {
            input { id: UUID }
            output { success: User }
            preconditions {
              old(User.lookup(input.id).value) > 0
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('old'))).toBe(true);
    });

    it('should detect old() in invariant', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            value: Int
            invariants {
              old(value) >= 0
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('old'))).toBe(true);
    });
  });

  describe('RESULT_OUTSIDE_POSTCONDITION', () => {
    it('should detect result in precondition', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { name: String }
            output { success: Boolean }
            preconditions {
              result == true
            }
          }
        }
      `);
      
      const errors = getErrors(result);
      expect(errors.some(e => e.message.includes('result'))).toBe(true);
    });
  });

  it('should allow old() in postcondition', () => {
    const result = parseAndCheck(`
      domain Test {
        version: "1.0.0"
        entity Counter { id: UUID; value: Int }
        behavior Increment {
          input { id: UUID }
          output { success: Counter }
          postconditions {
            success implies {
              result.value == old(Counter.lookup(input.id).value) + 1
            }
          }
        }
      }
    `);
    
    // Should not have context errors for old() in postcondition
    const contextErrors = getErrors(result).filter(e => 
      e.message.includes('old') && e.message.includes('postcondition')
    );
    expect(contextErrors.length).toBe(0);
  });
});

describe('Operator Type Checking', () => {
  describe('Arithmetic Operators', () => {
    it('should allow + on Int', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Value { id: UUID; a: Int; b: Int; invariants { a + b > 0 } }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow - on Decimal', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Value { id: UUID; a: Decimal; b: Decimal; invariants { a - b >= 0 } }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow * on Int', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Value { id: UUID; a: Int; invariants { a * 2 > 0 } }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow / on Decimal', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Value { id: UUID; a: Decimal; invariants { a / 2 > 0 } }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Comparison Operators', () => {
    it('should allow == on all comparable types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            name: String
            count: Int
            invariants {
              name == "test"
              count == 5
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow < > <= >= on numeric types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            value: Int
            invariants {
              value > 0
              value < 100
              value >= 1
              value <= 99
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Logical Operators', () => {
    it('should allow and/or on Boolean', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            a: Boolean
            b: Boolean
            invariants {
              a and b
              a or b
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow implies on Boolean', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            a: Boolean
            b: Boolean
            invariants {
              a implies b
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow not on Boolean', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            active: Boolean
            invariants {
              not active or active
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('String Operators', () => {
    it('should allow comparison on String', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            name: String
            invariants {
              name == "test"
              name != ""
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should allow length property on String', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            name: String
            invariants {
              name.length > 0
              name.length <= 100
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });
});

describe('Expression Type Inference', () => {
  describe('Literal Expressions', () => {
    it('should infer correct types for literals', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            s: String
            i: Int
            d: Decimal
            b: Boolean
            invariants {
              s == "string"
              i == 42
              d == 3.14
              b == true
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Member Access', () => {
    it('should type nested member access', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          type Address = { city: String; zip: String }
          entity User {
            id: UUID
            address: Address
            invariants {
              address.city.length > 0
              address.zip.length == 5
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Entity Methods', () => {
    it('should type Entity.exists()', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; name: String }
          behavior Create {
            input { id: UUID }
            output { success: Boolean }
            preconditions {
              not User.exists(input.id)
            }
          }
        }
      `);
      // exists() returns Boolean
      expect(getErrors(result).length).toBe(0);
    });

    it('should type Entity.lookup()', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; name: String }
          behavior Get {
            input { id: UUID }
            output { success: User }
            preconditions {
              User.lookup(input.id).name.length > 0
            }
          }
        }
      `);
      // lookup() returns Entity type
      expect(getErrors(result).length).toBe(0);
    });

    it('should type Entity.count', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User { id: UUID }
          behavior Create {
            input { name: String }
            output { success: User }
            postconditions {
              success implies {
                User.count == old(User.count) + 1
              }
            }
          }
        }
      `);
      // count returns Int
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Quantifier Expressions', () => {
    it('should type all() expression', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            values: List<Int>
            invariants {
              all(v in values: v > 0)
            }
          }
        }
      `);
      // all() returns Boolean
      expect(getErrors(result).length).toBe(0);
    });

    it('should type any() expression', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            values: List<Int>
            invariants {
              any(v in values: v == 0)
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should type none() expression', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            values: List<Int>
            invariants {
              none(v in values: v < 0)
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should type count() expression', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            values: List<Int>
            invariants {
              count(v in values: v > 10) >= 0
            }
          }
        }
      `);
      // count() returns Int
      expect(getErrors(result).length).toBe(0);
    });
  });
});

describe('Complex Type Checking', () => {
  describe('List Types', () => {
    it('should check List element types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            tags: List<String>
            invariants {
              tags.length >= 0
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should check nested List types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          type Matrix = List<List<Int>>
          entity Data {
            id: UUID
            matrix: Matrix
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Map Types', () => {
    it('should check Map key and value types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            data: Map<String, Int>
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Optional Types', () => {
    it('should check optional type handling', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            value: String?
            invariants {
              value != null implies value.length > 0
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Struct Types', () => {
    it('should check struct field types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          type Address = {
            street: String
            city: String
            zip: String
          }
          entity User {
            id: UUID
            address: Address
            invariants {
              address.city.length > 0
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Enum Types', () => {
    it('should check enum usage', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          enum Status { ACTIVE, INACTIVE, PENDING }
          entity User {
            id: UUID
            status: Status
            invariants {
              status == ACTIVE or status == INACTIVE or status == PENDING
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });
});

describe('Behavior Type Checking', () => {
  describe('Input/Output Types', () => {
    it('should check input field types', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create {
            input {
              name: String
              age: Int
            }
            output { success: Boolean }
            preconditions {
              input.name.length > 0
              input.age >= 0
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });

    it('should check output type', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; name: String }
          behavior Create {
            input { name: String }
            output { success: User }
            postconditions {
              success implies {
                result.name == input.name
              }
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });

  describe('Error Types', () => {
    it('should check error definitions', () => {
      const result = parseAndCheck(`
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { name: String }
            output {
              success: Boolean
              errors {
                INVALID_NAME { when: "Name is invalid" }
                ALREADY_EXISTS { when: "Already exists" }
              }
            }
          }
        }
      `);
      expect(getErrors(result).length).toBe(0);
    });
  });
});

describe('Fixture Integration', () => {
  const fixturesExist = existsSync(FIXTURES_ROOT);

  it.skipIf(!fixturesExist)('should typecheck valid/all-features.isl without errors', () => {
    const source = readFileSync(join(FIXTURES_ROOT, 'valid/all-features.isl'), 'utf-8');
    const parseResult = parse(source);
    
    if (!parseResult.success || !parseResult.domain) {
      throw new Error('Parse failed');
    }
    
    const result = check(parseResult.domain);
    const errors = getErrors(result);
    
    // All-features should have no type errors
    expect(errors.length).toBe(0);
  });

  it.skipIf(!fixturesExist)('should detect errors in type-error fixtures', () => {
    const files = [
      'invalid/type-errors/undefined-type.isl',
      'invalid/type-errors/duplicate-declaration.isl',
    ];

    for (const file of files) {
      const source = readFileSync(join(FIXTURES_ROOT, file), 'utf-8');
      const parseResult = parse(source);
      
      if (!parseResult.domain) continue;
      
      const result = check(parseResult.domain);
      expect(getErrors(result).length).toBeGreaterThan(0);
    }
  });
});
