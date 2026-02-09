/**
 * REPL Command
 *
 * Start an interactive Read-Eval-Print-Loop for ISL.
 * Usage: isl repl [options]
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
  /** Load an ISL file on startup */
  load?: string;
  /** Set initial evaluation context (JSON string) */
  context?: string;
  /** Parse-only mode (piped input) */
  parse?: boolean;
  /** Non-interactive mode: execute commands and exit */
  eval?: string;
  /** Command timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Allow filesystem writes (default: false) */
  allowWrites?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPL State
// ─────────────────────────────────────────────────────────────────────────────

interface ReplState {
  history: string[];
  multilineBuffer: string[];
  braceCount: number;
  evalContext: Record<string, unknown>;
  preContext: Record<string, unknown> | null;
  loadedDomain: {
    ast: unknown;
    path: string;
    entities: unknown[];
    behaviors: unknown[];
    types: unknown[];
  } | null;
  allowWrites: boolean;
  timeout: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Help Text
// ─────────────────────────────────────────────────────────────────────────────

const HELP_TEXT = `
${chalk.bold('ISL REPL Commands:')}

  ${chalk.cyan(':load <file>')}  Load an ISL domain file
  ${chalk.cyan(':ast')}           Show AST of loaded domain
  ${chalk.cyan(':types')}         Show type information
  ${chalk.cyan(':verify')}        Verify domain (subset)
  ${chalk.cyan(':gen <target>')} Generate code (ts, rust, go, openapi)
  ${chalk.cyan(':truthpack')}    Show truthpack info (if available)
  
  ${chalk.cyan('.help')}          Show this help message
  ${chalk.cyan('.parse <isl>')}   Parse ISL and show AST
  ${chalk.cyan('.eval <expr>')}   Evaluate expression against context
  ${chalk.cyan('.check')}         Type check intents
  ${chalk.cyan('.load <file>')}   Load an .isl file
  ${chalk.cyan('.context')}       Set evaluation context (JSON)
  ${chalk.cyan('.clear')}         Clear the screen
  ${chalk.cyan('.history')}       Show command history
  ${chalk.cyan('.exit')}          Exit the REPL (or press Ctrl+D)
  
${chalk.bold('Note:')} Colon commands (:load, :ast, etc.) are aliases for dot commands

${chalk.bold('Multi-line Input:')}

  Type ISL with braces — auto-detects multi-line:
  ${chalk.gray('isl>')} domain Example {
  ${chalk.gray('...>')}   entity User {
  ${chalk.gray('...>')}     id: UUID
  ${chalk.gray('...>')}   }
  ${chalk.gray('...>')} }

${chalk.bold('Expression Evaluation:')}

  ${chalk.gray('isl>')} .context { "user": { "email": "test@x.com", "age": 25 } }
  ${chalk.gray('isl>')} .eval user.email == "test@x.com"
  ${chalk.cyan('→')} true
`;

// ─────────────────────────────────────────────────────────────────────────────
// REPL Commands
// ─────────────────────────────────────────────────────────────────────────────

function handleCommand(cmd: string, state: ReplState): Promise<boolean> | boolean {
  const parts = cmd.slice(1).split(/\s+/);
  const name = (parts[0] ?? '').toLowerCase();
  const rawArgs = cmd.slice(1 + name.length).trim();

  switch (name) {
    case 'help':
    case 'h':
    case '?':
      process.stdout.write(HELP_TEXT);
      return true;

    case 'clear':
    case 'cls':
      console.clear();
      printBanner();
      return true;

    case 'history':
    case 'hist':
      process.stdout.write('\n');
      if (state.history.length === 0) {
        process.stdout.write(chalk.gray('  No history\n'));
      } else {
        const count = Math.min(state.history.length, 20);
        const recent = state.history.slice(-count);
        recent.forEach((item, i) => {
          process.stdout.write(
            chalk.gray(`  ${i + 1}. `) +
            item.substring(0, 60) +
            (item.length > 60 ? '...' : '') +
            '\n'
          );
        });
      }
      process.stdout.write('\n');
      return true;

    case 'exit':
    case 'quit':
    case 'q':
      process.stdout.write(chalk.gray('\nGoodbye!\n'));
      process.exit(ExitCode.SUCCESS);
      return true;

    case 'parse':
    case 'p':
    case 'ast': {
      if (rawArgs) {
        evaluateInput(rawArgs, state, true);
      } else if (state.loadedDomain) {
        handleAst(state);
      } else {
        process.stdout.write(chalk.yellow('Usage: .ast or :ast (requires loaded domain)\n'));
      }
      return true;
    }

    case 'eval':
    case 'e': {
      if (!rawArgs) {
        process.stdout.write(chalk.yellow('Usage: .eval <expression>\n'));
        return true;
      }
      const result = evalExpression(rawArgs, state);
      if (result.error) {
        process.stdout.write(chalk.red(`✗ Error: ${result.error}\n`));
      } else {
        const formatted = typeof result.value === 'string'
          ? chalk.green(`"${result.value}"`)
          : typeof result.value === 'boolean'
          ? chalk.magenta(String(result.value))
          : typeof result.value === 'number'
          ? chalk.cyan(String(result.value))
          : JSON.stringify(result.value);
        process.stdout.write(`${chalk.cyan('→')} ${formatted}\n`);
      }
      return true;
    }

    case 'context':
    case 'ctx': {
      if (!rawArgs) {
        if (Object.keys(state.evalContext).length === 0) {
          process.stdout.write('No context set. Use: .context { "key": "value" }\n');
        } else {
          process.stdout.write(JSON.stringify(state.evalContext, null, 2) + '\n');
        }
        return true;
      }
      if (rawArgs.startsWith('--pre ')) {
        try {
          state.preContext = JSON.parse(rawArgs.slice(6));
          process.stdout.write(chalk.green('✓') + ' Pre-state context set\n');
        } catch (e) {
          process.stdout.write(chalk.red(`✗ Invalid JSON: ${e instanceof Error ? e.message : String(e)}\n`));
        }
        return true;
      }
      try {
        const parsed = JSON.parse(rawArgs);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          process.stdout.write(chalk.red('✗ Context must be a JSON object\n'));
          return true;
        }
        state.evalContext = parsed as Record<string, unknown>;
        const count = Object.keys(state.evalContext).length;
        process.stdout.write(
          chalk.green('✓') + ` Context set (${count} variable${count !== 1 ? 's' : ''})\n`
        );
      } catch (e) {
        process.stdout.write(chalk.red(`✗ Invalid JSON: ${e instanceof Error ? e.message : String(e)}\n`));
      }
      return true;
    }

    case 'check':
    case 'c':
    case 'verify': {
      return handleVerify(state);
    }

    case 'gen':
    case 'generate':
    case 'g': {
      const target = rawArgs.split(/\s+/)[0] || 'ts';
      return handleGen(target, state);
    }

    case 'types': {
      return handleTypes(state);
    }

    case 'truthpack': {
      return handleTruthpack(state);
    }

    case 'write': {
      state.allowWrites = true;
      process.stdout.write(chalk.green('✓ Filesystem writes enabled\n'));
      return true;
    }

    case 'load':
    case 'l': {
      if (!rawArgs) {
        process.stdout.write('Usage: .load <file.isl>\n');
        return true;
      }
      return handleLoad(rawArgs, state);
    }

    case 'list':
    case 'ls':
      process.stdout.write(chalk.gray('No intents defined.\n'));
      return true;

    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expression Evaluator
// ─────────────────────────────────────────────────────────────────────────────

function evalExpression(
  expr: string,
  state: ReplState
): { value: unknown; error?: string } {
  const trimmed = expr.trim();

  // old() function
  const oldMatch = trimmed.match(/^old\((.+)\)$/);
  if (oldMatch) {
    if (!state.preContext) {
      return { value: undefined, error: 'old() requires pre-state. Set with .context --pre <json>' };
    }
    return resolvePath(oldMatch[1]!.trim(), state.preContext);
  }

  // Comparisons
  for (const op of ['==', '!=', '>=', '<=', '>', '<']) {
    const idx = trimmed.indexOf(` ${op} `);
    if (idx !== -1) {
      const left = evalExpression(trimmed.slice(0, idx).trim(), state);
      const right = evalExpression(trimmed.slice(idx + op.length + 2).trim(), state);
      if (left.error) return left;
      if (right.error) return right;
      switch (op) {
        case '==': return { value: left.value === right.value || String(left.value) === String(right.value) };
        case '!=': return { value: left.value !== right.value };
        case '>': return { value: Number(left.value) > Number(right.value) };
        case '<': return { value: Number(left.value) < Number(right.value) };
        case '>=': return { value: Number(left.value) >= Number(right.value) };
        case '<=': return { value: Number(left.value) <= Number(right.value) };
      }
    }
  }

  // Literals
  if (trimmed === 'true') return { value: true };
  if (trimmed === 'false') return { value: false };
  if (trimmed === 'null') return { value: null };
  if (/^-?\d+$/.test(trimmed)) return { value: parseInt(trimmed, 10) };
  if (/^-?\d+\.\d+$/.test(trimmed)) return { value: parseFloat(trimmed) };
  if (/^"([^"]*)"$/.test(trimmed)) return { value: trimmed.slice(1, -1) };

  // Path resolution
  if (/^[\w.]+$/.test(trimmed)) {
    return resolvePath(trimmed, state.evalContext);
  }

  return { value: undefined, error: `Cannot evaluate: ${trimmed}` };
}

function resolvePath(
  dotPath: string,
  obj: Record<string, unknown>
): { value: unknown; error?: string } {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { value: undefined, error: `Cannot resolve '${dotPath}'` };
    }
    current = (current as Record<string, unknown>)[part];
  }
  return { value: current };
}

// ─────────────────────────────────────────────────────────────────────────────
// File Loading
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateFile(filePath: string, state: ReplState): Promise<void> {
  await handleLoad(filePath, state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

function evaluateInput(input: string, state: ReplState, showAst: boolean = false): void {
  if (!input.trim()) return;

  // Add to history
  state.history.push(input);

  // Wrap in domain if needed
  let code = input.trim();
  const needsWrapper = !code.startsWith('domain ');

  if (needsWrapper) {
    code = `domain REPL { version: "0.0.1"\n${code}\n}`;
  }

  try {
    const { domain: ast, errors } = parseISL(code, '<repl>');

    if (errors.length > 0) {
      process.stdout.write('\n');
      for (const error of errors) {
        process.stdout.write(chalk.red(`✗ Error: ${error.message}\n`));
        if ('line' in error && error.line) {
          const adjustedLine = needsWrapper ? Math.max(1, (error.line as number) - 1) : error.line;
          process.stdout.write(chalk.gray(`  at line ${adjustedLine}, column ${error.column ?? 0}\n`));
        }
      }
      process.stdout.write('\n');
      return;
    }

    if (!ast) {
      process.stdout.write(chalk.yellow('No output\n'));
      return;
    }

    // Show AST if requested (.parse command)
    if (showAst) {
      process.stdout.write('\n');
      process.stdout.write(JSON.stringify(ast, null, 2) + '\n');
      process.stdout.write('\n');
      return;
    }

    // Print result summary
    process.stdout.write('\n');
    printResult(ast, needsWrapper);
    process.stdout.write('\n');
  } catch (err) {
    process.stdout.write('\n');
    process.stdout.write(chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}\n`));
    process.stdout.write('\n');
  }
}

function printResult(ast: unknown, unwrap: boolean): void {
  const domain = ast as {
    entities: unknown[];
    behaviors: unknown[];
    invariants?: unknown[];
  };

  if (unwrap) {
    if (domain.entities?.length > 0) {
      process.stdout.write(chalk.green('✓ ') + chalk.bold('Entities:\n'));
      for (const entity of domain.entities as Array<{
        name: { name: string };
        fields?: Array<{ name: { name: string }; type?: { name: string } }>;
      }>) {
        process.stdout.write(`  ${chalk.cyan(entity.name.name)}\n`);
        if (entity.fields) {
          for (const field of entity.fields) {
            process.stdout.write(
              `    ${field.name.name}: ${chalk.yellow(field.type?.name ?? 'unknown')}\n`
            );
          }
        }
      }
    }

    if (domain.behaviors?.length > 0) {
      process.stdout.write(chalk.green('✓ ') + chalk.bold('Behaviors:\n'));
      for (const behavior of domain.behaviors as Array<{
        name: { name: string };
        inputs?: Array<{ name: { name: string }; type?: { name: string } }>;
        output?: { name: string };
      }>) {
        const inputs =
          behavior.inputs?.map(i => `${i.name.name}: ${i.type?.name ?? '?'}`).join(', ') ?? '';
        const out = behavior.output?.name ?? 'void';
        process.stdout.write(`  ${chalk.blue(behavior.name.name)}(${inputs}) -> ${chalk.yellow(out)}\n`);
      }
    }
  } else {
    process.stdout.write(chalk.green('✓ ') + `Parsed domain with:\n`);
    process.stdout.write(`  ${domain.entities?.length ?? 0} entities\n`);
    process.stdout.write(`  ${domain.behaviors?.length ?? 0} behaviors\n`);
    process.stdout.write(`  ${domain.invariants?.length ?? 0} invariants\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Wrapper
// ─────────────────────────────────────────────────────────────────────────────

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Command timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleLoad(filePath: string, state: ReplState): Promise<boolean> {
  try {
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      process.stdout.write(chalk.red(`✗ File not found: ${resolvedPath}\n`));
      return true;
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const { domain: ast, errors } = parseISL(content, resolvedPath);

    if (errors.length > 0) {
      process.stdout.write(chalk.red('✗ Parse errors:\n'));
      for (const error of errors) {
        process.stdout.write(`  ${error.message}\n`);
      }
      return true;
    }

    if (!ast) {
      process.stdout.write(chalk.yellow('⚠ No domain found in file\n'));
      return true;
    }

    const domain = ast as {
      name?: { name?: string };
      entities?: unknown[];
      behaviors?: unknown[];
      types?: unknown[];
    };

    state.loadedDomain = {
      ast,
      path: resolvedPath,
      entities: domain.entities || [],
      behaviors: domain.behaviors || [],
      types: domain.types || [],
    };

    const name = domain.name?.name ?? 'Unknown';
    const entityCount = state.loadedDomain.entities.length;
    const behaviorCount = state.loadedDomain.behaviors.length;
    const typeCount = state.loadedDomain.types.length;

    process.stdout.write(
      chalk.green('✓') +
        ` Loaded: ${name} (${entityCount} entities, ${behaviorCount} behaviors, ${typeCount} types)\n`
    );
    return true;
  } catch (err) {
    process.stdout.write(
      chalk.red(`✗ Failed to load: ${err instanceof Error ? err.message : String(err)}\n`)
    );
    return true;
  }
}

function handleAst(state: ReplState): boolean {
  if (!state.loadedDomain) {
    process.stdout.write(chalk.yellow('⚠ No domain loaded. Use :load <file.isl> first.\n'));
    return true;
  }

  process.stdout.write('\n');
  process.stdout.write(JSON.stringify(state.loadedDomain.ast, null, 2) + '\n');
  process.stdout.write('\n');
  return true;
}

function handleTypes(state: ReplState): boolean {
  if (!state.loadedDomain) {
    process.stdout.write(chalk.yellow('⚠ No domain loaded. Use :load <file.isl> first.\n'));
    return true;
  }

  process.stdout.write('\n');
  process.stdout.write(chalk.bold('Types:\n'));

  // Show entity types
  if (state.loadedDomain.entities.length > 0) {
    process.stdout.write(chalk.cyan('\nEntities:\n'));
    for (const entity of state.loadedDomain.entities as Array<{
      name?: { name?: string };
      fields?: Array<{ name?: { name?: string }; type?: { name?: string } }>;
    }>) {
      const name = entity.name?.name ?? 'Unknown';
      process.stdout.write(`  ${chalk.yellow(name)}`);
      if (entity.fields && entity.fields.length > 0) {
        const fields = entity.fields
          .map(f => `${f.name?.name ?? '?'}: ${f.type?.name ?? '?'}`)
          .join(', ');
        process.stdout.write(` { ${fields} }`);
      }
      process.stdout.write('\n');
    }
  }

  // Show custom types
  if (state.loadedDomain.types.length > 0) {
    process.stdout.write(chalk.cyan('\nCustom Types:\n'));
    for (const type of state.loadedDomain.types as Array<{ name?: { name?: string } }>) {
      const name = type.name?.name ?? 'Unknown';
      process.stdout.write(`  ${chalk.yellow(name)}\n`);
    }
  }

  // Show behavior signatures
  if (state.loadedDomain.behaviors.length > 0) {
    process.stdout.write(chalk.cyan('\nBehaviors:\n'));
    for (const behavior of state.loadedDomain.behaviors as Array<{
      name?: { name?: string };
      inputs?: Array<{ name?: { name?: string }; type?: { name?: string } }>;
      output?: { name?: string };
    }>) {
      const name = behavior.name?.name ?? 'Unknown';
      const inputs =
        behavior.inputs?.map(i => `${i.name?.name ?? '?'}: ${i.type?.name ?? '?'}`).join(', ') ||
        '';
      const output = behavior.output?.name ?? 'void';
      process.stdout.write(`  ${chalk.blue(name)}(${inputs}) -> ${chalk.yellow(output)}\n`);
    }
  }

  process.stdout.write('\n');
  return true;
}

async function handleVerify(state: ReplState): Promise<boolean> {
  if (!state.loadedDomain) {
    process.stdout.write(chalk.yellow('⚠ No domain loaded. Use :load <file.isl> first.\n'));
    return true;
  }

  try {
    // Try to import typechecker with timeout
    let check: (domain: unknown) => { success: boolean; errors: unknown[]; warnings: unknown[] };
    try {
      const typecheckerPromise = import('@isl-lang/typechecker');
      const typechecker = await withTimeout(
        typecheckerPromise,
        state.timeout,
        'Typechecker import timed out'
      );
      check = typechecker.check;
    } catch {
      process.stdout.write(chalk.yellow('⚠ Typechecker not available. Install @isl-lang/typechecker\n'));
      return true;
    }

    const result = await withTimeout(
      Promise.resolve(check(state.loadedDomain.ast)),
      state.timeout,
      'Verification timed out'
    );

    if (result.success && result.errors.length === 0) {
      process.stdout.write(chalk.green('✓ Type check passed\n'));
      if (result.warnings.length > 0) {
        process.stdout.write(chalk.yellow(`⚠ ${result.warnings.length} warning(s)\n`));
      }
    } else {
      process.stdout.write(chalk.red(`✗ ${result.errors.length} error(s) found:\n`));
      for (const error of result.errors as Array<{ message?: string }>) {
        process.stdout.write(`  ${error.message ?? 'Unknown error'}\n`);
      }
    }
    return true;
  } catch (err) {
    process.stdout.write(
      chalk.red(`✗ Verification failed: ${err instanceof Error ? err.message : String(err)}\n`)
    );
    return true;
  }
}

async function handleGen(target: string, state: ReplState): Promise<boolean> {
  if (!state.loadedDomain) {
    process.stdout.write(chalk.yellow('⚠ No domain loaded. Use :load <file.isl> first.\n'));
    return true;
  }

  if (!state.allowWrites) {
    process.stdout.write(
      chalk.yellow('⚠ Filesystem writes disabled. Use --allow-writes flag or :write command.\n')
    );
    process.stdout.write(chalk.gray('Generated code preview:\n\n'));
  }

  try {
    // Import codegen with timeout
    const genModulePromise = import('../gen.js');
    const genModule = await withTimeout(
      genModulePromise,
      state.timeout,
      'Codegen import timed out'
    );
    const { gen } = genModule;
    const genPromise = gen(target, state.loadedDomain.path, {
      output: state.allowWrites ? './generated' : undefined,
      force: false,
      verbose: false,
    });
    const result = await withTimeout(
      genPromise,
      state.timeout,
      'Code generation timed out'
    );

    if (result.success) {
      if (state.allowWrites && result.files.length > 0) {
        process.stdout.write(chalk.green(`✓ Generated ${result.files.length} file(s)\n`));
        for (const file of result.files) {
          process.stdout.write(`  ${file.path}\n`);
        }
      } else {
        // Show preview
        for (const file of result.files) {
          process.stdout.write(chalk.gray(`\n// ${file.path}\n`));
          process.stdout.write(file.content.substring(0, 500));
          if (file.content.length > 500) {
            process.stdout.write(chalk.gray('\n... (truncated)\n'));
          }
        }
      }
    } else {
      process.stdout.write(chalk.red(`✗ Generation failed:\n`));
      for (const error of result.errors) {
        process.stdout.write(`  ${error}\n`);
      }
    }
    return true;
  } catch (err) {
    process.stdout.write(
      chalk.red(`✗ Generation failed: ${err instanceof Error ? err.message : String(err)}\n`)
    );
    return true;
  }
}

async function handleTruthpack(state: ReplState): Promise<boolean> {
  try {
    const fs = require('fs');
    const path = require('path');
    const truthpackPath = path.join(process.cwd(), '.shipgate', 'truthpack', 'truthpack.json');

    if (!fs.existsSync(truthpackPath)) {
      process.stdout.write(
        chalk.yellow('⚠ Truthpack not found. Run: shipgate truthpack build\n')
      );
      return true;
    }

    const truthpack = JSON.parse(fs.readFileSync(truthpackPath, 'utf-8'));

    process.stdout.write('\n');
    process.stdout.write(chalk.bold('Truthpack Info:\n'));
    process.stdout.write(`  Routes: ${truthpack.routes?.length ?? 0}\n`);
    process.stdout.write(`  Env Vars: ${truthpack.envVars?.length ?? 0}\n`);
    process.stdout.write(`  Dependencies: ${truthpack.dependencies?.length ?? 0}\n`);
    if (truthpack.provenance) {
      process.stdout.write(`  Commit: ${truthpack.provenance.commitHash?.substring(0, 8) ?? 'N/A'}\n`);
    }
    process.stdout.write('\n');
    return true;
  } catch (err) {
    process.stdout.write(
      chalk.red(`✗ Failed to load truthpack: ${err instanceof Error ? err.message : String(err)}\n`)
    );
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────

function printBanner(): void {
  process.stdout.write('\n');
  process.stdout.write(chalk.bold.cyan('  ISL REPL') + chalk.gray(' — Intent Specification Language\n'));
  process.stdout.write(chalk.gray('  Type .help for commands, .exit to quit\n'));
  process.stdout.write('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main REPL Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the REPL
 */
export async function repl(options: ReplOptions = {}): Promise<void> {
  const state: ReplState = {
    history: [],
    multilineBuffer: [],
    braceCount: 0,
    evalContext: {},
    preContext: null,
    loadedDomain: null,
    allowWrites: options.allowWrites ?? false,
    timeout: options.timeout ?? 30000,
  };

  // Handle non-interactive mode with --eval
  if (options.eval) {
    await handleNonInteractiveMode(options.eval, state);
    return;
  }

  // Apply --context option
  if (options.context) {
    try {
      const parsed = JSON.parse(options.context);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        state.evalContext = parsed as Record<string, unknown>;
        const count = Object.keys(state.evalContext).length;
        process.stdout.write(
          chalk.green('✓') + ` Context set (${count} variable${count !== 1 ? 's' : ''})\n`
        );
      }
    } catch (e) {
      process.stderr.write(chalk.red(`Invalid context JSON: ${e instanceof Error ? e.message : String(e)}\n`));
    }
  }

  // Handle piped input (non-interactive)
  if (!process.stdin.isTTY || options.parse) {
    let input = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { input += chunk; });
    process.stdin.on('end', () => {
      if (input.trim()) {
        evaluateInput(input.trim(), state, !!options.parse);
      }
      process.exit(ExitCode.SUCCESS);
    });
    return;
  }

  printBanner();

  // Apply --load option
  if (options.load) {
    await evaluateFile(options.load, state);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: state.braceCount > 0 ? chalk.gray('... ') : chalk.cyan('isl> '),
    historySize: 100,
  });

  const updatePrompt = () => {
    rl.setPrompt(state.braceCount > 0 ? chalk.gray('... ') : chalk.cyan('isl> '));
  };

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();

    // Handle dot commands (. prefix)
    if (trimmed.startsWith('.') && state.braceCount === 0 && state.multilineBuffer.length === 0) {
      const result = handleCommand(trimmed, state);
      const handled = result instanceof Promise ? await result : result;
      if (!handled) {
        process.stdout.write(chalk.yellow(`Unknown command: ${trimmed}. Type .help for commands.\n`));
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // Handle colon commands (: prefix) as aliases
    if (trimmed.startsWith(':') && state.braceCount === 0 && state.multilineBuffer.length === 0) {
      const result = handleCommand('.' + trimmed.slice(1), state);
      const handled = result instanceof Promise ? await result : result;
      if (!handled) {
        process.stdout.write(chalk.yellow(`Unknown command: ${trimmed}. Type .help for commands.\n`));
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // Multi-line tracking
    state.braceCount += (line.match(/\{/g) || []).length;
    state.braceCount -= (line.match(/\}/g) || []).length;
    state.multilineBuffer.push(line);

    if (state.braceCount <= 0) {
      const code = state.multilineBuffer.join('\n');
      state.multilineBuffer = [];
      state.braceCount = 0;

      if (code.trim()) {
        evaluateInput(code.trim(), state);
      }
    }

    updatePrompt();
    rl.prompt();
  });

  rl.on('close', () => {
    process.stdout.write(chalk.gray('\nGoodbye!\n'));
    process.exit(ExitCode.SUCCESS);
  });

  // Handle SIGINT (Ctrl+C)
  rl.on('SIGINT', () => {
    if (state.braceCount > 0 || state.multilineBuffer.length > 0) {
      state.braceCount = 0;
      state.multilineBuffer = [];
      process.stdout.write(chalk.gray('\nInput cancelled\n'));
      updatePrompt();
      rl.prompt();
    } else {
      process.stdout.write(chalk.gray('\nUse .exit to quit\n'));
      rl.prompt();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-Interactive Mode Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleNonInteractiveMode(evalString: string, state: ReplState): Promise<void> {
  const commands = evalString.split(';').map(c => c.trim()).filter(Boolean);
  
  for (const cmd of commands) {
    const trimmed = cmd.trim();
    
    // Handle colon/dot commands
    if (trimmed.startsWith(':') || trimmed.startsWith('.')) {
      const normalized = trimmed.startsWith(':') ? '.' + trimmed.slice(1) : trimmed;
      const result = handleCommand(normalized, state);
      const handled = result instanceof Promise ? await result : result;
      if (!handled) {
        process.stderr.write(`Unknown command: ${trimmed}\n`);
        process.exit(ExitCode.USAGE_ERROR);
      }
    } else {
      // Treat as ISL code to parse
      evaluateInput(trimmed, state, false);
    }
  }
  
  process.exit(ExitCode.SUCCESS);
}

export default repl;
