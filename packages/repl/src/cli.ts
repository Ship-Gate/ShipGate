#!/usr/bin/env node
// ============================================================================
// ISL REPL CLI Entry Point
// ============================================================================

import { startREPL, type REPLOptions } from './repl';

/**
 * Parse CLI arguments into REPLOptions
 */
function parseArgs(argv: string[]): REPLOptions & { help: boolean } {
  const options: REPLOptions & { help: boolean } = {
    help: false,
    colors: true,
    verbose: false,
    parseOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--no-color':
        options.colors = false;
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--load':
        options.load = argv[++i];
        break;

      case '--context':
        options.context = argv[++i];
        break;

      case '--parse':
        options.parseOnly = true;
        break;

      default:
        // Accept --load=file or --context=json
        if (arg.startsWith('--load=')) {
          options.load = arg.slice(7);
        } else if (arg.startsWith('--context=')) {
          options.context = arg.slice(10);
        }
        break;
    }
  }

  return options;
}

/**
 * Print help text
 */
function printHelp(): void {
  process.stdout.write(`
ISL REPL - Intent Specification Language Interactive Shell

Usage: isl-repl [options]

Options:
  --load <file>       Load an ISL file on start
  --context <json>    Set initial evaluation context
  --parse             Parse mode (non-interactive, for piped input)
  --no-color          Disable colored output
  -v, --verbose       Enable verbose output
  -h, --help          Show this help message

Inside the REPL:
  .help               Show all commands
  .parse <isl>        Parse ISL and show AST
  .eval <expr>        Evaluate expression against context
  .check [intent]     Type check intents
  .gen [intent]       Generate TypeScript from intent
  .load <file>        Load an .isl file
  .context <json>     Set evaluation context (mock data)
  .clear              Reset session state
  .list               List defined intents
  .inspect [intent]   Show full details of an intent
  .history            Show command history
  .exit               Exit the REPL

Multi-line Input:
  Type ISL with braces — the REPL auto-detects multi-line:
  isl> domain Example {
  ...>   entity User {
  ...>     id: UUID
  ...>     name: String
  ...>   }
  ...> }

Examples:
  $ isl-repl
  $ isl-repl --load auth.isl
  $ isl-repl --context '{"user": {"id": 1}}'
  $ echo 'domain X { version: "1.0" }' | isl-repl --parse
`);
}

/**
 * Main entry point
 */
export function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  startREPL(options);
}

// Run if executed directly (ESM + CJS compat)
const isMainModule = typeof require !== 'undefined'
  ? require.main === module
  : process.argv[1]?.includes('cli');

if (isMainModule) {
  main();
}
