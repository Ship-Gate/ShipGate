# ISL Linter V2

Advanced ISL linting with auto-fix suggestions and severity classification.

## Overview

ISL Linter V2 provides comprehensive static analysis for ISL (Intent Specification Language) specifications. It detects potential issues, classifies them by severity, and offers AST-based auto-fix suggestions.

## Features

- **Severity Classification**: Errors, warnings, info, and hints
- **Auto-Fix Suggestions**: AST patches that can be applied programmatically
- **Comprehensive Rules**: 8 built-in rules covering security, completeness, and best practices
- **Flexible Configuration**: Enable/disable rules, override severities, filter by tags
- **Tool Integration**: SARIF output for VS Code, JSON for tooling

## Installation

```typescript
import { lint, applyFix } from '@isl-lang/core/isl-lint-v2';
```

## Quick Start

```typescript
import { parse } from '@isl-lang/parser';
import { lint, applyFix, formatLintResult } from '@isl-lang/core/isl-lint-v2';

// Parse ISL source
const { domain } = parse(source);

// Lint the domain
const result = lint(domain, { includeFixes: true });

// Print formatted results
console.log(formatLintResult(result, { color: true }));

// Apply a fix if available
if (result.diagnostics[0]?.fixes?.[0]) {
  const fixResult = applyFix(domain, result.diagnostics[0].fixes[0]);
  if (fixResult.success) {
    console.log('Fix applied successfully!');
    // Use fixResult.ast
  }
}
```

## Rules

### ISL2-001: Minimum Constraints (ERROR)

Security-sensitive behaviors (auth, payment, upload) must have minimum constraints.

**Requirements by category:**

| Category | Required Blocks | Additional |
|----------|-----------------|------------|
| Auth | preconditions, postconditions, security | rate_limit |
| Payment | actors, preconditions, postconditions, security | fraud_check |
| Upload | actors, preconditions, postconditions | - |
| Data | actors, postconditions | - |

### ISL2-002: Missing Postconditions (ERROR)

Critical behaviors (create, update, delete, transfer, etc.) must have postconditions.

### ISL2-003: Ambiguous Actor (WARNING)

Behaviors should specify who can perform them and under what conditions.

### ISL2-004: Impossible Constraints (ERROR)

Detects constraints that can never be satisfied (e.g., `x != x`).

### ISL2-005: Missing Error Specifications (WARNING)

Non-query behaviors should specify possible error conditions.

### ISL2-006: Unconstrained Numeric Input (WARNING)

Numeric inputs like `amount`, `price`, `quantity` should have validation.

### ISL2-007: Duplicate Preconditions (INFO)

Detects redundant or duplicate preconditions.

### ISL2-008: Missing Temporal Constraints (HINT)

Async behaviors should have temporal constraints (timeouts, deadlines).

## Configuration

### Lint Options

```typescript
interface LintOptions {
  // Rule configurations
  rules?: Record<string, LintRuleConfig | boolean>;
  
  // Filter by category
  includeCategories?: LintCategory[];
  excludeCategories?: LintCategory[];
  
  // Minimum severity to report
  minSeverity?: LintSeverity;
  
  // Stop on first error
  failFast?: boolean;
  
  // Include auto-fix suggestions
  includeFixes?: boolean;
  
  // Filter by tags
  includeTags?: string[];
  excludeTags?: string[];
}
```

### Examples

```typescript
// Errors only
lint(domain, { minSeverity: 'error' });

// Security rules only
lint(domain, { includeTags: ['security'] });

// Disable specific rule
lint(domain, {
  rules: { 'ISL2-008': false }
});

// Override severity
lint(domain, {
  rules: {
    'ISL2-003': { enabled: true, severity: 'error' }
  }
});

// Safety category only
lint(domain, { includeCategories: ['safety'] });
```

## Auto-Fix System

### Applying Fixes

```typescript
import { applyFix, applyFixes, getBestFix } from '@isl-lang/core/isl-lint-v2';

// Apply a single fix
const result = applyFix(ast, fix);
if (result.success) {
  const newAst = result.ast;
}

// Apply multiple fixes
const multiResult = applyFixes(ast, [fix1, fix2, fix3]);

// Get the best fix (highest priority)
const bestFix = getBestFix(diagnostic.fixes);
```

### Fix Structure

```typescript
interface LintFix {
  id: string;                    // Unique identifier
  title: string;                 // Human-readable title
  description: string;           // Detailed description
  patches: ASTPatch[];           // AST modifications
  isAutomaticallySafe: boolean;  // Safe for auto-apply
  priority: number;              // Higher = more preferred
  category: string;              // Fix category
}
```

### AST Patches

Fixes use AST patches instead of raw text:

```typescript
// Insert patch
patchFactory.insert(
  'behaviors[0].postconditions',
  postconditionNode,
  'last',
  'Add postcondition'
);

// Replace patch
patchFactory.replace(
  'behaviors[0].name',
  newIdentifier,
  'Rename behavior'
);

// Remove patch
patchFactory.remove(
  'behaviors[0].preconditions',
  'Remove precondition',
  0  // index
);

// Modify patch
patchFactory.modify(
  'behaviors[0]',
  { description: 'Updated' },
  'Update description'
);
```

## Integration

### Validator Integration

```typescript
import { parse } from '@isl-lang/parser';
import { lint } from '@isl-lang/core/isl-lint-v2';

function validateISL(source: string): ValidationResult {
  // Parse
  const parseResult = parse(source);
  if (!parseResult.success) {
    return { success: false, errors: parseResult.errors };
  }
  
  // Lint
  const lintResult = lint(parseResult.domain, {
    minSeverity: 'error',
    includeFixes: true,
  });
  
  return {
    success: lintResult.success,
    diagnostics: lintResult.diagnostics,
    fixableCount: lintResult.fixableCount,
  };
}
```

### VS Code Extension Integration

```typescript
import { lint, lintResultToSARIF } from '@isl-lang/core/isl-lint-v2';
import { DiagnosticCollection, Uri, Range, Diagnostic } from 'vscode';

function updateDiagnostics(
  document: TextDocument,
  domain: Domain,
  collection: DiagnosticCollection
) {
  const result = lint(domain, { includeFixes: true });
  
  const diagnostics = result.diagnostics.map(d => {
    const range = new Range(
      d.location.line - 1,
      d.location.column - 1,
      d.location.endLine - 1,
      d.location.endColumn - 1
    );
    
    const diag = new Diagnostic(
      range,
      d.message,
      severityToVSCode(d.severity)
    );
    diag.code = d.ruleId;
    diag.source = 'isl-lint-v2';
    
    return diag;
  });
  
  collection.set(document.uri, diagnostics);
}

// For SARIF integration (Problems panel)
const sarif = lintResultToSARIF(result);
```

### Code Action Provider (Quick Fixes)

```typescript
import { CodeActionProvider, CodeActionKind } from 'vscode';
import { applyFix } from '@isl-lang/core/isl-lint-v2';

class ISLCodeActionProvider implements CodeActionProvider {
  provideCodeActions(document, range, context) {
    const actions = [];
    
    for (const diagnostic of context.diagnostics) {
      // Get cached lint result for this document
      const lintDiag = this.getLintDiagnostic(document, diagnostic);
      
      if (lintDiag?.fixes) {
        for (const fix of lintDiag.fixes) {
          const action = new CodeAction(
            fix.title,
            CodeActionKind.QuickFix
          );
          action.diagnostics = [diagnostic];
          action.isPreferred = fix.isAutomaticallySafe;
          action.command = {
            command: 'isl.applyFix',
            title: fix.title,
            arguments: [document.uri, fix],
          };
          actions.push(action);
        }
      }
    }
    
    return actions;
  }
}
```

### CLI Integration

```typescript
import { lint, formatLintResult } from '@isl-lang/core/isl-lint-v2';

async function lintCommand(files: string[], options: CLIOptions) {
  let hasErrors = false;
  
  for (const file of files) {
    const source = await readFile(file, 'utf-8');
    const { domain } = parse(source);
    
    const result = lint(domain, {
      minSeverity: options.minSeverity,
      includeFixes: options.fix,
    });
    
    console.log(formatLintResult(result, {
      color: options.color,
      verbose: options.verbose,
    }));
    
    if (!result.success) {
      hasErrors = true;
    }
    
    // Auto-fix if requested
    if (options.fix && result.fixableCount > 0) {
      const autoFixes = getAutoFixableDiagnostics(result)
        .flatMap(d => d.fixes?.filter(f => f.isAutomaticallySafe) ?? []);
      
      if (autoFixes.length > 0) {
        const fixResult = applyFixes(domain, autoFixes);
        if (fixResult.success) {
          // Regenerate source from AST and write back
          await writeFixedSource(file, fixResult.ast);
        }
      }
    }
  }
  
  process.exit(hasErrors ? 1 : 0);
}
```

## API Reference

### Core Functions

| Function | Description |
|----------|-------------|
| `lint(domain, options?)` | Lint a domain AST |
| `applyFix(ast, fix)` | Apply a single fix |
| `applyFixes(ast, fixes)` | Apply multiple fixes |
| `formatLintResult(result, options?)` | Format result as string |
| `lintResultToJSON(result)` | Convert to JSON |
| `lintResultToSARIF(result)` | Convert to SARIF format |

### Query Functions

| Function | Description |
|----------|-------------|
| `getRules()` | Get all lint rules |
| `getRule(idOrName)` | Get rule by ID or name |
| `getDiagnosticsBySeverity(result, severity)` | Filter by severity |
| `getDiagnosticsByCategory(result, category)` | Filter by category |
| `getFixableDiagnostics(result)` | Get diagnostics with fixes |
| `getAutoFixableDiagnostics(result)` | Get auto-fixable diagnostics |

### Fix Utilities

| Function | Description |
|----------|-------------|
| `getBestFix(fixes)` | Get highest priority fix |
| `sortFixesByPriority(fixes)` | Sort fixes by priority |
| `filterFixesByCategory(fixes, category)` | Filter by category |
| `getAutoFixableFixes(fixes)` | Get safe-to-auto-apply fixes |
| `validateFix(fix)` | Validate fix structure |
| `previewPatch(ast, patch)` | Preview a patch |

## Extending with Custom Rules

```typescript
import type { LintRule, LintContext, LintDiagnostic } from '@isl-lang/core/isl-lint-v2';

const myCustomRule: LintRule = {
  id: 'CUSTOM-001',
  name: 'my-custom-rule',
  description: 'Custom rule description',
  severity: 'warning',
  category: 'best-practice',
  tags: ['custom'],
  
  check(context: LintContext): LintDiagnostic[] {
    const { domain, report, createPatch, createFix } = context;
    const diagnostics: LintDiagnostic[] = [];
    
    for (const behavior of domain.behaviors) {
      // Custom check logic
      if (someCondition(behavior)) {
        diagnostics.push(report({
          node: behavior,
          message: 'Custom message',
          fixes: [
            createFix({
              id: 'fix-id',
              title: 'Fix title',
              description: 'Fix description',
              patches: [
                createPatch.insert(
                  'behaviors[0].preconditions',
                  someNode,
                  'last',
                  'Add constraint'
                ),
              ],
            }),
          ],
        }));
      }
    }
    
    return diagnostics;
  },
};
```

## License

MIT
