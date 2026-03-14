/**
 * Adversarial Evasion Catalog
 *
 * Central registry of all known scanner evasion techniques.
 * Used by the test harness to track detection coverage and
 * measure scanner improvement over time.
 */

export type EvasionCategory =
  | "sql-injection"
  | "secret-exposure"
  | "xss"
  | "auth-bypass"
  | "mock-detection";

export type EvasionDifficulty = "low" | "medium" | "high";

export interface EvasionTechnique {
  id: string;
  category: EvasionCategory;
  technique: string;
  difficulty: EvasionDifficulty;
  fixture: string;
  expectedCaught: boolean;
  notes: string;
}

export const evasionCatalog: EvasionTechnique[] = [
  // --- SQL Injection Evasion ---
  {
    id: "sqli-indirect-concat",
    category: "sql-injection",
    technique: "Indirect string concatenation via helper function",
    difficulty: "medium",
    fixture: "fixtures/sql-injection-evasion/indirect-concat.ts",
    expectedCaught: true,
    notes:
      "Now caught by cross-module taint tracker (Layer 2). Interprocedural " +
      "analysis follows tainted data through function call boundaries via " +
      "ModuleSummary and TypeScript type checker symbol resolution.",
  },
  {
    id: "sqli-template-nesting",
    category: "sql-injection",
    technique: "Nested template literal interpolation",
    difficulty: "medium",
    fixture: "fixtures/sql-injection-evasion/template-nesting.ts",
    expectedCaught: true,
    notes:
      "Now caught by cross-module taint tracker. Taint propagates through " +
      "variable assignments and template literal interpolations across " +
      "multiple hops in the same analysis pass.",
  },
  {
    id: "sqli-computed-property",
    category: "sql-injection",
    technique: "Computed property access on query builder object",
    difficulty: "high",
    fixture: "fixtures/sql-injection-evasion/computed-property.ts",
    expectedCaught: false,
    notes:
      "SQL-building function accessed via bracket notation (obj[key]). " +
      "Requires resolving dynamic property access to track data flow.",
  },
  {
    id: "sqli-array-join",
    category: "sql-injection",
    technique: "Array.join() string assembly",
    difficulty: "medium",
    fixture: "fixtures/sql-injection-evasion/string-array-join.ts",
    expectedCaught: false,
    notes:
      "Query built by pushing segments to an array and joining. No direct " +
      "string concatenation operator present for scanners to match.",
  },
  {
    id: "sqli-dynamic-eval",
    category: "sql-injection",
    technique: "eval() with concatenated SQL string",
    difficulty: "low",
    fixture: "fixtures/sql-injection-evasion/dynamic-eval.ts",
    expectedCaught: true,
    notes:
      "eval() usage should be flagged independently as dangerous. " +
      "Combined with string concat this is a critical finding.",
  },

  // --- Secret Exposure Evasion ---
  {
    id: "secret-base64",
    category: "secret-exposure",
    technique: "Base64-encoded secret literals",
    difficulty: "high",
    fixture: "fixtures/secret-evasion/base64-encoded.ts",
    expectedCaught: true,
    notes:
      "Now caught by deep security analyzer constant-folder. Handles " +
      "Buffer.from(base64String, 'base64').toString() pattern, decodes " +
      "the base64 content and checks the result against secret patterns.",
  },
  {
    id: "secret-split-concat",
    category: "secret-exposure",
    technique: "Secret split across multiple string variables",
    difficulty: "medium",
    fixture: "fixtures/secret-evasion/split-concat.ts",
    expectedCaught: true,
    notes:
      "Now caught by deep security analyzer constant-folder. Folds string " +
      "concatenation expressions using TypeScript's getConstantValue() and " +
      "checks the folded result against secret patterns.",
  },
  {
    id: "secret-char-codes",
    category: "secret-exposure",
    technique: "String.fromCharCode() secret construction",
    difficulty: "high",
    fixture: "fixtures/secret-evasion/char-codes.ts",
    expectedCaught: true,
    notes:
      "Now caught by deep security analyzer constant-folder. Evaluates " +
      "String.fromCharCode() calls with numeric literal arguments and " +
      "checks the resulting string against secret patterns.",
  },
  {
    id: "secret-env-fallback",
    category: "secret-exposure",
    technique: "Hardcoded fallback for env var reads",
    difficulty: "low",
    fixture: "fixtures/secret-evasion/env-fallback.ts",
    expectedCaught: true,
    notes:
      "process.env.KEY || 'hardcoded_secret'. The fallback string is a plain " +
      "literal that should be caught by pattern matching on the || RHS.",
  },
  {
    id: "secret-reversed",
    category: "secret-exposure",
    technique: "Reversed string secret obfuscation",
    difficulty: "high",
    fixture: "fixtures/secret-evasion/reversed.ts",
    expectedCaught: true,
    notes:
      "Now caught by deep security analyzer constant-folder. Handles " +
      ".split('').reverse().join('') chain by evaluating each method " +
      "call and checking the final string against secret patterns.",
  },

  // --- XSS Evasion ---
  {
    id: "xss-dynamic-property",
    category: "xss",
    technique: "innerHTML via computed bracket notation",
    difficulty: "medium",
    fixture: "fixtures/xss-evasion/dynamic-property.ts",
    expectedCaught: true,
    notes:
      "Now caught by deep security analyzer type-resolver. Uses " +
      "checker.getTypeAtLocation() on ElementAccessExpression keys " +
      "to resolve literal string types like '\"innerHTML\"'.",
  },
  {
    id: "xss-create-element",
    category: "xss",
    technique: "innerHTML on dynamically created DOM element",
    difficulty: "low",
    fixture: "fixtures/xss-evasion/create-element.ts",
    expectedCaught: true,
    notes:
      "createElement() + innerHTML + appendChild(). The innerHTML assignment " +
      "is direct and should be caught, but the createElement indirection adds noise.",
  },
  {
    id: "xss-template-render",
    category: "xss",
    technique: "Unescaped template engine output ({{{html}}})",
    difficulty: "high",
    fixture: "fixtures/xss-evasion/template-render.ts",
    expectedCaught: false,
    notes:
      "XSS via Handlebars {{{ }}} or EJS <%- %> unescaped output. " +
      "No DOM API usage at all; vulnerability is in the template syntax.",
  },
  {
    id: "xss-iframe-srcdoc",
    category: "xss",
    technique: "iframe.srcdoc as innerHTML equivalent",
    difficulty: "medium",
    fixture: "fixtures/xss-evasion/iframe-srcdoc.ts",
    expectedCaught: true,
    notes:
      "Now caught by deep security analyzer sink-resolver. The srcdoc " +
      "property is included in the XSS sink list alongside innerHTML " +
      "and outerHTML for type-checker-based resolution.",
  },

  // --- Auth Bypass Evasion ---
  {
    id: "auth-conditional-env",
    category: "auth-bypass",
    technique: "Auth skipped based on NODE_ENV check",
    difficulty: "medium",
    fixture: "fixtures/auth-bypass/conditional-auth.ts",
    expectedCaught: false,
    notes:
      'Auth wrapped in if (NODE_ENV !== "test") guard. Scanner sees requireAuth() ' +
      "call exists but doesn't analyze control flow to see it's conditional.",
  },
  {
    id: "auth-role-confusion",
    category: "auth-bypass",
    technique: "Role from unvalidated JWT payload claims",
    difficulty: "high",
    fixture: "fixtures/auth-bypass/role-confusion.ts",
    expectedCaught: false,
    notes:
      "JWT decoded but not signature-verified. Role check looks correct but " +
      "the trust boundary is wrong - claims are attacker-controlled.",
  },
  {
    id: "auth-path-traversal",
    category: "auth-bypass",
    technique: "Path traversal bypasses route-level auth middleware",
    difficulty: "high",
    fixture: "fixtures/auth-bypass/path-traversal-auth.ts",
    expectedCaught: false,
    notes:
      "Auth middleware bound to /api/users but /api/public/../users resolves " +
      "to the same handler after path normalization, bypassing the middleware match.",
  },

  // --- Mock Detection Evasion ---
  {
    id: "mock-dynamic-success",
    category: "mock-detection",
    technique: "Success response built via dynamic property assignment",
    difficulty: "medium",
    fixture: "fixtures/mock-evasion/dynamic-success.ts",
    expectedCaught: true,
    notes:
      "Now caught by enhanced mock detector. Bracket notation patterns " +
      'obj["success"] = true are detected, plus object flow tracking ' +
      "follows the variable to res.json() or return statements.",
  },
  {
    id: "mock-promise-resolve",
    category: "mock-detection",
    technique: "Fake results wrapped in Promise.resolve()",
    difficulty: "medium",
    fixture: "fixtures/mock-evasion/promise-resolve.ts",
    expectedCaught: true,
    notes:
      "Now caught by enhanced mock detector. Expanded success indicators " +
      "(delivered, shipped, completed, approved, valid, etc.) are checked " +
      "inside Promise.resolve() object arguments.",
  },
];

export function getCatalogByCategory(
  category: EvasionCategory,
): EvasionTechnique[] {
  return evasionCatalog.filter((t) => t.category === category);
}

export function getExpectedCaught(): EvasionTechnique[] {
  return evasionCatalog.filter((t) => t.expectedCaught);
}

export function getExpectedMissed(): EvasionTechnique[] {
  return evasionCatalog.filter((t) => !t.expectedCaught);
}

export function getCatalogStats() {
  const byCategory = new Map<EvasionCategory, number>();
  const byDifficulty = new Map<EvasionDifficulty, number>();
  let caught = 0;
  let missed = 0;

  for (const technique of evasionCatalog) {
    byCategory.set(
      technique.category,
      (byCategory.get(technique.category) ?? 0) + 1,
    );
    byDifficulty.set(
      technique.difficulty,
      (byDifficulty.get(technique.difficulty) ?? 0) + 1,
    );
    if (technique.expectedCaught) caught++;
    else missed++;
  }

  return {
    total: evasionCatalog.length,
    caught,
    missed,
    detectionRate: caught / evasionCatalog.length,
    byCategory: Object.fromEntries(byCategory),
    byDifficulty: Object.fromEntries(byDifficulty),
  };
}
