// ============================================================================
// ISL REPL Tab Completion
// Intelligent completions for commands and expressions
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { Session } from './session';
import { metaCommands, islCommands } from './commands';

/**
 * Completion item
 */
export interface CompletionItem {
  text: string;
  type: 'command' | 'intent' | 'keyword' | 'variable' | 'file';
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ISL keywords
 */
export const KEYWORDS: CompletionItem[] = [
  { text: 'intent', type: 'keyword', description: 'Define an intent' },
  { text: 'behavior', type: 'keyword', description: 'Define a behavior' },
  { text: 'pre', type: 'keyword', description: 'Precondition' },
  { text: 'post', type: 'keyword', description: 'Postcondition' },
  { text: 'invariant', type: 'keyword', description: 'Invariant' },
  { text: 'true', type: 'keyword', description: 'Boolean true' },
  { text: 'false', type: 'keyword', description: 'Boolean false' },
  { text: 'null', type: 'keyword', description: 'Null value' },
  { text: 'and', type: 'keyword', description: 'Logical AND' },
  { text: 'or', type: 'keyword', description: 'Logical OR' },
  { text: 'not', type: 'keyword', description: 'Logical NOT' },
  { text: 'implies', type: 'keyword', description: 'Logical implication' },
  { text: 'forall', type: 'keyword', description: 'Universal quantifier' },
  { text: 'exists', type: 'keyword', description: 'Existential quantifier' },
  { text: 'in', type: 'keyword', description: 'Membership test' },
];

/**
 * Meta commands (. prefix)
 */
export const META_COMMANDS: CompletionItem[] = metaCommands.map(cmd => ({
  text: `.${cmd.name}`,
  type: 'command' as const,
  description: cmd.description,
}));

/**
 * ISL commands (: prefix)
 */
export const ISL_COMMANDS: CompletionItem[] = islCommands.map(cmd => ({
  text: `:${cmd.name}`,
  type: 'command' as const,
  description: cmd.description,
}));

/**
 * All commands
 */
export const COMMANDS: CompletionItem[] = [...META_COMMANDS, ...ISL_COMMANDS];

/**
 * Generate targets for :gen command
 */
export const GEN_TARGETS: CompletionItem[] = [
  { text: 'typescript', type: 'keyword', description: 'Generate TypeScript contract' },
  { text: 'rust', type: 'keyword', description: 'Generate Rust contract' },
  { text: 'go', type: 'keyword', description: 'Generate Go contract' },
  { text: 'openapi', type: 'keyword', description: 'Generate OpenAPI schema' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Completion Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provides intelligent completions based on context
 */
export class CompletionProvider {
  constructor(private session: Session) {}

  /**
   * Update the session reference
   */
  setSession(session: Session): void {
    this.session = session;
  }

  /**
   * Get completions for a line
   */
  complete(line: string): [CompletionItem[], string] {
    const trimmed = line.trimStart();

    // Meta command completion (. prefix)
    if (trimmed.startsWith('.')) {
      return this.completeMetaCommand(trimmed);
    }

    // ISL command completion (: prefix)
    if (trimmed.startsWith(':')) {
      return this.completeISLCommand(trimmed);
    }

    // Expression completion
    return this.completeExpression(trimmed);
  }

  /**
   * Complete meta commands
   */
  private completeMetaCommand(line: string): [CompletionItem[], string] {
    const parts = line.slice(1).split(/\s+/);
    const cmdPart = parts[0] || '';

    // Just the command prefix - show all meta commands
    if (parts.length === 1) {
      const matches = META_COMMANDS.filter(c => 
        c.text.toLowerCase().startsWith(`.${cmdPart.toLowerCase()}`)
      );
      return [matches.length > 0 ? matches : META_COMMANDS, '.' + cmdPart];
    }

    // Command arguments
    return [[], line];
  }

  /**
   * Complete ISL commands
   */
  private completeISLCommand(line: string): [CompletionItem[], string] {
    const parts = line.slice(1).split(/\s+/);
    const cmdPart = parts[0] || '';
    const args = parts.slice(1);

    // Just the command prefix - show all ISL commands
    if (parts.length === 1) {
      const matches = ISL_COMMANDS.filter(c => 
        c.text.toLowerCase().startsWith(`:${cmdPart.toLowerCase()}`)
      );
      return [matches.length > 0 ? matches : ISL_COMMANDS, ':' + cmdPart];
    }

    // Command-specific argument completion
    const cmd = cmdPart.toLowerCase();
    
    switch (cmd) {
      case 'gen':
      case 'generate':
      case 'g':
        return this.completeGenCommand(args);
      
      case 'check':
      case 'c':
      case 'inspect':
      case 'i':
      case 'show':
        return this.completeIntentName(args[0] || '');
      
      case 'load':
      case 'l':
      case 'export':
      case 'save':
        return this.completeFilePath(args[0] || '');
      
      default:
        return [[], line];
    }
  }

  /**
   * Complete :gen command arguments
   */
  private completeGenCommand(args: string[]): [CompletionItem[], string] {
    // First argument: target
    if (args.length <= 1) {
      const partial = args[0] || '';
      const matches = GEN_TARGETS.filter(t => 
        t.text.toLowerCase().startsWith(partial.toLowerCase())
      );
      return [matches.length > 0 ? matches : GEN_TARGETS, partial];
    }

    // Second argument: intent name
    return this.completeIntentName(args[1] || '');
  }

  /**
   * Complete intent names
   */
  private completeIntentName(partial: string): [CompletionItem[], string] {
    const intents = this.session.getAllIntents();
    const items: CompletionItem[] = intents.map(intent => ({
      text: intent.name,
      type: 'intent',
      description: `${intent.preconditions.length} pre, ${intent.postconditions.length} post`,
    }));

    const matches = items.filter(i => 
      i.text.toLowerCase().startsWith(partial.toLowerCase())
    );

    return [matches.length > 0 ? matches : items, partial];
  }

  /**
   * Complete file paths
   */
  private completeFilePath(partial: string): [CompletionItem[], string] {
    try {
      const dir = path.dirname(partial) || '.';
      const base = path.basename(partial);
      const resolvedDir = path.resolve(this.session.getConfig().cwd || process.cwd(), dir);

      if (!fs.existsSync(resolvedDir)) {
        return [[], partial];
      }

      const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
      const items: CompletionItem[] = entries
        .filter(e => {
          const name = e.name.toLowerCase();
          return name.startsWith(base.toLowerCase()) && 
                 (e.isDirectory() || name.endsWith('.isl'));
        })
        .map(e => ({
          text: path.join(dir, e.name + (e.isDirectory() ? '/' : '')),
          type: 'file' as const,
          description: e.isDirectory() ? 'Directory' : 'ISL file',
        }));

      return [items, partial];
    } catch {
      return [[], partial];
    }
  }

  /**
   * Complete expressions
   */
  private completeExpression(line: string): [CompletionItem[], string] {
    const items: CompletionItem[] = [...KEYWORDS];

    // Add intent names
    for (const intent of this.session.getAllIntents()) {
      items.push({
        text: intent.name,
        type: 'intent',
        description: 'Defined intent',
      });
    }

    // Add variables
    for (const [name] of this.session.getAllVariables()) {
      items.push({
        text: name,
        type: 'variable',
        description: 'Variable',
      });
    }

    // Add special variable
    items.push({
      text: '_',
      type: 'variable',
      description: 'Last result',
    });

    // Find partial word at end of line
    const match = line.match(/[\w.]+$/);
    const partial = match ? match[0] : '';

    // Filter by partial
    const matches = items.filter(i => 
      i.text.toLowerCase().startsWith(partial.toLowerCase())
    );

    return [matches.length > 0 ? matches : items, partial];
  }

  /**
   * Get all available completions (for help)
   */
  getAllCompletions(): {
    metaCommands: CompletionItem[];
    islCommands: CompletionItem[];
    keywords: CompletionItem[];
    intents: CompletionItem[];
  } {
    return {
      metaCommands: META_COMMANDS,
      islCommands: ISL_COMMANDS,
      keywords: KEYWORDS,
      intents: this.session.getAllIntents().map(i => ({
        text: i.name,
        type: 'intent' as const,
        description: `${i.preconditions.length} pre, ${i.postconditions.length} post`,
      })),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Readline Completer Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a readline-compatible completer function
 */
export function createCompleter(
  provider: CompletionProvider
): (line: string) => [string[], string] {
  return (line: string): [string[], string] => {
    const [items, partial] = provider.complete(line);
    const completions = items.map(i => i.text);
    return [completions, partial];
  };
}
