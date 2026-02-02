# ISL Studio - API Reference

## Programmatic Usage

Install:

```bash
npm install islstudio
```

### Basic Gate Run

```typescript
import { runGate, loadConfig } from 'islstudio';

const config = await loadConfig(process.cwd());
const files = ['src/auth.ts', 'src/users.ts'];

const result = await runGate(files, config);

console.log(result.verdict); // 'SHIP' or 'NO_SHIP'
console.log(result.score);   // 0-100
console.log(result.violations); // Array of violations
```

### GateResult Type

```typescript
interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: Violation[];
  evidence: {
    fingerprint: string;
    timestamp: string;
  };
}

interface Violation {
  ruleId: string;
  message: string;
  filePath?: string;
  line?: number;
  tier: 'hard_block' | 'soft_block' | 'warn';
  suggestion?: string;
}
```

### Configuration

```typescript
import { loadConfig, getPreset } from 'islstudio';

// Load from .islstudio/config.json
const config = await loadConfig('/path/to/repo');

// Or use a preset
const config = getPreset('strict-security');

// Or build manually
const config = {
  packs: {
    auth: { enabled: true },
    pii: { enabled: true },
    payments: { enabled: false },
  },
  threshold: 80,
};
```

### Formatters

```typescript
import { 
  formatTerminalOutput,
  formatJsonOutput,
  formatSarifOutput,
  formatWithExplanations,
} from 'islstudio';

const result = await runGate(files, config);

// Terminal output (colored)
console.log(formatTerminalOutput(result));

// JSON output
console.log(formatJsonOutput(result));

// SARIF for GitHub Security
const sarif = formatSarifOutput(result, process.cwd());
fs.writeFileSync('results.sarif', sarif);

// With fix explanations
console.log(formatWithExplanations(result));
```

### HTML Report

```typescript
import { generateHtmlReport } from 'islstudio';

const html = generateHtmlReport(result, 'my-project');
fs.writeFileSync('report.html', html);
```

### Baseline Management

```typescript
import { 
  loadBaseline, 
  saveBaseline, 
  filterNewViolations 
} from 'islstudio';

// Create baseline from current violations
await saveBaseline('.islstudio/baseline.json', result.violations);

// Load baseline
const baseline = await loadBaseline('.islstudio/baseline.json');

// Filter to only new violations
const { newViolations, baselineViolations } = filterNewViolations(
  result.violations,
  baseline
);
```

### Suppressions

```typescript
import { parseSuppressions, isSuppressed } from 'islstudio';

const content = fs.readFileSync('src/auth.ts', 'utf-8');
const suppressions = parseSuppressions(content, 'src/auth.ts');

// Check if a violation is suppressed
const suppression = isSuppressed('pii/console-in-production', 42, suppressions);
if (suppression) {
  console.log(`Suppressed: ${suppression.justification}`);
}
```

### Rules Exploration

```typescript
import { 
  createRegistry, 
  loadBuiltinPacks,
  explainRule 
} from '@isl-lang/policy-packs';

const registry = createRegistry();
await loadBuiltinPacks(registry);

// Get all enabled rules
const rules = registry.getEnabledRules();
console.log(`${rules.length} rules loaded`);

// Explain a specific rule
const explanation = explainRule('auth/bypass-detected');
console.log(explanation.why);
console.log(explanation.fixes);
```

### Scoring

```typescript
import { calculateScore, getVerdict, explainScore } from 'islstudio';

const violations = {
  hardBlocks: 2,
  softBlocks: 1,
  infos: 3,
};

const score = calculateScore(violations);
// score = 100 - (2*20) - (1*10) - (3*2) = 44

const verdict = getVerdict(score, violations.hardBlocks > 0);
// verdict = 'NO_SHIP' (has hard blocks)

console.log(explainScore(violations));
// Score Breakdown:
//   Base score: 100
//   Hard blocks (2): -40
//   Soft blocks (1): -10
//   Info (3): -6
//   ─────────────
//   Final score: 44/100
```

## Policy Pack Development

### Creating a Custom Rule

```typescript
import type { PolicyRule, RuleContext, RuleViolation } from '@isl-lang/policy-packs';

const myRule: PolicyRule = {
  id: 'custom/my-rule',
  name: 'My Custom Rule',
  description: 'Checks for something specific',
  severity: 'warning',
  category: 'custom',
  tags: ['custom'],

  evaluate(context: RuleContext): RuleViolation | null {
    const content = context.content;
    
    if (content.includes('dangerous_pattern')) {
      return {
        ruleId: 'custom/my-rule',
        ruleName: 'My Custom Rule',
        severity: 'warning',
        message: 'Found dangerous pattern',
        tier: 'soft_block',
        location: {
          file: context.filePath,
          line: 1,
        },
        suggestion: 'Remove the dangerous pattern',
      };
    }

    return null;
  },
};
```

### Registering a Custom Pack

```typescript
import { createRegistry, loadBuiltinPacks } from '@isl-lang/policy-packs';

const myPack = {
  id: 'my-pack',
  name: 'My Pack',
  version: '1.0.0',
  description: 'Custom rules for my org',
  rules: [myRule],
};

const registry = createRegistry();
await loadBuiltinPacks(registry);
registry.registerPack(myPack);
```

## CLI Exit Codes

| Code | Meaning |
|------|---------|
| 0 | SHIP (passed) |
| 1 | NO_SHIP (failed) or error |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ISLSTUDIO_CONFIG` | Path to config file |
| `ISLSTUDIO_THRESHOLD` | Override threshold |
| `CI` | Enables CI mode automatically |

## Types Export

```typescript
import type {
  GateResult,
  GateConfig,
  Violation,
} from 'islstudio';
```
