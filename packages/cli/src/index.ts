#!/usr/bin/env node

/**
 * ShipGate CLI
 *
 * Command-line interface for ShipGate — define what your code should do, we enforce it.
 *
 * Commands:
 *   shipgate check <files>     - Parse and type check ISL files
 *   shipgate generate --types  - Generate TypeScript types
 *   shipgate verify --impl     - Verify implementation against spec
 *   shipgate init <name>       - Initialize new ShipGate project
 *   shipgate build             - Full pipeline: check + generate
 */

import { program } from './cli.js';
import { ExitCode } from './exit-codes.js';
import { initTracing, shutdownTracing } from '@isl-lang/observability';

// Initialise tracing early — noop unless ISL_TRACE=1 or SHIPGATE_TRACE=1
initTracing({ serviceName: 'shipgate-cli', serviceVersion: '1.0.0' });

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

// Parse command line arguments and execute — flush traces before exit
program.parseAsync().then(() => shutdownTracing()).catch(async (err) => {
  await shutdownTracing();
  console.error(err);
  process.exit(ExitCode.INTERNAL_ERROR);
});
