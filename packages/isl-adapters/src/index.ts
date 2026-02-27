/**
 * ISL Adapters - GitHub Actions, MCP, CLI, and Domain Integrations
 * 
 * @module @isl-lang/adapters
 * 
 * @example
 * ```typescript
 * // GitHub Actions
 * import { isGitHubActions, generatePRComment } from '@isl-lang/adapters/github';
 * 
 * // MCP Tools
 * import { firewallTools, gateTools } from '@isl-lang/adapters/mcp';
 * 
 * // CLI
 * import { runGateCommand } from '@isl-lang/adapters/cli';
 * 
 * // Auth Domain (offline-only verification)
 * import { createFixtureAdapter, createTraceAdapter } from '@isl-lang/adapters/auth';
 * ```
 */

// Re-export from submodules
export * from './github/index.js';
export * from './mcp/index.js';
export * from './cli/index.js';
export * from './auth/index.js';
