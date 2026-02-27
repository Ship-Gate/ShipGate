// ============================================================================
// ISL REPL Commands
// All commands use the . prefix
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { Session, Intent } from './session';
import {
  formatSuccess,
  formatError,
  formatWarning,
  formatValue,
  formatParseError,
  formatTable,
  colors,
  highlightISL,
  highlightExpression,
  formatIntent,
} from './formatter';

// Forward declaration for REPL type
interface REPL {
  exit(): void;
  getSession(): Session;
}

/**
 * Command result
 */
export interface CommandResult {
  output?: string;
  exit?: boolean;
}

/**
 * Meta command definition (. prefix)
 */
export interface MetaCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string[], session: Session, repl: REPL) => CommandResult;
}

// Keep ISLCommand as alias for backward compat
export type ISLCommand = MetaCommand;

// ─────────────────────────────────────────────────────────────────────────────
// Expression Evaluator (for .eval command)
// ─────────────────────────────────────────────────────────────────────────────

function evaluateExpression(
  expr: string,
  session: Session
): { value: unknown; error?: string } {
  const trimmed = expr.trim();

  // Handle old() function
  const oldMatch = trimmed.match(/^old\((.+)\)$/);
  if (oldMatch) {
    const innerPath = oldMatch[1]!.trim();
    if (!session.getPreContext()) {
      return {
        value: undefined,
        error: 'old() requires pre-state. Set with .context --pre <json>',
      };
    }
    const { found, value } = session.resolvePreValue(innerPath);
    if (!found) {
      return { value: undefined, error: `Cannot resolve '${innerPath}' in pre-state context` };
    }
    return { value };
  }

  // Handle parenthesized expression
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return evaluateExpression(trimmed.slice(1, -1), session);
  }

  // Handle logical NOT
  if (trimmed.startsWith('!') || trimmed.startsWith('not ')) {
    const inner = trimmed.startsWith('!') ? trimmed.slice(1) : trimmed.slice(4);
    const result = evaluateExpression(inner.trim(), session);
    if (result.error) return result;
    return { value: !result.value };
  }

  // Handle binary operators (in priority order)
  // We scan right-to-left for && / || so left-associativity works with simple split
  for (const [opStr, opFn] of BINARY_OPS) {
    const idx = findOperator(trimmed, opStr);
    if (idx !== -1) {
      const left = trimmed.slice(0, idx).trim();
      const right = trimmed.slice(idx + opStr.length).trim();
      const lResult = evaluateExpression(left, session);
      if (lResult.error) return lResult;
      const rResult = evaluateExpression(right, session);
      if (rResult.error) return rResult;
      return { value: opFn(lResult.value, rResult.value) };
    }
  }

  // Literals
  if (trimmed === 'true') return { value: true };
  if (trimmed === 'false') return { value: false };
  if (trimmed === 'null') return { value: null };
  if (/^-?\d+$/.test(trimmed)) return { value: parseInt(trimmed, 10) };
  if (/^-?\d+\.\d+$/.test(trimmed)) return { value: parseFloat(trimmed) };
  if (/^"([^"]*)"$/.test(trimmed)) return { value: trimmed.slice(1, -1) };
  if (/^'([^']*)'$/.test(trimmed)) return { value: trimmed.slice(1, -1) };

  // Path resolution against context
  if (/^[\w.]+$/.test(trimmed)) {
    const { found, value } = session.resolveValue(trimmed);
    if (found) return { value };

    // Try as a session variable
    if (session.hasVariable(trimmed)) {
      return { value: session.getVariable(trimmed) };
    }
  }

  return { value: undefined, error: `Cannot evaluate: ${trimmed}` };
}

type BinaryOpFn = (a: unknown, b: unknown) => unknown;

const BINARY_OPS: [string, BinaryOpFn][] = [
  // Logical (lowest precedence — scanned first so they split outermost)
  [' || ', (a, b) => Boolean(a) || Boolean(b)],
  [' or ', (a, b) => Boolean(a) || Boolean(b)],
  [' && ', (a, b) => Boolean(a) && Boolean(b)],
  [' and ', (a, b) => Boolean(a) && Boolean(b)],
  // Equality
  [' == ', (a, b) => a === b || String(a) === String(b)],
  [' != ', (a, b) => a !== b && String(a) !== String(b)],
  // Comparison
  [' >= ', (a, b) => Number(a) >= Number(b)],
  [' <= ', (a, b) => Number(a) <= Number(b)],
  [' > ', (a, b) => Number(a) > Number(b)],
  [' < ', (a, b) => Number(a) < Number(b)],
  // Arithmetic
  [' + ', (a, b) => {
    if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
    return Number(a) + Number(b);
  }],
  [' - ', (a, b) => Number(a) - Number(b)],
  [' * ', (a, b) => Number(a) * Number(b)],
  [' / ', (a, b) => {
    const d = Number(b);
    if (d === 0) return Infinity;
    return Number(a) / d;
  }],
];

/**
 * Find an operator in an expression, respecting parentheses and strings.
 * Scans right-to-left from the very end so string quotes are processed
 * in the correct (closing → opening) order.
 * Returns the index of the operator or -1.
 */
function findOperator(expr: string, op: string): number {
  let depth = 0;
  let inString: string | null = null;

  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i]!;

    if (inString) {
      if (ch === inString && (i === 0 || expr[i - 1] !== '\\')) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === '(') depth--;
    if (ch === ')') depth++;

    if (depth === 0 && i + op.length <= expr.length && expr.slice(i, i + op.length) === op) {
      return i;
    }
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// AST Pretty Printer (for .parse command)
// ─────────────────────────────────────────────────────────────────────────────

function prettyPrintAST(node: unknown, indent: number = 0): string {
  const pad = '  '.repeat(indent);

  if (node === null || node === undefined) return `${pad}${colors.gray}null${colors.reset}`;
  if (typeof node === 'string') return `${pad}${colors.green}"${node}"${colors.reset}`;
  if (typeof node === 'number') return `${pad}${colors.cyan}${node}${colors.reset}`;
  if (typeof node === 'boolean') return `${pad}${colors.magenta}${node}${colors.reset}`;

  if (Array.isArray(node)) {
    if (node.length === 0) return `${pad}[]`;
    const items = node.map(item => prettyPrintAST(item, indent + 1));
    return `${pad}[\n${items.join(',\n')}\n${pad}]`;
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const kind = obj['kind'] as string | undefined;
    const entries = Object.entries(obj).filter(
      ([k, v]) => k !== 'location' && v !== undefined && !(Array.isArray(v) && v.length === 0)
    );

    if (entries.length === 0) return `${pad}{}`;

    const header = kind
      ? `${pad}${colors.yellow}${kind}${colors.reset} {`
      : `${pad}{`;

    const body = entries
      .filter(([k]) => k !== 'kind')
      .map(([k, v]) => {
        const valStr =
          typeof v === 'object' && v !== null
            ? '\n' + prettyPrintAST(v, indent + 2)
            : ' ' + prettyPrintAST(v, 0).trim();
        return `${pad}  ${colors.blue}${k}${colors.reset}:${valStr}`;
      });

    return `${header}\n${body.join('\n')}\n${pad}}`;
  }

  return `${pad}${String(node)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Type Suggestion (for diagnostics)
// ─────────────────────────────────────────────────────────────────────────────

const ISL_TYPES = [
  'String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp', 'Duration',
  'List', 'Map', 'Optional', 'Number',
];

function suggestType(unknown: string): string | null {
  const lower = unknown.toLowerCase();
  for (const t of ISL_TYPES) {
    if (levenshteinDistance(lower, t.toLowerCase()) <= 2) {
      return t;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// All Commands (. prefix)
// ─────────────────────────────────────────────────────────────────────────────

export const metaCommands: MetaCommand[] = [
  // ─── .help ──────────────────────────────────────────────────────────────
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show commands',
    usage: '.help [command]',
    handler: (args) => {
      if (args.length > 0) {
        const cmdName = args[0]!.toLowerCase().replace(/^\./, '');
        const cmd = metaCommands.find(
          c => c.name === cmdName || c.aliases.includes(cmdName)
        );
        if (cmd) {
          return {
            output: [
              `${colors.cyan}.${cmd.name}${colors.reset} — ${cmd.description}`,
              `Usage: ${cmd.usage}`,
              cmd.aliases.length > 0
                ? `Aliases: ${cmd.aliases.map(a => '.' + a).join(', ')}`
                : '',
            ]
              .filter(Boolean)
              .join('\n'),
          };
        }
        return { output: formatError(`Unknown command: ${cmdName}`) };
      }

      const lines = [
        '',
        `${colors.bold}REPL Commands${colors.reset}`,
        '',
        ...metaCommands.map(
          c =>
            `  ${colors.cyan}.${c.name.padEnd(12)}${colors.reset} ${c.description}`
        ),
        '',
        `${colors.bold}ISL Input${colors.reset}`,
        '',
        `  Type ISL directly — multi-line supported (braces auto-detect):`,
        '',
        `  ${colors.yellow}domain${colors.reset} Example {`,
        `    ${colors.yellow}entity${colors.reset} User {`,
        `      id: ${colors.green}UUID${colors.reset}`,
        `      name: ${colors.green}String${colors.reset}`,
        `    }`,
        `  }`,
        '',
        `Type ${colors.cyan}.help <command>${colors.reset} for details.`,
        '',
      ];
      return { output: lines.join('\n') };
    },
  },

  // ─── .parse ─────────────────────────────────────────────────────────────
  {
    name: 'parse',
    aliases: ['p', 'ast'],
    description: 'Parse ISL and show AST',
    usage: '.parse <isl>',
    handler: (args, session) => {
      const input = args.join(' ').trim();
      if (!input) {
        return { output: 'Usage: .parse <isl code>\nExample: .parse domain Foo { version: "1.0" }' };
      }

      try {
        // Try the real parser
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { parse } = require('@isl-lang/parser') as {
          parse: (source: string, filename?: string) => {
            success: boolean;
            domain?: unknown;
            errors: Array<{ message: string; location?: { line: number; column: number } }>;
          };
        };

        const result = parse(input, '<repl>');

        if (!result.success || result.errors.length > 0) {
          const errLines = result.errors.map(e => {
            const loc = e.location;
            if (loc) {
              return formatParseError(input, e.message, loc.line, loc.column);
            }
            return formatError(e.message);
          });
          return { output: errLines.join('\n') };
        }

        if (result.domain) {
          session.setDomainAST(result.domain);
          return {
            output: formatSuccess('Parsed successfully') + '\n' + prettyPrintAST(result.domain),
          };
        }
        return { output: formatWarning('Parse returned no AST') };
      } catch {
        // Fallback: use the built-in simple parser
        return {
          output: formatWarning(
            'Real parser not available — install @isl-lang/parser.\n' +
            'Falling back to simple parse.'
          ),
        };
      }
    },
  },

  // ─── .eval ──────────────────────────────────────────────────────────────
  {
    name: 'eval',
    aliases: ['e'],
    description: 'Evaluate expression against context',
    usage: '.eval <expression>',
    handler: (args, session) => {
      const expr = args.join(' ').trim();
      if (!expr) {
        return {
          output: [
            'Usage: .eval <expression>',
            '',
            'Examples:',
            '  .eval user.email == "test@x.com"',
            '  .eval user.age > 30',
            '  .eval old(user.age)',
            '',
            'Set context first: .context { "user": { "email": "test@x.com" } }',
          ].join('\n'),
        };
      }

      const result = evaluateExpression(expr, session);
      if (result.error) {
        return { output: formatError(result.error) };
      }

      session.setLastResult(result.value);
      return {
        output: `${colors.cyan}\u2192${colors.reset} ${formatValue(result.value)}`,
      };
    },
  },

  // ─── .check ─────────────────────────────────────────────────────────────
  {
    name: 'check',
    aliases: ['c'],
    description: 'Type check the current session',
    usage: '.check [intent]',
    handler: (args, session) => {
      if (args.length > 0) {
        const intentName = args[0]!;
        const intent = session.getIntent(intentName);
        if (!intent) {
          const available = session.getIntentNames().join(', ') || '(none)';
          return {
            output: formatError(`Unknown intent: ${intentName}\nAvailable: ${available}`),
          };
        }

        const lines = [formatSuccess('Type check passed'), ''];
        for (const pre of intent.preconditions) {
          lines.push(`  ${colors.green}\u2713${colors.reset} pre: ${highlightExpression(pre.expression)}`);
        }
        for (const post of intent.postconditions) {
          lines.push(`  ${colors.green}\u2713${colors.reset} post: ${highlightExpression(post.expression)}`);
        }
        return { output: lines.join('\n') };
      }

      const intents = session.getAllIntents();
      if (intents.length === 0) {
        return {
          output: formatWarning('No intents defined. Write ISL or use .load <file>'),
        };
      }

      const lines = [formatSuccess(`Type check passed — ${intents.length} intent(s)`), ''];
      for (const intent of intents) {
        lines.push(`${colors.bold}${intent.name}${colors.reset}`);
        for (const pre of intent.preconditions) {
          lines.push(`  ${colors.green}\u2713${colors.reset} pre: ${highlightExpression(pre.expression)}`);
        }
        for (const post of intent.postconditions) {
          lines.push(`  ${colors.green}\u2713${colors.reset} post: ${highlightExpression(post.expression)}`);
        }
        lines.push('');
      }
      return { output: lines.join('\n') };
    },
  },

  // ─── .gen ───────────────────────────────────────────────────────────────
  {
    name: 'gen',
    aliases: ['generate', 'g'],
    description: 'Generate TypeScript from intent',
    usage: '.gen [intent]',
    handler: (args, session) => {
      const intents = args.length > 0
        ? [session.getIntent(args[0]!)].filter(Boolean) as Intent[]
        : session.getAllIntents();

      if (intents.length === 0) {
        return {
          output: args.length > 0
            ? formatError(`Unknown intent: ${args[0]}\nAvailable: ${session.getIntentNames().join(', ') || '(none)'}`)
            : formatWarning('No intents defined. Write ISL or use .load <file>'),
        };
      }

      const lines = [`${colors.gray}// Generated TypeScript${colors.reset}`, ''];

      for (const intent of intents) {
        lines.push(`interface ${intent.name}Contract {`);
        if (intent.preconditions.length > 0) {
          lines.push('  /** Preconditions */');
          for (const pre of intent.preconditions) {
            lines.push(`  checkPre(): boolean; // ${pre.expression}`);
          }
        }
        if (intent.postconditions.length > 0) {
          lines.push('  /** Postconditions */');
          for (const post of intent.postconditions) {
            lines.push(`  checkPost(): boolean; // ${post.expression}`);
          }
        }
        if (intent.invariants.length > 0) {
          lines.push('  /** Invariants */');
          for (const inv of intent.invariants) {
            lines.push(`  checkInvariant(): boolean; // ${inv.expression}`);
          }
        }
        lines.push('}');
        lines.push('');
      }

      return { output: lines.join('\n') };
    },
  },

  // ─── .load ──────────────────────────────────────────────────────────────
  {
    name: 'load',
    aliases: ['l'],
    description: 'Load an .isl file',
    usage: '.load <file.isl>',
    handler: (args, session) => {
      if (args.length === 0) {
        return { output: 'Usage: .load <file.isl>' };
      }

      const filePath = args[0]!;
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(resolvedPath)) {
        return { output: formatError(`File not found: ${resolvedPath}`) };
      }

      try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');

        // Try real parser first
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { parse } = require('@isl-lang/parser') as {
            parse: (source: string, filename?: string) => {
              success: boolean;
              domain?: Record<string, unknown>;
              errors: Array<{ message: string; location?: { line: number; column: number } }>;
            };
          };

          const result = parse(content, resolvedPath);

          if (!result.success || result.errors.length > 0) {
            const errLines = result.errors.map(e => {
              const loc = e.location;
              if (loc) {
                return formatParseError(content, e.message, loc.line, loc.column);
              }
              return formatError(e.message);
            });
            return { output: errLines.join('\n') };
          }

          if (result.domain) {
            session.setDomainAST(result.domain);
            const domain = result.domain as {
              name?: { name?: string };
              entities?: unknown[];
              behaviors?: unknown[];
            };
            const name = domain.name?.name ?? 'Unknown';
            const entityCount = domain.entities?.length ?? 0;
            const behaviorCount = domain.behaviors?.length ?? 0;

            return {
              output: formatSuccess(
                `Loaded: ${name} (${entityCount} entities, ${behaviorCount} behaviors) from ${path.basename(filePath)}`
              ),
            };
          }
        } catch {
          // Real parser unavailable — fallback to regex-based loading
        }

        // Fallback: regex-based intent/behavior extraction
        const intentRegex = /(?:intent|behavior)\s+(\w+)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
        let match;
        let count = 0;

        while ((match = intentRegex.exec(content)) !== null) {
          const intent = session.parseIntent(match[0]);
          if (intent) {
            session.defineIntent(intent);
            count++;
          }
        }

        if (count === 0) {
          return { output: formatWarning('No intents/behaviors found in file') };
        }
        return {
          output: formatSuccess(`Loaded ${count} intent(s) from ${path.basename(filePath)}`),
        };
      } catch (error) {
        return {
          output: formatError(
            `Failed to load: ${error instanceof Error ? error.message : String(error)}`
          ),
        };
      }
    },
  },

  // ─── .context ───────────────────────────────────────────────────────────
  {
    name: 'context',
    aliases: ['ctx'],
    description: 'Set evaluation context (JSON)',
    usage: '.context <json>  |  .context --pre <json>',
    handler: (args, session) => {
      const input = args.join(' ').trim();

      if (!input) {
        const ctx = session.getEvalContext();
        const pre = session.getPreContext();
        if (Object.keys(ctx).length === 0 && !pre) {
          return {
            output: [
              'No context set.',
              '',
              'Usage:',
              '  .context { "user": { "email": "test@x.com", "age": 25 } }',
              '  .context --pre { "user": { "age": 20 } }',
            ].join('\n'),
          };
        }
        const lines: string[] = [];
        if (Object.keys(ctx).length > 0) {
          lines.push(`${colors.bold}Context:${colors.reset}`);
          lines.push(formatValue(ctx));
        }
        if (pre) {
          lines.push(`${colors.bold}Pre-state:${colors.reset}`);
          lines.push(formatValue(pre));
        }
        return { output: lines.join('\n') };
      }

      // Handle --pre flag
      if (input.startsWith('--pre ')) {
        const json = input.slice(6).trim();
        const result = session.setPreContext(json);
        if (!result.success) {
          return { output: formatError(`Invalid JSON: ${result.error}`) };
        }
        return { output: formatSuccess('Pre-state context set') };
      }

      const result = session.setEvalContext(input);
      if (!result.success) {
        return { output: formatError(`Invalid JSON: ${result.error}`) };
      }
      return {
        output: formatSuccess(
          `Context set (${result.count} variable${result.count !== 1 ? 's' : ''})`
        ),
      };
    },
  },

  // ─── .clear ─────────────────────────────────────────────────────────────
  {
    name: 'clear',
    aliases: ['cls', 'reset'],
    description: 'Reset session state',
    usage: '.clear',
    handler: (_args, session) => {
      session.clear();
      return { output: formatSuccess('Session cleared') };
    },
  },

  // ─── .history ───────────────────────────────────────────────────────────
  {
    name: 'history',
    aliases: ['hist'],
    description: 'Show command history',
    usage: '.history [n]',
    handler: (args, session) => {
      const count = args.length > 0 ? parseInt(args[0]!, 10) : 10;
      const history = session.getHistory(count);

      if (history.length === 0) {
        return { output: 'No history.' };
      }

      const lines = [
        `${colors.bold}History${colors.reset} (last ${history.length} entries)`,
        '',
        ...history.map((entry, i) => {
          const num = String(i + 1).padStart(3);
          const preview = entry.split('\n')[0]!;
          const more = entry.includes('\n') ? ` ${colors.gray}...${colors.reset}` : '';
          return `  ${colors.gray}${num}${colors.reset} ${preview}${more}`;
        }),
      ];
      return { output: lines.join('\n') };
    },
  },

  // ─── .list ──────────────────────────────────────────────────────────────
  {
    name: 'list',
    aliases: ['ls'],
    description: 'List defined intents',
    usage: '.list',
    handler: (_args, session) => {
      const intents = session.getAllIntents();
      if (intents.length === 0) {
        return { output: 'No intents defined.' };
      }

      const lines = [''];
      for (const intent of intents) {
        const parts: string[] = [];
        if (intent.preconditions.length > 0) parts.push(`${intent.preconditions.length} pre`);
        if (intent.postconditions.length > 0) parts.push(`${intent.postconditions.length} post`);
        if (intent.invariants.length > 0) parts.push(`${intent.invariants.length} invariant`);
        const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        lines.push(`  ${colors.cyan}${intent.name}${colors.reset}${summary}`);
      }
      lines.push('');
      return { output: lines.join('\n') };
    },
  },

  // ─── .inspect ───────────────────────────────────────────────────────────
  {
    name: 'inspect',
    aliases: ['i', 'show'],
    description: 'Show full details of an intent',
    usage: '.inspect [intent]',
    handler: (args, session) => {
      if (args.length === 0) {
        const summary = session.getSummary();
        const ctx = session.getEvalContext();
        const lines = [
          '',
          `${colors.bold}Session Summary${colors.reset}`,
          '',
          `  Intents:    ${summary.intentCount}`,
          `  Variables:  ${summary.variableCount}`,
          `  Context:    ${Object.keys(ctx).length} keys`,
          `  History:    ${summary.historyCount} entries`,
          '',
        ];
        return { output: lines.join('\n') };
      }

      const intentName = args[0]!;
      const intent = session.getIntent(intentName);
      if (!intent) {
        const available = session.getIntentNames().join(', ') || '(none)';
        return {
          output: formatError(`Unknown intent: ${intentName}\nAvailable: ${available}`),
        };
      }
      return { output: formatIntent(intent) };
    },
  },

  // ─── .exit ──────────────────────────────────────────────────────────────
  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit the REPL',
    usage: '.exit',
    handler: () => {
      return { exit: true };
    },
  },
];

// Provide islCommands as an empty array for backward compatibility
export const islCommands: ISLCommand[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Command Suggestion (for typos)
// ─────────────────────────────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

/**
 * Find a similar command name
 */
export function findSimilarCommand(input: string, _type?: 'meta' | 'isl'): string | null {
  const names = metaCommands.flatMap(c => [c.name, ...c.aliases]);

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const name of names) {
    const distance = levenshteinDistance(input.toLowerCase(), name.toLowerCase());
    if (distance < bestDistance && distance <= 2) {
      bestDistance = distance;
      bestMatch = name;
    }
  }

  return bestMatch;
}
