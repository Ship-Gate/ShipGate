/**
 * ISL Adapters - CLI Integration
 * 
 * @module @isl-lang/adapters/cli
 */

export {
  runGateCommand,
  runQuickCheck,
  type GateCommandOptions,
  type GateCommandResult,
} from './gate-command.js';

export {
  runDemoCommand,
  formatDemoOutput,
  printDemoInfo,
  type DemoCommandOptions,
  type DemoResult,
} from './demo-command.js';
