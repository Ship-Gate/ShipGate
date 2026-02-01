# ISL Language Support

This module provides ISL (Intent Specification Language) diagnostics and quick fixes for the VS Code extension.

## Features

### Diagnostics

The diagnostics provider parses ISL files and reports:

- **Parse Errors**: Syntax errors from the ISL parser
- **Semantic Warnings**: Missing postconditions, version headers, descriptions
- **Style Hints**: Empty blocks, missing error descriptions

### Quick Fixes

Available quick fixes:

| Code | Fix | Description |
|------|-----|-------------|
| `ISL-S001` | Add missing postconditions block | Adds a postconditions template to behaviors |
| `ISL-S002` | Add version header | Adds `version: "1.0.0"` to domain |
| `ISL-S003` | Add description | Adds description placeholder to behavior |
| `ISL-W003` | Add 'when' description | Adds when clause to error definitions |

### Refactoring

- **Normalize formatting**: Formats ISL code using the canonical printer (if available)

## API

### Wiring into Extension Activation

Add the following to your `extension.ts` `activate` function:

```typescript
import { 
  createDiagnosticsProvider,
  createQuickFixesProvider,
  registerQuickFixCommands 
} from './isl-language';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // ... existing activation code ...

  // Register ISL diagnostics
  const diagnosticsProvider = createDiagnosticsProvider();
  diagnosticsProvider.register(context);

  // Register ISL quick fixes
  const quickFixesProvider = createQuickFixesProvider();
  quickFixesProvider.register(context);

  // Register quick fix commands (optional - for command palette)
  registerQuickFixCommands(context);
}
```

### Manual Diagnostics Update

You can trigger a manual diagnostics update:

```typescript
const provider = createDiagnosticsProvider();
provider.register(context);

// Manually update diagnostics for a document
await provider.updateDiagnostics(document);

// Clear diagnostics for a document
provider.clearDiagnostics(document.uri);

// Clear all ISL diagnostics
provider.clearAll();
```

### Custom Quick Fix Options

```typescript
const quickFixes = createQuickFixesProvider({
  enableFormatting: true, // Enable format normalization action
});
quickFixes.register(context);
```

## Commands

The module registers the following commands (when `registerQuickFixCommands` is called):

| Command | Description |
|---------|-------------|
| `isl.addPostconditions` | Add postconditions block at cursor |
| `isl.addVersion` | Add version header to domain |
| `isl.normalizeFormatting` | Format document with canonical printer |

## Document Selector

Use the `islSelector` module for consistent document filtering:

```typescript
import { 
  ISL_SELECTOR,
  ISL_LANGUAGE_ID,
  isISLDocument,
  isISLUri 
} from './isl-language';

// Register a provider for ISL files
vscode.languages.registerHoverProvider(ISL_SELECTOR, myProvider);

// Check if a document is ISL
if (isISLDocument(document)) {
  // Handle ISL document
}
```

## Diagnostic Codes

### Parse Errors (P-series)

| Code | Description |
|------|-------------|
| `ISL-P001` | General parse error |
| `ISL-P002` | Unexpected token |
| `ISL-P003` | Missing closing brace |

### Semantic Warnings (S-series)

| Code | Description |
|------|-------------|
| `ISL-S001` | Missing postconditions block |
| `ISL-S002` | Missing version declaration |
| `ISL-S003` | Missing description |
| `ISL-S004` | Empty preconditions block |
| `ISL-S005` | Empty postconditions block |
| `ISL-S006` | Unused input field |

### Style Warnings (W-series)

| Code | Description |
|------|-------------|
| `ISL-W001` | Inconsistent naming convention |
| `ISL-W002` | Behavior name too long |
| `ISL-W003` | Error missing 'when' description |

## Dependencies

The module has optional dependencies on:

- `@isl-lang/parser` - Full ISL parser (falls back to regex-based parsing)
- `@isl-lang/isl-core` - Alternative parser source

These are loaded dynamically and the module gracefully degrades if unavailable.

## Architecture

```
isl-language/
├── diagnostics.ts      # Diagnostics provider (parse errors + semantic lint)
├── quickFixes.ts       # Quick fixes and code actions
├── islSelector.ts      # Document selectors and utilities
├── index.ts            # Public API exports
└── README.md           # This file
```

## Testing

Tests are located in `__tests__/`:

```typescript
import { ISLDiagnosticsProvider } from '../diagnostics';
import { ISLQuickFixesProvider } from '../quickFixes';

describe('ISLDiagnosticsProvider', () => {
  it('should detect missing postconditions', () => {
    // Test implementation
  });
});
```

## Notes

- Diagnostics are debounced (300ms) to prevent excessive updates during typing
- The canonical printer integration is optional and falls back to VS Code's formatter
- All features work without the full parser using regex-based fallback
