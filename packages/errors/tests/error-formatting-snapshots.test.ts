// ============================================================================
// Golden Snapshot Tests for Error Formatting
// ============================================================================
//
// These tests ensure error messages are formatted consistently with:
// - Code snippets with caret indicators
// - "Why" explanations
// - "How to fix" suggestions
// - Stable error codes
//
// To update snapshots: npm test -- -u
//
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  formatDiagnostic,
  registerSource,
  clearSourceCache,
  errorDiag,
  createLocation,
  type Diagnostic,
} from '../src/index.js';

describe('Error Formatting - Golden Snapshots', () => {
  beforeEach(() => {
    clearSourceCache();
  });

  afterEach(() => {
    clearSourceCache();
  });

  // Top 20 Common Errors - Parser (E0001-E0199)
  describe('Parser Errors', () => {
    it('E0002: Unterminated string literal', () => {
      const source = `domain Test {
  version: "1.0.0"
  description: "This string never ends
}`;
      registerSource('test.isl', source);

      const diag = errorDiag(
        'E0002',
        'Unterminated string literal',
        createLocation('test.isl', 3, 20, 3, 20),
        'lexer'
      );

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0100: Unexpected token', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    @invalid
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0100',
        category: 'parser',
        severity: 'error',
        message: "Unexpected token '@invalid'",
        location: createLocation('test.isl', 5, 5, 5, 12),
        source: 'parser',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0105: Missing closing brace', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    name: String
`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0105',
        category: 'parser',
        severity: 'error',
        message: "Expected '}' to close block",
        location: createLocation('test.isl', 6, 1, 6, 1),
        source: 'parser',
        relatedInformation: [
          {
            message: 'Block opened here',
            location: createLocation('test.isl', 3, 15, 3, 15),
          },
        ],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0109: Duplicate entity', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
  }
  entity User {
    name: String
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0109',
        category: 'parser',
        severity: 'error',
        message: "Entity 'User' is already defined",
        location: createLocation('test.isl', 6, 3, 6, 7),
        source: 'parser',
        relatedInformation: [
          {
            message: 'Previously defined here',
            location: createLocation('test.isl', 3, 3, 3, 7),
          },
        ],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0102: Expected identifier', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity {
    id: UUID
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0102',
        category: 'parser',
        severity: 'error',
        message: "Expected identifier, got '{'",
        location: createLocation('test.isl', 3, 10, 3, 10),
        source: 'parser',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });
  });

  // Type Errors (E0200-E0299)
  describe('Type Errors', () => {
    it('E0200: Type mismatch', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity Account {
    balance: Decimal
  }
  behavior Transfer {
    postconditions {
      sender.balance == "100.00"
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0200',
        category: 'type',
        severity: 'error',
        message: "Type mismatch: expected 'Decimal', got 'String'",
        location: createLocation('test.isl', 8, 24, 8, 31),
        source: 'typechecker',
        notes: ["The expression has type 'String' but 'Decimal' was expected"],
        help: ['Use a Decimal literal instead: 100.00'],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0201: Undefined type', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: uuid
    age: Intger
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0201',
        category: 'type',
        severity: 'error',
        message: "Type 'uuid' is not defined",
        location: createLocation('test.isl', 4, 7, 4, 10),
        source: 'typechecker',
        help: ["Did you mean 'UUID'?", 'Type names are case-sensitive. Use \'UUID\''],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0202: Undefined field', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity Account {
    balance: Decimal
  }
  behavior Check {
    preconditions {
      account.balace > 0
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0202',
        category: 'type',
        severity: 'error',
        message: "Field 'balace' does not exist on type 'Account'",
        location: createLocation('test.isl', 8, 13, 8, 19),
        source: 'typechecker',
        help: ["Did you mean 'balance'?", 'Available fields: balance'],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0210: Incompatible comparison', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    name: String
    age: Int
  }
  behavior Check {
    postconditions {
      user.name == user.age
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0210',
        category: 'type',
        severity: 'error',
        message: "Cannot compare 'String' with 'Int'",
        location: createLocation('test.isl', 9, 15, 9, 24),
        source: 'typechecker',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });
  });

  // Semantic Errors (E0300-E0399)
  describe('Semantic Errors', () => {
    it('E0300: Undefined variable', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Transfer {
    input {
      amount: Decimal
    }
    preconditions {
      ammount > 0
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0300',
        category: 'semantic',
        severity: 'error',
        message: "Variable 'ammount' is not defined",
        location: createLocation('test.isl', 8, 7, 8, 14),
        source: 'typechecker',
        help: ["Did you mean 'amount'?"],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0301: Undefined entity', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Transfer {
    preconditions {
      Account.exists(senderId)
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0301',
        category: 'semantic',
        severity: 'error',
        message: "Entity 'Account' is not defined",
        location: createLocation('test.isl', 5, 7, 5, 14),
        source: 'typechecker',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0302: Undefined behavior', () => {
      const source = `domain Test {
  version: "1.0.0"
  scenario "test" {
    given {
      Transfer(amount: 100)
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0302',
        category: 'semantic',
        severity: 'error',
        message: "Behavior 'Transfer' is not defined",
        location: createLocation('test.isl', 5, 7, 5, 15),
        source: 'typechecker',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0304: old() outside postcondition', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Transfer {
    preconditions {
      old(sender.balance) >= amount
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0304',
        category: 'semantic',
        severity: 'error',
        message: "'old()' can only be used in postconditions",
        location: createLocation('test.isl', 5, 7, 5, 24),
        source: 'typechecker',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0305: result outside postcondition', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior CalculateTotal {
    preconditions {
      result > 0
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0305',
        category: 'semantic',
        severity: 'error',
        message: "'result' can only be used in postconditions",
        location: createLocation('test.isl', 5, 7, 5, 13),
        source: 'typechecker',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });
  });

  // Evaluation Errors (E0400-E0499)
  describe('Evaluation Errors', () => {
    it('E0400: Division by zero', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Calculate {
    postconditions {
      average == total / count
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0400',
        category: 'eval',
        severity: 'error',
        message: 'Division by zero',
        location: createLocation('test.isl', 5, 25, 5, 30),
        source: 'evaluator',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0401: Null reference', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Check {
    postconditions {
      account.balance > 0
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0401',
        category: 'eval',
        severity: 'error',
        message: "Cannot read property 'balance' of null",
        location: createLocation('test.isl', 5, 7, 5, 20),
        source: 'evaluator',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0403: Undefined property', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity Account {
    balance: Decimal
  }
  behavior Check {
    postconditions {
      account.balace > 0
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0403',
        category: 'eval',
        severity: 'error',
        message: "Property 'balace' is undefined",
        location: createLocation('test.isl', 8, 13, 8, 19),
        source: 'evaluator',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0404: Invalid operation', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Check {
    postconditions {
      "hello".length()
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0404',
        category: 'eval',
        severity: 'error',
        message: 'Invalid operation: strings do not have length() method',
        location: createLocation('test.isl', 5, 7, 5, 22),
        source: 'evaluator',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });

    it('E0408: Type coercion failed', () => {
      const source = `domain Test {
  version: "1.0.0"
  behavior Parse {
    postconditions {
      parseInt("not a number")
    }
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0408',
        category: 'eval',
        severity: 'error',
        message: "Cannot coerce 'String' to 'Int'",
        location: createLocation('test.isl', 5, 7, 5, 30),
        source: 'evaluator',
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });
  });

  // Multi-line errors
  describe('Multi-line Errors', () => {
    it('E0105: Missing closing brace (multi-line)', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    name: String
    email: String
`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0105',
        category: 'parser',
        severity: 'error',
        message: "Expected '}' to close block",
        location: createLocation('test.isl', 3, 15, 7, 1),
        source: 'parser',
        relatedInformation: [
          {
            message: 'Block opened here',
            location: createLocation('test.isl', 3, 15, 3, 15),
          },
        ],
      });

      const formatted = formatDiagnostic(diag, { colors: false, contextLines: 1 });
      expect(formatted).toMatchSnapshot();
    });
  });

  // Errors with related information
  describe('Errors with Related Information', () => {
    it('E0109: Duplicate entity with related location', () => {
      const source = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
  }
  entity User {
    name: String
  }
}`;
      registerSource('test.isl', source);

      const diag = diagnostic({
        code: 'E0109',
        category: 'parser',
        severity: 'error',
        message: "Entity 'User' is already defined",
        location: createLocation('test.isl', 6, 3, 6, 7),
        source: 'parser',
        relatedInformation: [
          {
            message: 'Previously defined here',
            location: createLocation('test.isl', 3, 3, 3, 7),
          },
        ],
      });

      const formatted = formatDiagnostic(diag, { colors: false });
      expect(formatted).toMatchSnapshot();
    });
  });
});
