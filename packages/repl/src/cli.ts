#!/usr/bin/env node
// ============================================================================
// ISL REPL CLI Entry Point
// ============================================================================

import { startREPL } from './repl';

/**
 * Main entry point
 */
export function main(): void {
  const args = process.argv.slice(2);
  
  const options = {
    colors: !args.includes('--no-color'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ISL REPL - Intent Specification Language Interactive Shell

Usage: isl-repl [options]

Options:
  --no-color    Disable colored output
  -v, --verbose Enable verbose output
  -h, --help    Show this help message

Inside the REPL:
  .help         Show all commands
  .exit         Exit the REPL
  :check        Type check intents
  :gen          Generate code
  :load         Load ISL file
  :list         List intents

Example:
  $ isl-repl
  isl> intent Greeting {
  ...>   pre: name.length > 0
  ...>   post: result.startsWith("Hello")
  ...> }
  ✓ Intent 'Greeting' defined (1 pre, 1 post)
`);
    process.exit(0);
  }

  startREPL(options);
}

// Run if executed directly
if (require.main === module) {
  main();
}
