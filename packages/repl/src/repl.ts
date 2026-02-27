// ============================================================================
// ISL REPL - Core REPL Loop
// ============================================================================

import * as readline from 'readline';
import { Session, Intent } from './session';
import { History } from './history';
import { CompletionProvider, createCompleter } from './completions';
import { formatSuccess, formatError, formatWarning, colors, highlightISL } from './formatter';
import {
  MetaCommand,
  metaCommands,
  findSimilarCommand,
} from './commands';

const VERSION = '0.1.0';
const PROMPT = `${colors.cyan}isl>${colors.reset} `;
const CONTINUATION_PROMPT = `${colors.cyan}...>${colors.reset} `;

export interface REPLOptions {
  colors?: boolean;
  verbose?: boolean;
  historyFile?: string;
  /** Load an ISL file on startup */
  load?: string;
  /** Set initial evaluation context (JSON string) */
  context?: string;
  /** Parse-only mode (non-interactive, for piped input) */
  parseOnly?: boolean;
}

/**
 * ISL REPL - Interactive Read-Eval-Print Loop
 */
export class ISLREPL {
  private session: Session;
  private history: History;
  private completionProvider: CompletionProvider;
  private rl: readline.Interface | null = null;
  private buffer: string[] = [];
  private braceCount = 0;
  private options: REPLOptions;
  private running = false;

  constructor(options: REPLOptions = {}) {
    this.options = {
      colors: options.colors !== false,
      verbose: options.verbose ?? false,
      historyFile: options.historyFile,
      load: options.load,
      context: options.context,
      parseOnly: options.parseOnly ?? false,
    };

    this.session = new Session({ colors: this.options.colors });
    this.history = new History({
      historyFile: this.options.historyFile,
    });
    this.completionProvider = new CompletionProvider(this.session);
  }

  /**
   * Start the REPL
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Apply startup options
    this.applyStartupOptions();

    // Handle pipe mode (non-interactive)
    if (this.options.parseOnly || !process.stdin.isTTY) {
      this.runPipeMode();
      return;
    }

    // Load history
    this.history.load();

    // Create readline interface with tab completion
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
      completer: createCompleter(this.completionProvider),
      terminal: true,
    });

    // Print banner
    this.printBanner();
    this.rl.prompt();

    // Handle line input
    this.rl.on('line', (line: string) => {
      this.handleLine(line);
      if (this.rl && this.running) {
        this.rl.setPrompt(this.braceCount > 0 ? CONTINUATION_PROMPT : PROMPT);
        this.rl.prompt();
      }
    });

    // Handle close (Ctrl+D)
    this.rl.on('close', () => {
      this.exit();
    });

    // Handle SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      if (this.buffer.length > 0) {
        // Cancel multi-line input
        this.buffer = [];
        this.braceCount = 0;
        process.stdout.write('\n' + formatWarning('Input cancelled') + '\n');
        this.rl!.setPrompt(PROMPT);
        this.rl!.prompt();
      } else {
        process.stdout.write('\n' + formatWarning('Use .exit to quit') + '\n');
        this.rl!.prompt();
      }
    });
  }

  /**
   * Apply startup options (--load, --context)
   */
  private applyStartupOptions(): void {
    if (this.options.context) {
      const result = this.session.setEvalContext(this.options.context);
      if (result.success) {
        process.stdout.write(
          formatSuccess(`Context set (${result.count} variable${result.count !== 1 ? 's' : ''})`) + '\n'
        );
      } else {
        process.stdout.write(formatError(`Invalid context JSON: ${result.error}`) + '\n');
      }
    }

    if (this.options.load) {
      const loadCmd = metaCommands.find(c => c.name === 'load');
      if (loadCmd) {
        const result = loadCmd.handler([this.options.load], this.session, this);
        if (result.output) {
          process.stdout.write(result.output + '\n');
        }
      }
    }
  }

  /**
   * Run in pipe mode (read all stdin, parse, and output)
   */
  private runPipeMode(): void {
    let input = '';

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      input += chunk;
    });

    process.stdin.on('end', () => {
      const trimmed = input.trim();
      if (!trimmed) {
        process.exit(0);
        return;
      }

      // If --parse mode, just parse and show AST
      if (this.options.parseOnly) {
        const parseCmd = metaCommands.find(c => c.name === 'parse');
        if (parseCmd) {
          const result = parseCmd.handler(trimmed.split(' '), this.session, this);
          if (result.output) {
            process.stdout.write(result.output + '\n');
          }
        }
      } else {
        // Otherwise, process line by line
        const lines = trimmed.split('\n');
        for (const line of lines) {
          this.handleLine(line);
        }
      }

      process.exit(0);
    });
  }

  /**
   * Print the welcome banner
   */
  private printBanner(): void {
    const banner = `
${colors.cyan}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗███████╗██╗         ██████╗ ███████╗██████╗ ██╗          ║
║   ██║██╔════╝██║         ██╔══██╗██╔════╝██╔══██╗██║          ║
║   ██║███████╗██║         ██████╔╝█████╗  ██████╔╝██║          ║
║   ██║╚════██║██║         ██╔══██╗██╔══╝  ██╔═══╝ ██║          ║
║   ██║███████║███████╗    ██║  ██║███████╗██║     ███████╗     ║
║   ╚═╝╚══════╝╚══════╝    ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bold}ISL v${VERSION}${colors.reset} — Intent Specification Language
Type ${colors.cyan}.help${colors.reset} for commands, ${colors.cyan}.exit${colors.reset} to quit
`;
    process.stdout.write(banner);
  }

  /**
   * Handle a line of input
   */
  handleLine(line: string): void {
    const trimmed = line.trim();

    // Handle empty line
    if (!trimmed && this.buffer.length === 0) {
      return;
    }

    // Handle dot commands (. prefix) - only at start, not in multi-line
    if (trimmed.startsWith('.') && this.buffer.length === 0) {
      this.handleDotCommand(trimmed);
      return;
    }

    // Handle colon commands (: prefix) as aliases — redirect to dot commands
    if (trimmed.startsWith(':') && this.buffer.length === 0) {
      this.handleDotCommand('.' + trimmed.slice(1));
      return;
    }

    // Track braces for multi-line input
    this.braceCount += (line.match(/\{/g) || []).length;
    this.braceCount -= (line.match(/\}/g) || []).length;
    this.buffer.push(line);

    // Execute when braces are balanced
    if (this.braceCount <= 0) {
      const code = this.buffer.join('\n');
      this.buffer = [];
      this.braceCount = 0;

      // Add to history
      this.history.add(code);
      this.session.addToHistory(code);

      // Evaluate the code
      this.evaluate(code);
    }
  }

  /**
   * Handle a dot command (. prefix)
   */
  private handleDotCommand(input: string): void {
    const parts = input.slice(1).split(/\s+/);
    const cmdName = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    // For .context and .eval, join args back since they may contain spaces/JSON
    const rawArgs = input.slice(1 + (cmdName.length || 0)).trim();

    const command = metaCommands.find(
      c => c.name === cmdName || c.aliases.includes(cmdName)
    );

    if (command) {
      this.history.add(input);

      // For commands that need raw input (context JSON, eval expressions, parse)
      const needsRawArgs = ['context', 'ctx', 'eval', 'e', 'parse', 'p', 'ast', 'load', 'l'];
      const effectiveArgs = needsRawArgs.includes(cmdName) && rawArgs
        ? [rawArgs]
        : args;

      const result = command.handler(effectiveArgs, this.session, this);
      if (result.output) {
        process.stdout.write(result.output + '\n');
      }
      if (result.exit) {
        this.exit();
      }
    } else {
      // Try to suggest similar command
      const suggestion = findSimilarCommand(cmdName);
      if (suggestion) {
        process.stdout.write(formatError(`Unknown command: .${cmdName}`) + '\n');
        process.stdout.write(formatWarning(`Did you mean: .${suggestion}?`) + '\n');
      } else {
        process.stdout.write(formatError(`Unknown command: .${cmdName}`) + '\n');
        process.stdout.write(`Type ${colors.cyan}.help${colors.reset} for available commands\n`);
      }
    }
  }

  /**
   * Evaluate ISL code (multi-line input or bare expressions)
   */
  private evaluate(code: string): void {
    try {
      const trimmed = code.trim();

      // Try the real parser first
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { parse } = require('@isl-lang/parser') as {
          parse: (source: string, filename?: string) => {
            success: boolean;
            domain?: Record<string, unknown>;
            errors: Array<{
              message: string;
              severity?: string;
              location?: { line: number; column: number };
            }>;
          };
        };

        // Wrap bare constructs in a domain if needed
        let parseInput = trimmed;
        const needsWrapper = !trimmed.startsWith('domain ');
        if (needsWrapper) {
          parseInput = `domain _REPL { version: "0.0.1"\n${trimmed}\n}`;
        }

        const result = parse(parseInput, '<repl>');

        if (result.errors.length > 0) {
          // Show errors with inline diagnostics
          for (const err of result.errors) {
            const loc = err.location;
            if (loc) {
              // Adjust line number if we wrapped
              const adjustedLine = needsWrapper ? Math.max(1, loc.line - 1) : loc.line;
              const lines = trimmed.split('\n');
              const errorLine = lines[adjustedLine - 1] || '';

              process.stdout.write(
                `${colors.red}\u2717 Error at line ${adjustedLine}, col ${loc.column}:${colors.reset}\n`
              );
              process.stdout.write(`  ${errorLine}\n`);
              process.stdout.write(`  ${' '.repeat(Math.max(0, loc.column - 1))}${colors.red}^^^^^${colors.reset}\n`);

              // Try to suggest corrections for unknown types
              const typeMatch = err.message.match(/Unknown type '(\w+)'/i) ||
                               err.message.match(/unexpected.*'(\w+)'/i);
              if (typeMatch) {
                const suggestion = suggestCorrection(typeMatch[1]!);
                if (suggestion) {
                  process.stdout.write(
                    `  ${colors.yellow}Did you mean '${suggestion}'?${colors.reset}\n`
                  );
                }
              } else {
                process.stdout.write(`  ${err.message}\n`);
              }
            } else {
              process.stdout.write(formatError(err.message) + '\n');
            }
          }
          return;
        }

        if (result.domain) {
          this.session.setDomainAST(result.domain);
          const domain = result.domain as {
            name?: { name?: string };
            entities?: Array<{ name?: { name?: string } }>;
            behaviors?: Array<{ name?: { name?: string } }>;
            invariants?: unknown[];
          };

          if (needsWrapper) {
            // Show summary of what was defined
            const entityCount = domain.entities?.length ?? 0;
            const behaviorCount = domain.behaviors?.length ?? 0;
            const parts: string[] = [];
            if (entityCount > 0) parts.push(`${entityCount} entit${entityCount === 1 ? 'y' : 'ies'}`);
            if (behaviorCount > 0) parts.push(`${behaviorCount} behavior${behaviorCount === 1 ? '' : 's'}`);

            if (parts.length > 0) {
              process.stdout.write(
                formatSuccess(`Parsed: ${parts.join(', ')}`) + '\n'
              );
            } else {
              process.stdout.write(formatSuccess('Parsed successfully') + '\n');
            }
          } else {
            const name = domain.name?.name ?? 'Unknown';
            const entityCount = domain.entities?.length ?? 0;
            const behaviorCount = domain.behaviors?.length ?? 0;

            process.stdout.write(
              formatSuccess(
                `Parsed: domain ${name} (${entityCount} entit${entityCount === 1 ? 'y' : 'ies'}, ${behaviorCount} behavior${behaviorCount === 1 ? '' : 's'})`
              ) + '\n'
            );
          }
          return;
        }
      } catch {
        // Real parser not available — fall through to built-in handling
      }

      // Fallback: Built-in intent/behavior parsing
      if (trimmed.startsWith('intent ') || trimmed.startsWith('behavior ')) {
        this.evaluateIntent(trimmed);
        return;
      }

      // For domain blocks without the real parser
      if (trimmed.startsWith('domain ')) {
        process.stdout.write(formatSuccess('Parsed domain block') + '\n');
        return;
      }

      // Unknown input
      process.stdout.write(
        formatWarning(`Cannot evaluate: ${trimmed.split('\n')[0]}...`) + '\n'
      );
      process.stdout.write(
        `Use ${colors.cyan}.help${colors.reset} for available commands\n`
      );
    } catch (error) {
      this.printError(error);
    }
  }

  /**
   * Evaluate an intent definition
   */
  private evaluateIntent(code: string): void {
    const intent = this.session.parseIntent(code);

    if (intent) {
      this.session.defineIntent(intent);

      const preCount = intent.preconditions.length;
      const postCount = intent.postconditions.length;
      const invCount = intent.invariants.length;

      const parts: string[] = [];
      if (preCount > 0) parts.push(`${preCount} pre`);
      if (postCount > 0) parts.push(`${postCount} post`);
      if (invCount > 0) parts.push(`${invCount} invariant`);

      const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      process.stdout.write(
        formatSuccess(`Intent '${intent.name}' defined${summary}`) + '\n'
      );
    } else {
      // Try parsing as behavior
      const behaviorMatch = code.match(/^behavior\s+(\w+)\s*\{([\s\S]*)\}$/);
      if (behaviorMatch) {
        const name = behaviorMatch[1]!;
        const body = behaviorMatch[2]!;

        const newIntent: Intent = {
          name,
          preconditions: [],
          postconditions: [],
          invariants: [],
          scenarios: [],
          rawSource: code,
        };

        const preSection = body.match(/pre(?:conditions)?\s*\{([^}]*)\}/s);
        if (preSection) {
          for (const line of preSection[1]!.trim().split('\n')) {
            const expr = line.trim().replace(/^-\s*/, '').trim();
            if (expr) newIntent.preconditions.push({ expression: expr });
          }
        }

        const postSection = body.match(/post(?:conditions)?\s*\{([^}]*)\}/s);
        if (postSection) {
          for (const line of postSection[1]!.trim().split('\n')) {
            const expr = line.trim().replace(/^-\s*/, '').trim();
            if (expr) newIntent.postconditions.push({ expression: expr });
          }
        }

        this.session.defineIntent(newIntent);

        const parts: string[] = [];
        if (newIntent.preconditions.length > 0) parts.push(`${newIntent.preconditions.length} pre`);
        if (newIntent.postconditions.length > 0) parts.push(`${newIntent.postconditions.length} post`);
        const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        process.stdout.write(
          formatSuccess(`Intent '${name}' defined${summary}`) + '\n'
        );
      } else {
        process.stdout.write(formatError('Failed to parse intent definition') + '\n');
      }
    }
  }

  /**
   * Print an error
   */
  private printError(error: unknown): void {
    if (error instanceof Error) {
      process.stdout.write(formatError(error.message) + '\n');
      if (this.options.verbose && error.stack) {
        process.stdout.write(colors.gray + error.stack + colors.reset + '\n');
      }
    } else {
      process.stdout.write(formatError(String(error)) + '\n');
    }
  }

  /**
   * Exit the REPL
   */
  exit(): void {
    this.running = false;
    this.history.save();
    process.stdout.write(`\n${colors.yellow}Goodbye!${colors.reset}\n`);
    if (this.rl) {
      this.rl.close();
    }
    process.exit(0);
  }

  /**
   * Get the session
   */
  getSession(): Session {
    return this.session;
  }

  /**
   * Get history
   */
  getHistory(): History {
    return this.history;
  }

  /**
   * Execute a single command and return result (for testing)
   */
  async executeOnce(input: string): Promise<{ success: boolean; output?: string; error?: string }> {
    const trimmed = input.trim();

    if (trimmed.startsWith('.') || trimmed.startsWith(':')) {
      const normalized = trimmed.startsWith(':') ? '.' + trimmed.slice(1) : trimmed;
      const parts = normalized.slice(1).split(/\s+/);
      const cmdName = parts[0]?.toLowerCase() || '';
      const rawArgs = normalized.slice(1 + (cmdName.length || 0)).trim();

      const command = metaCommands.find(
        c => c.name === cmdName || c.aliases.includes(cmdName)
      );

      if (command) {
        const needsRawArgs = ['context', 'ctx', 'eval', 'e', 'parse', 'p', 'ast', 'load', 'l'];
        const effectiveArgs = needsRawArgs.includes(cmdName) && rawArgs
          ? [rawArgs]
          : parts.slice(1);

        const result = command.handler(effectiveArgs, this.session, this);
        return { success: true, output: result.output };
      }
      return { success: false, error: `Unknown command: ${cmdName}` };
    }

    // Intent definition
    if (trimmed.startsWith('intent ') || trimmed.startsWith('behavior ')) {
      const intent = this.session.parseIntent(trimmed);
      if (intent) {
        this.session.defineIntent(intent);
        return { success: true, output: `Intent '${intent.name}' defined` };
      }
      return { success: false, error: 'Failed to parse intent' };
    }

    return { success: false, error: 'Unknown input' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Suggestion Helper
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_TYPES = [
  'String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp', 'Duration',
  'List', 'Map', 'Optional', 'Number',
];

function suggestCorrection(typo: string): string | null {
  const lower = typo.toLowerCase();
  for (const t of KNOWN_TYPES) {
    if (t.toLowerCase() === lower) return t;
    // Simple similarity: same start, within 2 chars diff
    if (t.toLowerCase().startsWith(lower.slice(0, 3)) &&
        Math.abs(t.length - typo.length) <= 2) {
      return t;
    }
  }
  return null;
}

/**
 * Start the REPL
 */
export function startREPL(options?: REPLOptions): ISLREPL {
  const repl = new ISLREPL(options);
  repl.start();
  return repl;
}
