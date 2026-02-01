// ============================================================================
// ISL REPL - Core REPL Loop
// ============================================================================

import * as readline from 'readline';
import { Session, Intent } from './session';
import { History } from './history';
import { CompletionProvider, createCompleter } from './completions';
import { formatIntent, formatError, formatSuccess, formatWarning, colors } from './formatter';
import {
  MetaCommand,
  ISLCommand,
  metaCommands,
  islCommands,
  findSimilarCommand,
} from './commands';

const VERSION = '0.1.0';
const PROMPT = `${colors.cyan}isl>${colors.reset} `;
const CONTINUATION_PROMPT = `${colors.cyan}...>${colors.reset} `;

export interface REPLOptions {
  colors?: boolean;
  verbose?: boolean;
  historyFile?: string;
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

    // Load history
    this.history.load();

    // Create readline interface
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

    // Handle close
    this.rl.on('close', () => {
      this.exit();
    });

    // Handle SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      if (this.buffer.length > 0) {
        // Cancel multi-line input
        this.buffer = [];
        this.braceCount = 0;
        console.log('\n' + formatWarning('Input cancelled'));
        this.rl!.setPrompt(PROMPT);
        this.rl!.prompt();
      } else {
        console.log('\n' + formatWarning('Use .exit or :quit to exit'));
        this.rl!.prompt();
      }
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
    console.log(banner);
  }

  /**
   * Handle a line of input
   */
  private handleLine(line: string): void {
    const trimmed = line.trim();

    // Handle empty line
    if (!trimmed && this.buffer.length === 0) {
      return;
    }

    // Handle meta commands (. prefix) - only at start, not in multi-line
    if (trimmed.startsWith('.') && this.buffer.length === 0) {
      this.handleMetaCommand(trimmed);
      return;
    }

    // Handle ISL commands (: prefix) - only at start, not in multi-line
    if (trimmed.startsWith(':') && this.buffer.length === 0) {
      this.handleISLCommand(trimmed);
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
   * Handle a meta command (. prefix)
   */
  private handleMetaCommand(input: string): void {
    const parts = input.slice(1).split(/\s+/);
    const cmdName = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    // Find the command
    const command = metaCommands.find(
      c => c.name === cmdName || c.aliases.includes(cmdName)
    );

    if (command) {
      this.history.add(input);
      const result = command.handler(args, this.session, this);
      if (result.output) {
        console.log(result.output);
      }
      if (result.exit) {
        this.exit();
      }
    } else {
      // Try to suggest similar command
      const suggestion = findSimilarCommand(cmdName, 'meta');
      if (suggestion) {
        console.log(formatError(`Unknown command: .${cmdName}`));
        console.log(formatWarning(`Did you mean: .${suggestion}?`));
      } else {
        console.log(formatError(`Unknown command: .${cmdName}`));
        console.log(`Type ${colors.cyan}.help${colors.reset} for available commands`);
      }
    }
  }

  /**
   * Handle an ISL command (: prefix)
   */
  private handleISLCommand(input: string): void {
    const parts = input.slice(1).split(/\s+/);
    const cmdName = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    // Find the command
    const command = islCommands.find(
      c => c.name === cmdName || c.aliases.includes(cmdName)
    );

    if (command) {
      this.history.add(input);
      const result = command.handler(args, this.session, this);
      if (result.output) {
        console.log(result.output);
      }
    } else {
      // Try to suggest similar command
      const suggestion = findSimilarCommand(cmdName, 'isl');
      if (suggestion) {
        console.log(formatError(`Unknown command: :${cmdName}`));
        console.log(formatWarning(`Did you mean: :${suggestion}?`));
      } else {
        console.log(formatError(`Unknown command: :${cmdName}`));
        console.log(`Type ${colors.cyan}.help${colors.reset} for available commands`);
      }
    }
  }

  /**
   * Evaluate ISL code
   */
  private evaluate(code: string): void {
    try {
      const trimmed = code.trim();

      // Check if it's an intent definition
      if (trimmed.startsWith('intent ')) {
        this.evaluateIntent(trimmed);
        return;
      }

      // Check if it's a behavior definition (treat as intent)
      if (trimmed.startsWith('behavior ')) {
        this.evaluateIntent(trimmed);
        return;
      }

      // Otherwise, it's an expression or other ISL construct
      console.log(formatWarning(`Cannot evaluate: ${trimmed.split('\n')[0]}...`));
      console.log(`Use ${colors.cyan}intent Name { ... }${colors.reset} to define an intent`);
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
      console.log(formatSuccess(`Intent '${intent.name}' defined${summary}`));
    } else {
      // Try parsing as behavior
      const behaviorMatch = code.match(/^behavior\s+(\w+)\s*\{([\s\S]*)\}$/);
      if (behaviorMatch) {
        const name = behaviorMatch[1]!;
        const body = behaviorMatch[2]!;
        
        const intent: Intent = {
          name,
          preconditions: [],
          postconditions: [],
          invariants: [],
          scenarios: [],
          rawSource: code,
        };

        // Parse pre/post sections
        const preSection = body.match(/pre(?:conditions)?\s*\{([^}]*)\}/s);
        if (preSection) {
          const conditions = preSection[1]!.trim().split('\n').map(l => l.trim()).filter(Boolean);
          for (const cond of conditions) {
            const expr = cond.replace(/^-\s*/, '').trim();
            if (expr) {
              intent.preconditions.push({ expression: expr });
            }
          }
        }

        const postSection = body.match(/post(?:conditions)?\s*\{([^}]*)\}/s);
        if (postSection) {
          const conditions = postSection[1]!.trim().split('\n').map(l => l.trim()).filter(Boolean);
          for (const cond of conditions) {
            const expr = cond.replace(/^-\s*/, '').trim();
            if (expr) {
              intent.postconditions.push({ expression: expr });
            }
          }
        }

        this.session.defineIntent(intent);
        
        const preCount = intent.preconditions.length;
        const postCount = intent.postconditions.length;
        
        const parts: string[] = [];
        if (preCount > 0) parts.push(`${preCount} pre`);
        if (postCount > 0) parts.push(`${postCount} post`);
        
        const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        console.log(formatSuccess(`Intent '${intent.name}' defined${summary}`));
      } else {
        this.printParseError(code, 'Failed to parse intent definition');
      }
    }
  }

  /**
   * Print a parse error with location info
   */
  private printParseError(code: string, message: string, line?: number, column?: number): void {
    console.log(formatError(message));
    
    if (line !== undefined && column !== undefined) {
      const lines = code.split('\n');
      const errorLine = lines[line - 1] || '';
      console.log(`  ${colors.gray}${line} |${colors.reset} ${errorLine}`);
      console.log(`  ${colors.gray}${' '.repeat(String(line).length)} |${colors.reset} ${' '.repeat(column - 1)}${colors.red}^${colors.reset}`);
    } else {
      // Show first line of code
      const firstLine = code.split('\n')[0];
      if (firstLine) {
        console.log(`  ${colors.gray}>${colors.reset} ${firstLine}`);
      }
    }
  }

  /**
   * Print an error
   */
  private printError(error: unknown): void {
    if (error instanceof Error) {
      console.log(formatError(error.message));
      if (this.options.verbose && error.stack) {
        console.log(colors.gray + error.stack + colors.reset);
      }
    } else {
      console.log(formatError(String(error)));
    }
  }

  /**
   * Exit the REPL
   */
  exit(): void {
    this.running = false;
    this.history.save();
    console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
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

    if (trimmed.startsWith('.')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmdName = parts[0]?.toLowerCase() || '';
      const args = parts.slice(1);

      const command = metaCommands.find(
        c => c.name === cmdName || c.aliases.includes(cmdName)
      );

      if (command) {
        const result = command.handler(args, this.session, this);
        return { success: true, output: result.output };
      }
      return { success: false, error: `Unknown command: .${cmdName}` };
    }

    if (trimmed.startsWith(':')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmdName = parts[0]?.toLowerCase() || '';
      const args = parts.slice(1);

      const command = islCommands.find(
        c => c.name === cmdName || c.aliases.includes(cmdName)
      );

      if (command) {
        const result = command.handler(args, this.session, this);
        return { success: true, output: result.output };
      }
      return { success: false, error: `Unknown command: :${cmdName}` };
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

/**
 * Start the REPL
 */
export function startREPL(options?: REPLOptions): ISLREPL {
  const repl = new ISLREPL(options);
  repl.start();
  return repl;
}
