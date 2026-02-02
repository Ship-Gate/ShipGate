// ============================================================================
// Trailing Comma Support Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';

describe('Trailing Comma Support', () => {
  describe('Annotations', () => {
    it('should parse annotations without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID [immutable, unique]
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse annotations with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID [immutable, unique,]
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse single annotation with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID [unique,]
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Function Call Arguments', () => {
    it('should parse function call without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { id: UUID }
            output { success: Boolean }
            pre {
              User.lookup(id, active)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse function call with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { id: UUID }
            output { success: Boolean }
            pre {
              User.lookup(id, active,)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse single-argument call with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { id: UUID }
            output { success: Boolean }
            pre {
              User.exists(id,)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Lambda Parameters (Quantifiers)', () => {
    it('should parse quantifier with lambda without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            items: List<String>
            
            invariants {
              all(items, item => item.length > 0)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse multi-param lambda without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            
            invariants {
              process((a, b) => a + b)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse multi-param lambda with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            
            invariants {
              process((a, b,) => a + b)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse single-param lambda tuple with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            
            invariants {
              process((a,) => a * 2)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Array Literals', () => {
    it('should parse array literal without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              items == [1, 2, 3]
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse array literal with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              items == [1, 2, 3,]
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse single-element array with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              items == [1,]
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Map/Object Literals', () => {
    it('should parse map literal without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              data == {"a": 1, "b": 2}
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse map literal with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              data == {"a": 1, "b": 2,}
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse single-entry map with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              data == {"a": 1,}
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Union Variant Fields', () => {
    it('should parse union type field without trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            result: | Success { value: String, code: Int } | Failure { error: String }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });

    it('should parse union variant fields with trailing comma', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            result: | Success { value: String, code: Int, } | Failure { error: String, }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Cases - Double Commas Should Fail', () => {
    it('should reject double commas in function arguments', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          behavior Check {
            input { id: UUID }
            output { success: Boolean }
            pre {
              User.lookup(a,, b)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(false);
    });

    it('should reject double commas in array', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              items == [1,, 2]
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(false);
    });

    it('should reject double commas in map', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            
            invariants {
              data == {"a": 1,, "b": 2}
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(false);
    });

    it('should reject double commas in lambda parameters', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity Item {
            id: UUID
            
            invariants {
              process((a,, b) => a + b)
            }
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(false);
    });

    it('should reject double commas in annotations', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID [immutable,, unique]
          }
        }
      `;
      const result = parse(source);
      expect(result.success).toBe(false);
    });
  });
});
