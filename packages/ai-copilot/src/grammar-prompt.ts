/**
 * ISL Grammar Prompt — System context for AI copilot when generating ISL specs.
 * Injected into NL→ISL, code→ISL, and any ISL generation stage.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

let _cachedGrammar: string | null = null;

function loadGrammarContent(): string {
  const candidates: string[] = [];
  if (typeof require !== 'undefined') {
    try {
      const resolved = (require as NodeRequire).resolve('@isl-lang/ai-copilot');
      candidates.push(join(dirname(resolved), 'grammar-reference.md'));
    } catch {
      /* not resolved */
    }
  }
  const cwd = process.cwd();
  candidates.push(
    join(cwd, 'packages', 'ai-copilot', 'dist', 'grammar-reference.md'),
    join(cwd, 'packages', 'ai-copilot', 'src', 'grammar-reference.md'),
    join(cwd, 'grammar-reference.md'),
    join(cwd, 'src', 'grammar-reference.md'),
    join(cwd, 'dist', 'grammar-reference.md'),
  );
  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8');
    }
  }
  throw new Error('grammar-reference.md not found');
}

/**
 * Returns the ISL grammar reference as a formatted system prompt injection.
 * Target: under 2000 tokens for efficient context usage.
 *
 * Use when asking the AI to produce ISL (naturalLanguageToISL, codeToISL, etc.).
 */
export function getISLGrammarPrompt(): string {
  if (_cachedGrammar !== null) {
    return _cachedGrammar;
  }

  try {
    const content = loadGrammarContent();
    _cachedGrammar = `## ISL Grammar Reference (MUST follow exactly)

${content}

---
CRITICAL: Output ONLY valid ISL. Use \`\`\`isl code fence. No invented syntax.`;
    return _cachedGrammar;
  } catch {
    // Fallback: minimal inline grammar if file missing (e.g. bundled)
    _cachedGrammar = `## ISL Grammar Reference

domain <Name> { version: "<semver>" [owner: "<string>"] ... }
entity <Name> { <field>: <Type>|Type? [immutable|unique|indexed|references:X] invariants{...} lifecycle{...} }
behavior <Name> { actors{...} input{...} output{ success:X errors{NAME{when:"",retriable:bool}} } preconditions{...} postconditions{ success implies{...} } }
api { base:"<path>" GET|POST|PUT|PATCH|DELETE "<path>" -> BehaviorName { auth body params response } }
screen <Name> { route layout component{ type:form|list|detail entity behavior fields submit } navigation{...} }
scenarios BehaviorName { scenario "<desc>" { given{...} when{...} then{...} } }
Types: String|Int|Decimal|Boolean|UUID|Timestamp|Duration|List<T>|Map<K,V>|Type?
Constraints: Type { min|max|min_length|max_length|precision }
Field annotations: [immutable],[unique],[indexed],[references:Entity]
AVOID: union A|B, format: in types, /x/{id} (use /x/:id), regex ^$ in invariants`;
    return _cachedGrammar;
  }
}

/**
 * Clear cached grammar (for tests or hot reload).
 */
export function clearISLGrammarCache(): void {
  _cachedGrammar = null;
}
