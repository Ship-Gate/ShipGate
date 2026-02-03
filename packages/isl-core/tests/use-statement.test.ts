/**
 * Use Statement Parser Tests
 *
 * Tests for parsing ISL use statements.
 */

import { describe, it, expect } from 'vitest';
import { lexISL, parseISL } from '../src/index.js';

describe('UseStatement Parsing', () => {
  describe('basic use statements', () => {
    it('should parse simple use statement', () => {
      const source = `
domain Test {
  use stdlib-auth
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);
      expect(result.ast?.uses[0]?.module.kind).toBe('Identifier');
      if (result.ast?.uses[0]?.module.kind === 'Identifier') {
        expect(result.ast.uses[0].module.name).toBe('stdlib-auth');
      }
    });

    it('should parse use statement with alias', () => {
      const source = `
domain Test {
  use stdlib-auth as auth
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);

      const useStmt = result.ast?.uses[0];
      expect(useStmt?.alias).toBeDefined();
      expect(useStmt?.alias?.name).toBe('auth');
    });

    it('should parse use statement with version', () => {
      const source = `
domain Test {
  use stdlib-auth@"1.0.0"
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);

      const useStmt = result.ast?.uses[0];
      expect(useStmt?.version).toBeDefined();
      expect(useStmt?.version?.value).toBe('1.0.0');
    });

    it('should parse use statement with version and alias', () => {
      const source = `
domain Test {
  use stdlib-auth@"1.0.0" as auth
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);

      const useStmt = result.ast?.uses[0];
      expect(useStmt?.version?.value).toBe('1.0.0');
      expect(useStmt?.alias?.name).toBe('auth');
    });

    it('should parse use statement with string path', () => {
      const source = `
domain Test {
  use "./local/module"
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);

      const useStmt = result.ast?.uses[0];
      expect(useStmt?.module.kind).toBe('StringLiteral');
      if (useStmt?.module.kind === 'StringLiteral') {
        expect(useStmt.module.value).toBe('./local/module');
      }
    });
  });

  describe('multiple use statements', () => {
    it('should parse multiple use statements', () => {
      const source = `
domain Test {
  use stdlib-auth
  use stdlib-payments
  use stdlib-uploads
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(3);

      const names = result.ast?.uses.map((u) => {
        if (u.module.kind === 'Identifier') return u.module.name;
        return null;
      });
      expect(names).toContain('stdlib-auth');
      expect(names).toContain('stdlib-payments');
      expect(names).toContain('stdlib-uploads');
    });
  });

  describe('use statements with other declarations', () => {
    it('should parse use statements alongside entities', () => {
      const source = `
domain Test {
  use stdlib-auth

  entity User {
    id: UUID
    email: String
  }
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);
      expect(result.ast?.entities).toHaveLength(1);
      expect(result.ast?.entities[0]?.name.name).toBe('User');
    });

    it('should parse use statements alongside behaviors', () => {
      const source = `
domain Test {
  use stdlib-auth as auth

  behavior Login {
    input {
      email: String
      password: String
    }

    output {
      success: Boolean
    }
  }
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);
      expect(result.ast?.behaviors).toHaveLength(1);
    });

    it('should parse use statements with imports block', () => {
      const source = `
domain Test {
  use stdlib-auth

  imports {
    { User } from "shared/types"
  }

  entity Session {
    user: User
  }
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast).toBeDefined();
      expect(result.ast?.uses).toHaveLength(1);
      expect(result.ast?.imports).toHaveLength(1);
    });
  });

  describe('module name variations', () => {
    it('should parse hyphenated module names', () => {
      const source = `
domain Test {
  use my-custom-module
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast?.uses).toHaveLength(1);
      if (result.ast?.uses[0]?.module.kind === 'Identifier') {
        expect(result.ast.uses[0].module.name).toBe('my-custom-module');
      }
    });

    it('should parse module names with numbers', () => {
      const source = `
domain Test {
  use stdlib-v2
}
`;
      const result = parseISL(source);

      expect(result.errors).toHaveLength(0);
      expect(result.ast?.uses).toHaveLength(1);
      if (result.ast?.uses[0]?.module.kind === 'Identifier') {
        expect(result.ast.uses[0].module.name).toBe('stdlib-v2');
      }
    });
  });

  describe('lexer token generation', () => {
    it('should generate USE token', () => {
      const source = 'use stdlib-auth';
      const result = lexISL(source);

      expect(result.errors).toHaveLength(0);
      const useToken = result.tokens.find((t) => t.type === 'USE');
      expect(useToken).toBeDefined();
      expect(useToken?.value).toBe('use');
    });

    it('should generate AS token', () => {
      const source = 'use stdlib-auth as auth';
      const result = lexISL(source);

      expect(result.errors).toHaveLength(0);
      const asToken = result.tokens.find((t) => t.type === 'AS');
      expect(asToken).toBeDefined();
      expect(asToken?.value).toBe('as');
    });
  });
});
