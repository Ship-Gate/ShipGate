/**
 * Fuzzy Parser Tests
 *
 * Tests ISL snippets that the strict parser rejects but the fuzzy parser handles.
 * These patterns are common in AI-generated ISL.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';
import { parseFuzzy } from '../src/fuzzy-parser.js';

const filename = 'test.isl';

describe('FuzzyParser', () => {
  // 1. Missing version - strict rejects (P013), fuzzy adds default
  it('handles domain without version field', () => {
    const isl = `domain Auth {
  entity User {
    id: UUID
    email: String
  }
}`;
    const strict = parse(isl, filename);
    const fuzzy = parseFuzzy(isl, filename);

    expect(strict.success).toBe(false);
    expect(strict.errors.some((e) => e.code === 'P013' || e.message.includes('version'))).toBe(true);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast).not.toBeNull();
    expect(fuzzy.ast?.version.value).toBe('1.0.0');
    expect(fuzzy.warnings.some((w) => w.code === 'F001')).toBe(true);
  });

  // 2. Union type shorthand: string | number (strict rejects lowercase primitives)
  it('normalizes string | number union shorthand', () => {
    const isl = `domain Types {
  version: "1.0.0"
  type Id = string | number
}`;
    const strict = parse(isl, filename);
    const fuzzy = parseFuzzy(isl, filename);

    expect(strict.success).toBe(false);
    expect(fuzzy.ast).not.toBeNull();
    expect(fuzzy.ast?.types.length).toBeGreaterThan(0);
    expect(fuzzy.errors.length).toBe(0);
  });

  // 3. Inline [format: email] annotation (strict may reject)
  it('normalizes inline [format: email] annotation to constraint block', () => {
    const isl = `domain Auth {
  version: "1.0.0"
  entity User {
    id: UUID
    email: String [format: email]
  }
}`;
    const fuzzy = parseFuzzy(isl, filename);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.entities.length).toBe(1);
    expect(fuzzy.ast?.entities[0]?.fields.length).toBe(2);
  });

  // 4. Trailing commas before } (strict rejects)
  it('removes trailing commas', () => {
    const isl = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID,
    name: String,
  }
}`;
    const strict = parse(isl, filename);
    const fuzzy = parseFuzzy(isl, filename);

    expect(strict.success).toBe(false);
    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.entities[0]?.fields.length).toBe(2);
  });

  // 5. Tabs instead of spaces
  it('normalizes tabs to spaces', () => {
    const isl = `domain Test {
\tversion: "1.0.0"
\tentity User {
\t\tid: UUID
\t}
}`;
    const fuzzy = parseFuzzy(isl, filename);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.entities.length).toBe(1);
    expect(fuzzy.warnings.some((w) => w.code === 'F004')).toBe(true);
  });

  // 6. Lowercase boolean in type (strict may accept Boolean as identifier in some contexts)
  it('normalizes boolean type shorthand', () => {
    const isl = `domain Test {
  version: "1.0.0"
  type Flag = boolean
}`;
    const fuzzy = parseFuzzy(isl, filename);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.types.length).toBe(1);
  });

  // 7. Combined: missing version + trailing comma + format annotation
  it('handles multiple AI-generated patterns together', () => {
    const isl = `domain Auth {
  entity User {
    email: String [format: email],
    active: boolean,
  }
}`;
    const fuzzy = parseFuzzy(isl, filename);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.entities[0]?.fields.length).toBe(2);
    expect(fuzzy.warnings.length).toBeGreaterThan(0);
  });

  // 8. Error recovery: one valid entity, one invalid block
  it('recovers from invalid block and continues parsing', () => {
    const isl = `domain Test {
  version: "1.0.0"
  entity Valid {
    id: UUID
  }
  entity Invalid { broken syntax here
  }
  entity AlsoValid {
    name: String
  }
}`;
    const strict = parse(isl, filename);
    const fuzzy = parseFuzzy(isl, filename);

    expect(strict.success).toBe(false);

    expect(fuzzy.ast).not.toBeNull();
    expect(fuzzy.ast?.entities.length).toBeGreaterThanOrEqual(2);
    expect(fuzzy.partialNodes.length).toBeGreaterThan(0);
    expect(fuzzy.coverage).toBeGreaterThan(0);
  });

  // 9. Extra comma in field list
  it('handles extra comma in field list', () => {
    const isl = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID,
    name: String,
  }
}`;
    const fuzzy = parseFuzzy(isl, filename);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.entities[0]?.fields.length).toBe(2);
  });

  // 10. number type in entity field
  it('normalizes number type in entity field', () => {
    const isl = `domain Test {
  version: "1.0.0"
  entity Counter {
    value: number
  }
}`;
    const fuzzy = parseFuzzy(isl, filename);

    expect(fuzzy.success).toBe(true);
    expect(fuzzy.ast?.entities[0]?.fields.length).toBe(1);
  });
});
