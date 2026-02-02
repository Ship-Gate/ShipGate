// ============================================================================
// Parser Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

describe('Parser', () => {
  describe('Domain Parsing', () => {
    it('should parse a minimal domain', () => {
      const source = `
        domain Minimal {
          version: "1.0.0"
          entity User {
            id: UUID [immutable, unique]
            name: String
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();
      expect(result.domain?.name.name).toBe('Minimal');
      expect(result.domain?.version.value).toBe('1.0.0');
    });

    it('should parse domain with owner', () => {
      const source = `
        domain WithOwner {
          version: "1.0.0"
          owner: "team@example.com"
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.owner?.value).toBe('team@example.com');
    });

    it('should report missing version', () => {
      const source = `
        domain NoVersion {
          entity User { id: UUID }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('version'))).toBe(true);
    });
  });

  describe('Entity Parsing', () => {
    it('should parse entity with fields', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID [immutable, unique]
            name: String
            age: Int
            email: String [indexed]
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.entities).toHaveLength(1);
      
      const user = result.domain?.entities[0];
      expect(user?.name.name).toBe('User');
      expect(user?.fields).toHaveLength(4);
      
      const idField = user?.fields.find(f => f.name.name === 'id');
      expect(idField?.type.kind).toBe('PrimitiveType');
      expect(idField?.annotations).toHaveLength(2);
    });

    it('should parse entity with invariants', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            age: Int
            invariants {
              age >= 0
              age <= 150
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const user = result.domain?.entities[0];
      expect(user?.invariants).toHaveLength(2);
    });

    it('should parse entity with lifecycle', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Order {
            status: String
            lifecycle {
              PENDING -> CONFIRMED
              CONFIRMED -> SHIPPED
              SHIPPED -> DELIVERED
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const order = result.domain?.entities[0];
      expect(order?.lifecycle).toBeDefined();
      expect(order?.lifecycle?.transitions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Type Parsing', () => {
    it('should parse primitive types', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Data {
            s: String
            i: Int
            d: Decimal
            b: Boolean
            t: Timestamp
            u: UUID
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const data = result.domain?.entities[0];
      expect(data?.fields).toHaveLength(6);
      
      data?.fields.forEach(field => {
        expect(field.type.kind).toBe('PrimitiveType');
      });
    });

    it('should parse constrained types', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          type Email = String {
            max_length: 254
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.types).toHaveLength(1);
      
      const email = result.domain?.types[0];
      expect(email?.name.name).toBe('Email');
      expect(email?.definition.kind).toBe('ConstrainedType');
    });

    it('should parse enum types', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          enum Status {
            ACTIVE
            INACTIVE
            PENDING
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const status = result.domain?.types[0];
      expect(status?.definition.kind).toBe('EnumType');
      
      if (status?.definition.kind === 'EnumType') {
        expect(status.definition.variants).toHaveLength(3);
      }
    });

    it('should parse struct types', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          type Address = {
            line1: String
            city: String
            country: String
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const address = result.domain?.types[0];
      expect(address?.definition.kind).toBe('StructType');
      
      if (address?.definition.kind === 'StructType') {
        expect(address.definition.fields).toHaveLength(3);
      }
    });

    it('should parse optional types', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            nickname: String?
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const user = result.domain?.entities[0];
      const nickname = user?.fields[0];
      expect(nickname?.type.kind).toBe('OptionalType');
    });
  });

  describe('Behavior Parsing', () => {
    it('should parse basic behavior', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior DoSomething {
            input {
              value: String
            }
            output {
              success: Boolean
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.behaviors).toHaveLength(1);
      
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.name.name).toBe('DoSomething');
      expect(behavior?.input.fields).toHaveLength(1);
    });

    it('should parse behavior with description', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Login {
            description: "Authenticate a user"
            input { email: String }
            output { success: Boolean }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.description?.value).toBe('Authenticate a user');
    });

    it('should parse behavior with preconditions (shorthand)', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { value: Int }
            output { success: Boolean }
            pre {
              input.value > 0
              input.value < 100
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.preconditions).toHaveLength(2);
    });

    it('should parse behavior with postconditions (shorthand)', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { value: Int }
            output { success: Boolean }
            post success {
              result == true
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.postconditions).toHaveLength(1);
      expect(behavior?.postconditions[0]?.condition).toBe('success');
    });

    it('should parse multiple post blocks (shorthand)', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { value: Int }
            output { success: Boolean }
            post success {
              result == true
            }
            post failure {
              no_changes_made == true
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.postconditions).toHaveLength(2);
      expect(behavior?.postconditions[0]?.condition).toBe('success');
      expect(behavior?.postconditions[1]?.condition).toBe('any_error');
    });

    it('should parse legacy verbose preconditions/postconditions (backward compat)', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Create {
            input { value: Int }
            output { success: Boolean }
            preconditions {
              input.value > 0
            }
            postconditions {
              success implies {
                result == true
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.preconditions).toHaveLength(1);
      expect(behavior?.postconditions).toHaveLength(1);
    });

    it('should parse behavior with errors', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Login {
            input { email: String }
            output {
              success: Boolean
              errors {
                NOT_FOUND {
                  when: "User not found"
                  retriable: false
                }
                LOCKED {
                  when: "Account locked"
                  retriable: true
                  retry_after: 15.minutes
                }
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.output.errors).toHaveLength(2);
      
      const locked = behavior?.output.errors.find(e => e.name.name === 'LOCKED');
      expect(locked?.retriable).toBe(true);
    });
  });

  describe('Expression Parsing', () => {
    it('should parse binary expressions', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { a: Int b: Int }
            output { success: Boolean }
            pre {
              a + b > 0
              a * 2 == b
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.preconditions).toHaveLength(2);
      expect(behavior?.preconditions[0]?.kind).toBe('BinaryExpr');
    });

    it('should parse member access', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { user: UUID }
            output { success: Boolean }
            pre {
              User.lookup(input.user).status == ACTIVE
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const precond = result.domain?.behaviors[0]?.preconditions[0];
      expect(precond?.kind).toBe('BinaryExpr');
    });

    it('should parse function calls', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { id: UUID }
            output { success: Boolean }
            pre {
              User.exists(input.id)
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const precond = result.domain?.behaviors[0]?.preconditions[0];
      expect(precond?.kind).toBe('CallExpr');
    });

    it('should parse quantifiers', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { items: UUID }
            output { success: Boolean }
            pre {
              all(input.items, item => item.valid)
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const precond = result.domain?.behaviors[0]?.preconditions[0];
      expect(precond?.kind).toBe('QuantifierExpr');
    });

    it('should parse old() expressions', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Increment {
            input { id: UUID }
            output { success: Boolean }
            post success {
              count == old(count) + 1
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const postcond = result.domain?.behaviors[0]?.postconditions[0];
      expect(postcond?.predicates[0]?.kind).toBe('BinaryExpr');
    });
  });

  describe('Scenario Parsing', () => {
    it('should parse scenario block', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          scenarios TestBehavior {
            scenario "happy path" {
              given {
                count = 0
              }
              when {
                result = DoSomething()
              }
              then {
                result == true
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.scenarios).toHaveLength(1);
      
      const scenarioBlock = result.domain?.scenarios[0];
      expect(scenarioBlock?.behaviorName.name).toBe('TestBehavior');
      expect(scenarioBlock?.scenarios).toHaveLength(1);
      expect(scenarioBlock?.scenarios[0]?.name.value).toBe('happy path');
    });
  });

  describe('View Parsing', () => {
    it('should parse view with fields', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          view Dashboard {
            for: User
            fields {
              total: Int = count(Order)
            }
            consistency {
              eventual within 5.seconds
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.views).toHaveLength(1);
      
      const view = result.domain?.views[0];
      expect(view?.name.name).toBe('Dashboard');
      expect(view?.fields).toHaveLength(1);
    });
  });

  describe('Policy Parsing', () => {
    it('should parse policy with rules', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          policy RateLimiting {
            applies_to: all behaviors
            rules {
              default: 1000
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.policies).toHaveLength(1);
      
      const policy = result.domain?.policies[0];
      expect(policy?.name.name).toBe('RateLimiting');
    });
  });

  describe('Import Parsing', () => {
    it('should parse imports', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          imports {
            User from "./user.isl"
            Money as Currency from "@stdlib/finance"
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.imports).toHaveLength(2);
      
      const moneyImport = result.domain?.imports[1];
      expect(moneyImport?.items[0]?.alias?.name).toBe('Currency');
    });
  });

  describe('Edge Cases - Scenarios and Chaos', () => {
    it('should parse multiple scenarios in a block', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          scenarios TestBehavior {
            scenario "first" {
              given { x = 1 }
              when { y = DoSomething() }
              then { y == true }
            }
            scenario "second" {
              given { x = 2 }
              when { y = DoSomethingElse() }
              then { y == false }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.scenarios[0]?.scenarios).toHaveLength(2);
    });

    it('should parse chaos block with multiple injections', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          chaos TestBehavior {
            chaos "network issues" {
              inject {
                network_latency(target: API, delay: 500ms)
                network_partition(target: DB)
              }
              when {
                result = TestBehavior()
              }
              then {
                result is error
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.chaos).toHaveLength(1);
      expect(result.domain?.chaos[0]?.scenarios[0]?.inject).toHaveLength(2);
    });

    it('should parse scenario with keyword as variable name', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          scenarios TestBehavior {
            scenario "using keywords" {
              given {
                count = 0
                sum = 100
                result = initial_value
              }
              when {
                output = Process()
              }
              then {
                output == count + sum
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const scenario = result.domain?.scenarios[0]?.scenarios[0];
      expect(scenario?.given).toHaveLength(3);
    });
  });

  describe('Edge Cases - Duration Literals', () => {
    it('should parse various duration units', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Timed {
            input { id: UUID }
            output { success: Boolean }
            temporal {
              response within 100ms
              response within 5.seconds
              eventually within 1.minutes: log_created
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.behaviors[0]?.temporal.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse duration in chaos inject', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          chaos TestBehavior {
            chaos "timeout test" {
              inject {
                network_latency(delay: 2.seconds)
              }
              when {
                result = TestBehavior()
              }
              then {
                result is error
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases - Quantifiers', () => {
    it('should parse quantifier calls with parentheses', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { items: UUID }
            output { success: Boolean }
            pre {
              count(input.items) > 0
              all(input.items, item => item.valid)
              any(input.items, item => item.special)
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      expect(result.domain?.behaviors[0]?.preconditions.length).toBe(3);
    });

    it('should parse quantifier keywords as identifiers when not followed by paren', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { count: Int }
            output { success: Boolean }
            pre {
              input.count > 0
              count == old(count) + 1
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases - Complex Expressions', () => {
    it('should parse nested member access and calls', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Complex {
            input { id: UUID }
            output { success: Boolean }
            pre {
              User.lookup(input.id).account.balance.amount >= 0
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const precond = result.domain?.behaviors[0]?.preconditions[0];
      expect(precond?.kind).toBe('BinaryExpr');
    });

    it('should parse logical expressions with old() and result', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Transfer {
            input { amount: Decimal }
            output { success: Boolean }
            post success {
              result.balance == old(balance) - input.amount
              result.timestamp > old(timestamp)
            }
          }
        }
      `;
      
      const result = parse(source);
      
      expect(result.success).toBe(true);
      const postcond = result.domain?.behaviors[0]?.postconditions[0];
      expect(postcond?.predicates).toHaveLength(2);
    });
  });
});
