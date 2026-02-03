#!/usr/bin/env node

/**
 * ISL CLI
 * 
 * Command-line interface for the Intent Specification Language.
 * 
 * Commands:
 *   isl check <files>          - Parse and type check ISL files
 *   isl generate --types       - Generate TypeScript types
 *   isl generate --tests       - Generate test files
 *   isl generate --docs        - Generate documentation
 *   isl verify --impl <file>   - Verify implementation against spec
 *   isl init <name>            - Initialize new ISL project
 *   isl build                  - Full pipeline: check + generate
 */

import { program } from './cli.js';
import { ExitCode } from './exit-codes.js';

// Intercept process.exit to handle Commander's direct calls
const originalExit = process.exit;
let exitIntercepted = false;

process.exit = function(code?: number | null): never {
  // Only intercept the first exit call to avoid infinite loops
  if (!exitIntercepted) {
    exitIntercepted = true;
    
    // Check if this is a usage error by examining the error output
    // Commander outputs "error: missing required argument" before calling exit(1)
    // We can't easily detect this, so we'll let exitOverride handle it
    // But if exitOverride didn't catch it, this is a fallback
    if (code === 1) {
      // Check stderr for usage error patterns (this is a best-effort approach)
      // Since we can't easily inspect stderr here, we'll rely on exitOverride
    }
  }
  
  return originalExit.call(process, code ?? 0);
};

// Parse command line arguments and execute
program.parse();
