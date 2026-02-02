/**
 * REPL Command
 * 
 * Start an interactive Read-Eval-Print-Loop for ISL.
 * Usage: isl repl
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import { parse as parseISL } from '@isl-lang/parser';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplOptions {
  /** Verbose output */
  verbose?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPL State
// ─────────────────────────────────────────────────────────────────────────────

interface ReplState {
  history: string[];
  multilineBuffer: string[];
  inMultiline: boolean;
}

const state: ReplState = {
  history: [],
  multilineBuffer: [],
  inMultiline: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Help Text
// ─────────────────────────────────────────────────────────────────────────────

const HELP_TEXT = `
${chalk.bold('ISL REPL Commands:')}

  ${chalk.cyan('.help')}     Show this help message
  ${chalk.cyan('.clear')}    Clear the screen
  ${chalk.cyan('.history')} Show command history
  ${chalk.cyan('.exit')}     Exit the REPL (or press Ctrl+D)
  ${chalk.cyan('.multi')}    Enter multiline mode (end with .end)
  ${chalk.cyan('.end')}      End multiline input and evaluate

${chalk.bold('Examples:')}

  ${chalk.gray('# Define an entity')}
  entity User { id: ID, name: String }

  ${chalk.gray('# Define a behavior')}
  behavior CreateUser { input { name: String } output User }

  ${chalk.gray('# Multiline input')}
  .multi
  domain MyDomain {
    entity User { id: ID }
  }
  .end
`;

// ─────────────────────────────────────────────────────────────────────────────
// REPL Commands
// ─────────────────────────────────────────────────────────────────────────────

function handleCommand(cmd: string): boolean {
  switch (cmd.toLowerCase()) {
    case '.help':
      console.log(HELP_TEXT);
      return true;
      
    case '.clear':
      console.clear();
      printBanner();
      return true;
      
    case '.history':
      console.log('');
      if (state.history.length === 0) {
        console.log(chalk.gray('  No history'));
      } else {
        state.history.forEach((item, i) => {
          console.log(chalk.gray(`  ${i + 1}. `) + item.substring(0, 60) + (item.length > 60 ? '...' : ''));
        });
      }
      console.log('');
      return true;
      
    case '.exit':
    case '.quit':
      console.log(chalk.gray('\nGoodbye!'));
      process.exit(ExitCode.SUCCESS);
      
    case '.multi':
      state.inMultiline = true;
      state.multilineBuffer = [];
      console.log(chalk.gray('Entering multiline mode. Type .end to evaluate.'));
      return true;
      
    case '.end':
      if (state.inMultiline) {
        const code = state.multilineBuffer.join('\n');
        state.inMultiline = false;
        state.multilineBuffer = [];
        evaluateInput(code);
        return true;
      }
      return false;
      
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

function evaluateInput(input: string): void {
  if (!input.trim()) return;
  
  // Add to history
  state.history.push(input);
  
  // Wrap in domain if needed
  let code = input.trim();
  const needsWrapper = !code.startsWith('domain ');
  
  if (needsWrapper) {
    code = `domain REPL { ${code} }`;
  }
  
  try {
    const { domain: ast, errors } = parseISL(code, '<repl>');
    
    if (errors.length > 0) {
      console.log('');
      for (const error of errors) {
        console.log(chalk.red(`Error: ${error.message}`));
        if ('line' in error && error.line) {
          console.log(chalk.gray(`  at line ${error.line}, column ${error.column ?? 0}`));
        }
      }
      console.log('');
      return;
    }
    
    if (!ast) {
      console.log(chalk.yellow('No output'));
      return;
    }
    
    // Print result
    console.log('');
    printResult(ast, needsWrapper);
    console.log('');
  } catch (err) {
    console.log('');
    console.log(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    console.log('');
  }
}

function printResult(ast: unknown, unwrap: boolean): void {
  const domain = ast as { entities: unknown[]; behaviors: unknown[]; invariants?: unknown[] };
  
  // If wrapped, show contents directly
  if (unwrap) {
    if (domain.entities?.length > 0) {
      console.log(chalk.green('✓ ') + chalk.bold('Entities:'));
      for (const entity of domain.entities as Array<{ name: { name: string }; fields?: Array<{ name: { name: string }; type?: { name: string } }> }>) {
        console.log(`  ${chalk.cyan(entity.name.name)}`);
        if (entity.fields) {
          for (const field of entity.fields) {
            console.log(`    ${field.name.name}: ${chalk.yellow(field.type?.name ?? 'unknown')}`);
          }
        }
      }
    }
    
    if (domain.behaviors?.length > 0) {
      console.log(chalk.green('✓ ') + chalk.bold('Behaviors:'));
      for (const behavior of domain.behaviors as Array<{ name: { name: string }; inputs?: Array<{ name: { name: string }; type?: { name: string } }>; output?: { name: string } }>) {
        const inputs = behavior.inputs?.map(i => `${i.name.name}: ${i.type?.name ?? '?'}`).join(', ') ?? '';
        const out = behavior.output?.name ?? 'void';
        console.log(`  ${chalk.blue(behavior.name.name)}(${inputs}) -> ${chalk.yellow(out)}`);
      }
    }
  } else {
    // Full domain output
    console.log(chalk.green('✓ ') + `Parsed domain with:`);
    console.log(`  ${domain.entities?.length ?? 0} entities`);
    console.log(`  ${domain.behaviors?.length ?? 0} behaviors`);
    console.log(`  ${domain.invariants?.length ?? 0} invariants`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log('');
  console.log(chalk.bold.cyan('  ISL REPL') + chalk.gray(' - Intent Specification Language'));
  console.log(chalk.gray('  Type .help for commands, .exit to quit'));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main REPL Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the REPL
 */
export async function repl(options: ReplOptions = {}): Promise<void> {
  printBanner();
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: state.inMultiline ? chalk.gray('... ') : chalk.cyan('isl> '),
    historySize: 100,
  });
  
  const updatePrompt = () => {
    rl.setPrompt(state.inMultiline ? chalk.gray('... ') : chalk.cyan('isl> '));
  };
  
  rl.prompt();
  
  rl.on('line', (line) => {
    const trimmed = line.trim();
    
    // Handle commands
    if (trimmed.startsWith('.')) {
      const handled = handleCommand(trimmed);
      if (!handled && !state.inMultiline) {
        console.log(chalk.yellow(`Unknown command: ${trimmed}. Type .help for commands.`));
      } else if (!handled && state.inMultiline) {
        state.multilineBuffer.push(line);
      }
      updatePrompt();
      rl.prompt();
      return;
    }
    
    // Multiline mode
    if (state.inMultiline) {
      state.multilineBuffer.push(line);
      updatePrompt();
      rl.prompt();
      return;
    }
    
    // Regular evaluation
    if (trimmed) {
      evaluateInput(trimmed);
    }
    
    updatePrompt();
    rl.prompt();
  });
  
  rl.on('close', () => {
    console.log(chalk.gray('\nGoodbye!'));
    process.exit(ExitCode.SUCCESS);
  });
  
  // Handle SIGINT (Ctrl+C)
  rl.on('SIGINT', () => {
    if (state.inMultiline) {
      state.inMultiline = false;
      state.multilineBuffer = [];
      console.log(chalk.gray('\nMultiline input cancelled'));
      updatePrompt();
      rl.prompt();
    } else {
      rl.question(chalk.gray('Press Ctrl+C again to exit, or Enter to continue: '), () => {
        rl.prompt();
      });
    }
  });
}

export default repl;
