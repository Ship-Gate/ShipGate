# @isl-lang/lsp-core

Core language intelligence for ISL LSP - shared analysis and diagnostics.

## Installation

```bash
npm install @isl-lang/lsp-core
```

## Overview

This package provides the core language intelligence features used by the ISL language server. It's designed to be editor-agnostic and can be used to build custom language tooling.

## Usage

```typescript
import {
  LanguageService,
  createLanguageService,
  DocumentManager,
} from '@isl-lang/lsp-core';

// Create a language service
const service = createLanguageService();

// Add documents
service.openDocument('file:///specs/user.isl', `
  domain UserManagement {
    type User { id: uuid, name: string }
  }
`);

// Get diagnostics
const diagnostics = service.getDiagnostics('file:///specs/user.isl');

// Get completions
const completions = service.getCompletions(
  'file:///specs/user.isl',
  { line: 2, character: 10 }
);

// Get hover information
const hover = service.getHover(
  'file:///specs/user.isl',
  { line: 2, character: 15 }
);
```

## API

### `createLanguageService(): LanguageService`

Create a new language service instance.

### `LanguageService`

```typescript
interface LanguageService {
  // Document management
  openDocument(uri: string, content: string): void;
  updateDocument(uri: string, content: string): void;
  closeDocument(uri: string): void;

  // Diagnostics
  getDiagnostics(uri: string): Diagnostic[];
  getAllDiagnostics(): Map<string, Diagnostic[]>;

  // Completions
  getCompletions(uri: string, position: Position): CompletionItem[];

  // Hover
  getHover(uri: string, position: Position): Hover | null;

  // Go to definition
  getDefinition(uri: string, position: Position): Location | null;

  // Find references
  getReferences(uri: string, position: Position): Location[];

  // Document symbols
  getDocumentSymbols(uri: string): DocumentSymbol[];

  // Formatting
  formatDocument(uri: string): TextEdit[];
  formatRange(uri: string, range: Range): TextEdit[];

  // Rename
  prepareRename(uri: string, position: Position): Range | null;
  rename(uri: string, position: Position, newName: string): WorkspaceEdit;

  // Code actions
  getCodeActions(uri: string, range: Range): CodeAction[];
}
```

## Features

- **Diagnostics** - Real-time error and warning detection
- **Completions** - Context-aware auto-completion
- **Hover** - Type information on hover
- **Go to Definition** - Navigate to symbol definitions
- **Find References** - Find all references to a symbol
- **Document Symbols** - Outline view of document
- **Formatting** - Code formatting
- **Rename** - Safe symbol renaming
- **Code Actions** - Quick fixes and refactoring

## Documentation

Full documentation: https://isl-lang.dev/docs/lsp-core

## Related Packages

- [@isl-lang/lsp-server](https://npm.im/@isl-lang/lsp-server) - LSP server implementation
- [@isl-lang/parser](https://npm.im/@isl-lang/parser) - ISL parser

## License

MIT
