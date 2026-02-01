// ============================================================================
// Advanced Features Tests - Tests parser coverage for complex language features
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

describe('Advanced Parser Features', () => {
  describe('Temporal Specifications', () => {
    it('should parse response time constraints', () => {
      const source = `
        domain Temporal {
          version: "1.0.0"
          behavior Fast {
            input { value: String }
            output { success: Boolean }
            temporal {
              response within 100.ms
              response within 1.seconds
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.temporal.length).toBeGreaterThan(0);
    });

    it('should parse eventually constraints', () => {
      const source = `
        domain Temporal {
          version: "1.0.0"
          behavior Async {
            input { value: String }
            output { success: Boolean }
            temporal {
              eventually within 5.minutes: task_completed
              eventually within 1.hours: notification_sent
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse immediately constraints', () => {
      const source = `
        domain Temporal {
          version: "1.0.0"
          behavior Immediate {
            input { value: String }
            output { success: Boolean }
            temporal {
              immediately: cache_invalidated
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Security Specifications', () => {
    it('should parse rate limits', () => {
      const source = `
        domain Security {
          version: "1.0.0"
          behavior RateLimited {
            input { value: String }
            output { success: Boolean }
            security {
              rate_limit 100 per ip_address
              rate_limit 10 per input.value
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse fraud check', () => {
      const source = `
        domain Security {
          version: "1.0.0"
          behavior Secure {
            input { value: String }
            output { success: Boolean }
            security {
              fraud_check
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Compliance Specifications', () => {
    it('should parse compliance requirements', () => {
      const source = `
        domain Compliance {
          version: "1.0.0"
          behavior Compliant {
            input { value: String }
            output { success: Boolean }
            compliance {
              gdpr_consent_required
              audit_trail
              pci_dss
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Observability Specifications', () => {
    it('should parse metrics', () => {
      const source = `
        domain Observability {
          version: "1.0.0"
          behavior Observable {
            input { value: String }
            output { success: Boolean }
            observability {
              metrics {
                counter: requests_total
                histogram: request_duration
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse traces', () => {
      const source = `
        domain Observability {
          version: "1.0.0"
          behavior Traced {
            input { value: String }
            output { success: Boolean }
            observability {
              traces {
                span: process_request
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Actor Specifications', () => {
    it('should parse actors with conditions', () => {
      const source = `
        domain Actors {
          version: "1.0.0"
          behavior Protected {
            actors {
              User { must: authenticated }
              Admin { must: authenticated, role: admin }
              System { }
              Anonymous { }
            }
            input { value: String }
            output { success: Boolean }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const behavior = result.domain?.behaviors[0];
      expect(behavior?.actors.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Expressions', () => {
    it('should parse quantifier expressions', () => {
      const source = `
        domain Quantifiers {
          version: "1.0.0"
          entity User {
            id: UUID
            items: List<String>
            
            invariants {
              all(item in items: item.length > 0)
              any(item in items: item == "special")
              none(item in items: item == "forbidden")
              count(item in items: item.length > 5) > 0
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse old() expressions', () => {
      const source = `
        domain OldExpr {
          version: "1.0.0"
          entity Counter {
            id: UUID
            value: Int
          }
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
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse conditional expressions', () => {
      const source = `
        domain Conditional {
          version: "1.0.0"
          entity Item {
            id: UUID
            value: Int
            status: String
            
            invariants {
              value > 0 implies status == "positive"
              value == 0 implies status == "zero"
              value < 0 implies status == "negative"
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse member access chains', () => {
      const source = `
        domain MemberAccess {
          version: "1.0.0"
          entity Data {
            id: UUID
            nested: {
              inner: {
                value: String
              }
            }
            
            invariants {
              nested.inner.value.length > 0
              nested.inner.value.is_valid
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse index expressions', () => {
      const source = `
        domain Index {
          version: "1.0.0"
          entity Data {
            id: UUID
            items: List<String>
            map: Map<String, Int>
            
            invariants {
              items[0].length > 0
              map["key"] > 0
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse function calls', () => {
      const source = `
        domain Calls {
          version: "1.0.0"
          entity User {
            id: UUID
            email: String
          }
          behavior Find {
            input { email: String }
            output { success: User }
            preconditions {
              User.exists(email: input.email)
              User.lookup(input.email).id != null
              User.count > 0
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Lifecycle Parsing', () => {
    it('should parse simple lifecycle', () => {
      const source = `
        domain Lifecycle {
          version: "1.0.0"
          entity Task {
            id: UUID
            status: String
            
            lifecycle {
              TODO -> IN_PROGRESS
              IN_PROGRESS -> DONE
              IN_PROGRESS -> BLOCKED
              BLOCKED -> IN_PROGRESS
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const entity = result.domain?.entities[0];
      expect(entity?.lifecycle).toBeDefined();
      expect(entity?.lifecycle?.transitions.length).toBeGreaterThan(0);
    });

    it('should parse chained transitions', () => {
      const source = `
        domain Lifecycle {
          version: "1.0.0"
          entity Order {
            id: UUID
            status: String
            
            lifecycle {
              PENDING -> CONFIRMED -> SHIPPED -> DELIVERED
              PENDING -> CANCELLED
              CONFIRMED -> CANCELLED
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('View Parsing', () => {
    it('should parse view with fields', () => {
      const source = `
        domain Views {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
            email: String
            password_hash: String
          }
          view PublicUser {
            entity: User
            fields {
              id
              name
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const view = result.domain?.views[0];
      expect(view?.name.name).toBe('PublicUser');
      expect(view?.fields.length).toBe(2);
    });

    it('should parse view with consistency and cache', () => {
      const source = `
        domain Views {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
          }
          behavior UpdateUser {
            input { id: UUID, name: String }
            output { success: User }
          }
          view CachedUser {
            entity: User
            fields { id, name }
            consistency: eventual
            cache {
              ttl: 5.minutes
              invalidate_on: [UpdateUser]
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const view = result.domain?.views[0];
      expect(view?.consistency).toBeDefined();
      expect(view?.cache).toBeDefined();
    });
  });

  describe('Policy Parsing', () => {
    it('should parse policy with rules', () => {
      const source = `
        domain Policies {
          version: "1.0.0"
          entity User {
            id: UUID
            role: String
          }
          policy AccessControl {
            description: "Access control policy"
            rules {
              rule "allow admins" {
                when: actor.role == "admin"
                allow: [ReadUser, UpdateUser, DeleteUser]
              }
              rule "allow self" {
                when: actor.id == resource.id
                allow: [ReadUser, UpdateUser]
              }
              default: deny
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const policy = result.domain?.policies[0];
      expect(policy?.name.name).toBe('AccessControl');
    });
  });

  describe('Chaos Testing', () => {
    it('should parse chaos injections', () => {
      const source = `
        domain Chaos {
          version: "1.0.0"
          behavior Create {
            input { value: String }
            output { success: Boolean errors { FAILED {} } }
          }
          chaos Create {
            chaos "failure injection" {
              inject {
                database_failure(target: Repository, mode: UNAVAILABLE)
              }
              when {
                result = Create(value: "test")
              }
              then {
                result is FAILED or result is error
              }
            }
            chaos "latency injection" {
              inject {
                latency(target: Service, delay: 5.seconds)
              }
              when {
                result = Create(value: "test")
              }
              then {
                response_time < 10.seconds
              }
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      
      const chaos = result.domain?.chaos[0];
      expect(chaos?.scenarios.length).toBe(2);
    });
  });

  describe('Error Recovery', () => {
    it('should recover and continue parsing after error', () => {
      const source = `
        domain Recovery {
          version: "1.0.0"
          
          entity Good {
            id: UUID
            name: String
          }
          
          entity Bad {
            id: UUID
            invalid@field: String
          }
          
          entity AlsoGood {
            id: UUID
            value: Int
          }
        }
      `;
      
      const result = parse(source);
      
      // Should have errors but still parse some content
      expect(result.errors.length).toBeGreaterThan(0);
      // May have partial AST
    });

    it('should collect multiple errors', () => {
      const source = `
        domain Multiple {
          entity NoId { name: String }
          entity Also { value: $invalid }
        }
      `;
      
      const result = parse(source);
      
      // Should collect multiple errors
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Comments', () => {
    it('should handle line comments', () => {
      const source = `
        // This is a domain comment
        domain Comments {
          version: "1.0.0" // inline comment
          
          // Entity comment
          entity User {
            id: UUID // field comment
            name: String
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should handle block comments', () => {
      const source = `
        /* 
         * Multi-line comment
         * describing the domain
         */
        domain BlockComments {
          version: "1.0.0"
          
          entity User {
            id: UUID
            /* inline block */ name: String
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('String Escapes', () => {
    it('should handle escape sequences', () => {
      const source = `
        domain Escapes {
          version: "1.0.0"
          behavior Test {
            description: "Line 1\\nLine 2\\tTabbed"
            input { value: String }
            output { success: Boolean }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
      expect(result.domain?.behaviors[0]?.description?.value).toContain('\\n');
    });

    it('should handle quotes in strings', () => {
      const source = `
        domain Quotes {
          version: "1.0.0"
          behavior Test {
            description: "He said \\"hello\\""
            input { value: String }
            output { success: Boolean }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Duration Literals', () => {
    it('should parse various duration units', () => {
      const source = `
        domain Durations {
          version: "1.0.0"
          behavior Test {
            input { value: String }
            output { 
              success: Boolean 
              errors {
                RATE_LIMITED {
                  when: "Rate limited"
                  retry_after: 30.seconds
                }
              }
            }
            temporal {
              response within 100.ms
              response within 5.seconds
              eventually within 1.minutes: done
              eventually within 2.hours: complete
              eventually within 1.days: archived
            }
          }
        }
      `;
      
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });
});

describe('AST Integrity', () => {
  it('should have consistent location information', () => {
    const source = `
      domain Test {
        version: "1.0.0"
        entity User {
          id: UUID
        }
      }
    `;
    
    const result = parse(source, 'test.isl');
    
    expect(result.domain?.location).toBeDefined();
    expect(result.domain?.location.file).toBe('test.isl');
    expect(result.domain?.location.line).toBeGreaterThan(0);
    expect(result.domain?.location.column).toBeGreaterThan(0);
    
    const entity = result.domain?.entities[0];
    expect(entity?.location).toBeDefined();
    expect(entity?.location.file).toBe('test.isl');
  });

  it('should preserve source information in tokens', () => {
    const source = `
      domain Test {
        version: "1.0.0"
      }
    `;
    
    const result = parse(source);
    
    expect(result.tokens).toBeDefined();
    expect(result.tokens.length).toBeGreaterThan(0);
    
    // Each token should have location
    for (const token of result.tokens) {
      expect(token.location).toBeDefined();
      expect(token.location.line).toBeGreaterThan(0);
    }
  });
});
