// ============================================================================
// ISL REPL - Main Entry Point
// ============================================================================

// Core REPL
export { ISLREPL, startREPL } from './repl';
export type { REPLOptions } from './repl';

// Session management
export { Session, createSession } from './session';
export type { Intent, Condition, Scenario, SessionConfig } from './session';

// Commands
export { metaCommands, islCommands, findSimilarCommand } from './commands';
export type { MetaCommand, ISLCommand, CommandResult } from './commands';

// Completions
export { 
  CompletionProvider, 
  createCompleter,
  COMMANDS,
  KEYWORDS,
  META_COMMANDS,
  ISL_COMMANDS,
} from './completions';
export type { CompletionItem } from './completions';

// Formatting
export {
  colors,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  formatIntent,
  formatCondition,
  formatValue,
  formatTable,
  formatParseError,
  formatTypeError,
  highlightExpression,
  highlightISL,
  stripColors,
  wrapText,
  drawBox,
} from './formatter';

// History
export { History, MemoryHistory } from './history';
