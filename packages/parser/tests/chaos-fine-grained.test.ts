// ============================================================================
// Tests for fine-grained chaos AST nodes
// Covers: expect blocks, with clauses, inline inject syntax, ChaosExpectation,
// ChaosWithClause, ChaosArgument, and backward compatibility
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

describe('Fine-grained Chaos AST', () => {
  describe('expect { } blocks', () => {
    it('should parse expect block with expressions', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "database failure" {
              inject {
                database_failure(target: Repo)
              }
              when {
                result = TestBehavior()
              }
              expect {
                result is error
                system.healthy == true
              }
            }
          }
        }
      `;

      const result = parse(source);

      expect(result.success).toBe(true);
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario).toBeDefined();
      expect(scenario?.expectations).toHaveLength(2);
      expect(scenario?.expectations[0]?.kind).toBe('ChaosExpectation');
      expect(scenario?.expectations[0]?.condition.kind).toBe('BinaryExpr');
      expect(scenario?.expectations[1]?.condition.kind).toBe('BinaryExpr');
    });

    it('should populate expectations from then blocks for backward compat', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            chaos "old style" {
              inject {
                network_latency(target: API, delay: 500ms)
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.then).toHaveLength(1);
      // expectations should be populated from then block via bridge
      expect(scenario?.expectations).toHaveLength(1);
      expect(scenario?.expectations[0]?.condition).toBeDefined();
      // deprecated expression field should also be populated
      expect(scenario?.expectations[0]?.expression).toBeDefined();
    });

    it('should merge expect and then blocks into expectations', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "mixed" {
              inject {
                database_failure(target: DB)
              }
              when {
                result = TestBehavior()
              }
              expect {
                system.available == true
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      // 1 from expect block + 1 from then block
      expect(scenario?.expectations).toHaveLength(2);
    });
  });

  describe('with { } clauses (scenario-level)', () => {
    it('should parse scenario-level with clause', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "with retries" {
              inject {
                network_latency(target: API, delay: 200ms)
              }
              when {
                result = TestBehavior()
              }
              then {
                result is error
              }
              with {
                retries: 3
                timeout: 30s
              }
            }
          }
        }
      `;

      const result = parse(source);

      expect(result.success).toBe(true);
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.withClause).toBeDefined();
      expect(scenario?.withClause?.kind).toBe('ChaosWithClause');
      expect(scenario?.withClause?.args).toHaveLength(2);
      expect(scenario?.withClause?.args[0]?.kind).toBe('ChaosArgument');
      expect(scenario?.withClause?.args[0]?.name.name).toBe('retries');
      expect(scenario?.withClause?.args[1]?.name.name).toBe('timeout');
      // deprecated withClauses array should also be populated
      expect(scenario?.withClauses).toHaveLength(1);
    });

    it('should produce empty withClauses when no with block', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "no with" {
              inject {
                database_failure(target: Repo)
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.withClause).toBeUndefined();
      expect(scenario?.withClauses).toHaveLength(0);
    });
  });

  describe('inline inject syntax', () => {
    it('should parse inject <type> on <target> with { ... }', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "database failure" {
              inject latency on Database.query with { duration: 5000, jitter: 500 }
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.inject).toHaveLength(1);

      const injection = scenario?.inject[0];
      expect(injection?.kind).toBe('Injection');
      expect(injection?.type).toBe('latency');
      expect(injection?.target.kind).toBe('MemberExpr');
      expect(injection?.parameters).toHaveLength(2);
      expect(injection?.parameters[0]?.name.name).toBe('duration');
      expect(injection?.parameters[1]?.name.name).toBe('jitter');
    });

    it('should parse multiple inline injects', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "multiple failures" {
              inject latency on Database.query with { duration: 5000 }
              inject failure on PaymentGateway.charge with { rate: 0.5 }
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.inject).toHaveLength(2);
      expect(scenario?.inject[0]?.type).toBe('latency');
      expect(scenario?.inject[1]?.type).toBe('failure');
    });

    it('should produce ChaosInjection bridged nodes from inline injects', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "bridged" {
              inject latency on Service.call with { duration: 1000 }
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.injections).toHaveLength(1);
      expect(scenario?.injections?.[0]?.kind).toBe('ChaosInjection');
      expect(scenario?.injections?.[0]?.type.name).toBe('latency');
      expect(scenario?.injections?.[0]?.arguments).toHaveLength(1);
      expect(scenario?.injections?.[0]?.arguments[0]?.kind).toBe('ChaosArgument');
      expect(scenario?.injections?.[0]?.arguments[0]?.name.name).toBe('duration');
    });
  });

  describe('full chaos syntax', () => {
    it('should parse the complete isl-core style chaos block', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "database failure" {
              inject latency on Database.query with { duration: 5000, jitter: 500 }
              inject failure on PaymentGateway.charge with { rate: 0.5 }
              expect {
                system.available == true
                order.status == "pending"
              }
              with {
                retries: 3
                timeout: 30s
              }
            }
          }
        }
      `;

      const result = parse(source);

      expect(result.success).toBe(true);
      const chaos = result.domain?.chaos[0];
      expect(chaos?.scenarios).toHaveLength(1);

      const scenario = chaos?.scenarios[0];
      expect(scenario?.name.value).toBe('database failure');
      expect(scenario?.inject).toHaveLength(2);
      expect(scenario?.expectations).toHaveLength(2);
      expect(scenario?.withClause).toBeDefined();
      expect(scenario?.withClause?.args).toHaveLength(2);
      expect(scenario?.injections).toHaveLength(2);
    });

    it('should support scenario keyword inside chaos blocks', () => {
      const source = `
        domain ChaosTest {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "using scenario keyword" {
              inject {
                database_failure(target: DB)
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
      expect(result.domain?.chaos[0]?.scenarios).toHaveLength(1);
      expect(result.domain?.chaos[0]?.scenarios[0]?.name.value).toBe('using scenario keyword');
    });
  });

  describe('backward compatibility', () => {
    it('should still parse old-style chaos blocks with chaos keyword', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          chaos TestBehavior {
            chaos "network issues" {
              inject {
                network_latency(target: API, delay: 500ms)
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
      expect(result.domain?.chaos[0]?.scenarios[0]?.inject).toHaveLength(1);
      // expectations should be derived from then block
      expect(result.domain?.chaos[0]?.scenarios[0]?.expectations).toHaveLength(1);
    });

    it('should preserve inject field for old block syntax', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          chaos TestBehavior {
            chaos "old inject" {
              inject {
                database_failure(target: Repo)
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
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.inject).toHaveLength(1);
      expect(scenario?.inject[0]?.kind).toBe('Injection');
      expect(scenario?.injections).toHaveLength(1);
      expect(scenario?.injections?.[0]?.kind).toBe('ChaosInjection');
    });

    it('should handle empty expectations gracefully', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          chaos TestBehavior {
            scenario "no assertions" {
              inject {
                database_failure(target: DB)
              }
              when {
                result = TestBehavior()
              }
            }
          }
        }
      `;

      const result = parse(source);

      expect(result.success).toBe(true);
      const scenario = result.domain?.chaos[0]?.scenarios[0];
      expect(scenario?.expectations).toHaveLength(0);
      expect(scenario?.then).toHaveLength(0);
    });
  });
});
