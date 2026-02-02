# @isl-lang/repl

Interactive REPL for exploring ISL (Intent Specification Language) specifications.

## Installation

```bash
npm install -g @isl-lang/repl

# Or use via the CLI
npm install -g @isl-lang/cli
isl repl
```

## Usage

```bash
# Start the REPL
isl-repl

# Or via the main CLI
isl repl
```

### REPL Commands

```
ISL REPL v0.1.0
Type .help for available commands

isl> .help
  .help           Show this help message
  .load <file>    Load an ISL file
  .clear          Clear the current context
  .types          Show loaded types
  .intents        Show loaded intents
  .domains        Show loaded domains
  .ast            Show AST for last input
  .exit           Exit the REPL

isl> domain Test {
...>   type User { id: uuid, name: string }
...> }
Domain 'Test' defined with 1 type

isl> .types
  Test.User { id: uuid, name: string }

isl> .load ./specs/api.isl
Loaded: ./specs/api.isl (3 domains, 12 intents)
```

## Programmatic Usage

```typescript
import { Repl, createReplContext } from '@isl-lang/repl';

// Create a REPL instance
const repl = new Repl({
  prompt: 'myapp> ',
  historyFile: '.myapp_history',
});

// Pre-load files
await repl.loadFile('./specs/base.isl');

// Evaluate expressions
const result = await repl.evaluate('type User { name: string }');

// Start interactive mode
repl.start();
```

## Features

- **Syntax highlighting** - Colorized ISL syntax
- **Auto-completion** - Tab completion for keywords and loaded symbols
- **History** - Command history with up/down arrows
- **Multi-line input** - Automatic detection of incomplete input
- **File loading** - Load and explore existing ISL files
- **AST inspection** - View the parsed AST

## Configuration

Create `.islrc` in your home directory:

```json
{
  "historySize": 1000,
  "prompt": "isl> ",
  "colors": true,
  "autoLoad": ["~/.isl/prelude.isl"]
}
```

## Documentation

Full documentation: https://isl-lang.dev/docs/repl

## Related Packages

- [@isl-lang/cli](https://npm.im/@isl-lang/cli) - Full CLI tool
- [@isl-lang/parser](https://npm.im/@isl-lang/parser) - ISL parser

## License

MIT
