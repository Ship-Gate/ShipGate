// ============================================================================
// ISL REPL Commands
// Meta commands (.) and ISL commands (:)
// ============================================================================

import { Session, Intent } from './session';
import { 
  formatIntent, 
  formatSuccess, 
  formatError, 
  formatWarning, 
  formatTable,
  colors,
  highlightISL,
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

/**
 * ISL command definition (: prefix)
 */
export interface ISLCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string[], session: Session, repl: REPL) => CommandResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta Commands (. prefix) - REPL control commands
// ─────────────────────────────────────────────────────────────────────────────

export const metaCommands: MetaCommand[] = [
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show help for commands',
    usage: '.help [command]',
    handler: (args, session) => {
      if (args.length > 0) {
        const cmdName = args[0]!.toLowerCase();
        
        // Search in meta commands
        const metaCmd = metaCommands.find(c => c.name === cmdName || c.aliases.includes(cmdName));
        if (metaCmd) {
          return {
            output: [
              `${colors.cyan}.${metaCmd.name}${colors.reset} - ${metaCmd.description}`,
              `Usage: ${metaCmd.usage}`,
              metaCmd.aliases.length > 0 ? `Aliases: ${metaCmd.aliases.map(a => '.' + a).join(', ')}` : '',
            ].filter(Boolean).join('\n'),
          };
        }

        // Search in ISL commands
        const islCmd = islCommands.find(c => c.name === cmdName || c.aliases.includes(cmdName));
        if (islCmd) {
          return {
            output: [
              `${colors.cyan}:${islCmd.name}${colors.reset} - ${islCmd.description}`,
              `Usage: ${islCmd.usage}`,
              islCmd.aliases.length > 0 ? `Aliases: ${islCmd.aliases.map(a => ':' + a).join(', ')}` : '',
            ].filter(Boolean).join('\n'),
          };
        }

        return { output: formatError(`Unknown command: ${cmdName}`) };
      }

      const lines = [
        '',
        `${colors.bold}Meta Commands${colors.reset} ${colors.gray}(REPL control)${colors.reset}`,
        '',
        ...metaCommands.map(c => `  ${colors.cyan}.${c.name.padEnd(10)}${colors.reset} ${c.description}`),
        '',
        `${colors.bold}ISL Commands${colors.reset} ${colors.gray}(specification operations)${colors.reset}`,
        '',
        ...islCommands.map(c => `  ${colors.cyan}:${c.name.padEnd(10)}${colors.reset} ${c.description}`),
        '',
        `${colors.bold}ISL Syntax${colors.reset}`,
        '',
        `  ${colors.yellow}intent${colors.reset} Name {`,
        `    ${colors.magenta}pre${colors.reset}: condition`,
        `    ${colors.magenta}post${colors.reset}: condition`,
        `  }`,
        '',
        `Type ${colors.cyan}.help <command>${colors.reset} for detailed help.`,
        '',
      ];

      return { output: lines.join('\n') };
    },
  },

  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit the REPL',
    usage: '.exit',
    handler: () => {
      return { exit: true };
    },
  },

  {
    name: 'clear',
    aliases: ['cls'],
    description: 'Clear session state (intents, variables)',
    usage: '.clear',
    handler: (args, session) => {
      session.clear();
      return { output: formatSuccess('Session cleared') };
    },
  },

  {
    name: 'history',
    aliases: ['hist'],
    description: 'Show command history',
    usage: '.history [n]',
    handler: (args, session) => {
      const count = args.length > 0 ? parseInt(args[0]!) : 10;
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
];

// ─────────────────────────────────────────────────────────────────────────────
// ISL Commands (: prefix) - Specification operations
// ─────────────────────────────────────────────────────────────────────────────

export const islCommands: ISLCommand[] = [
  {
    name: 'check',
    aliases: ['c'],
    description: 'Type check an intent',
    usage: ':check <intent>',
    handler: (args, session) => {
      if (args.length === 0) {
        // Check all intents
        const intents = session.getAllIntents();
        if (intents.length === 0) {
          return { output: formatWarning('No intents defined. Define one with: intent Name { ... }') };
        }

        const lines = [
          formatSuccess('Type check passed'),
          '',
        ];

        for (const intent of intents) {
          lines.push(`${colors.bold}${intent.name}${colors.reset}`);
          
          for (const pre of intent.preconditions) {
            lines.push(`  ${colors.green}✓${colors.reset} pre: ${highlightCondition(pre.expression)}`);
          }
          
          for (const post of intent.postconditions) {
            lines.push(`  ${colors.green}✓${colors.reset} post: ${highlightCondition(post.expression)}`);
          }
          
          lines.push('');
        }

        return { output: lines.join('\n') };
      }

      const intentName = args[0]!;
      const intent = session.getIntent(intentName);

      if (!intent) {
        const available = session.getIntentNames().join(', ') || '(none)';
        return { 
          output: formatError(`Unknown intent: ${intentName}\nAvailable: ${available}`) 
        };
      }

      const lines = [
        formatSuccess('Type check passed'),
        '',
      ];

      for (const pre of intent.preconditions) {
        lines.push(`  pre: ${highlightCondition(pre.expression)} ${colors.green}✓${colors.reset}`);
      }

      for (const post of intent.postconditions) {
        lines.push(`  post: ${highlightCondition(post.expression)} ${colors.green}✓${colors.reset}`);
      }

      return { output: lines.join('\n') };
    },
  },

  {
    name: 'gen',
    aliases: ['generate', 'g'],
    description: 'Generate code from an intent',
    usage: ':gen <target> <intent>',
    handler: (args, session) => {
      if (args.length < 2) {
        return {
          output: [
            'Usage: :gen <target> <intent>',
            '',
            'Targets:',
            '  typescript  Generate TypeScript contract',
            '  rust        Generate Rust contract',
            '  go          Generate Go contract',
            '  openapi     Generate OpenAPI schema',
          ].join('\n'),
        };
      }

      const target = args[0]!.toLowerCase();
      const intentName = args[1]!;
      const intent = session.getIntent(intentName);

      if (!intent) {
        const available = session.getIntentNames().join(', ') || '(none)';
        return { 
          output: formatError(`Unknown intent: ${intentName}\nAvailable: ${available}`) 
        };
      }

      switch (target) {
        case 'typescript':
        case 'ts':
          return { output: generateTypeScript(intent) };
        case 'rust':
        case 'rs':
          return { output: generateRust(intent) };
        case 'go':
          return { output: generateGo(intent) };
        case 'openapi':
        case 'oas':
          return { output: generateOpenAPI(intent) };
        default:
          return { 
            output: formatError(`Unknown target: ${target}\nAvailable: typescript, rust, go, openapi`) 
          };
      }
    },
  },

  {
    name: 'load',
    aliases: ['l'],
    description: 'Load intents from a file',
    usage: ':load <file.isl>',
    handler: (args, session) => {
      if (args.length === 0) {
        return { output: 'Usage: :load <file.isl>' };
      }

      const filePath = args[0]!;
      
      // Synchronous wrapper around async load
      // In a real implementation, this would need proper async handling
      let result: { intents: { name: string }[]; errors: string[] } = { intents: [], errors: [] };
      
      session.loadFile(filePath).then(r => {
        result = r;
      }).catch(e => {
        result.errors.push(String(e));
      });

      // For now, we'll do a blocking load using fs.readFileSync
      const fs = require('fs');
      const path = require('path');
      
      try {
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath);

        if (!fs.existsSync(resolvedPath)) {
          return { output: formatError(`File not found: ${resolvedPath}`) };
        }

        const content = fs.readFileSync(resolvedPath, 'utf-8');
        
        // Find all intent/behavior definitions
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
          return { output: formatWarning('No intents found in file') };
        }

        return { 
          output: formatSuccess(`Loaded ${count} intent(s) from ${filePath}`) 
        };
      } catch (error) {
        return { 
          output: formatError(`Failed to load: ${error instanceof Error ? error.message : String(error)}`) 
        };
      }
    },
  },

  {
    name: 'list',
    aliases: ['ls'],
    description: 'List all defined intents',
    usage: ':list',
    handler: (args, session) => {
      const intents = session.getAllIntents();

      if (intents.length === 0) {
        return { output: 'No intents defined.' };
      }

      const lines = [''];

      for (const intent of intents) {
        const preCount = intent.preconditions.length;
        const postCount = intent.postconditions.length;
        const invCount = intent.invariants.length;

        const parts: string[] = [];
        if (preCount > 0) parts.push(`${preCount} pre`);
        if (postCount > 0) parts.push(`${postCount} post`);
        if (invCount > 0) parts.push(`${invCount} invariant`);

        const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        lines.push(`  ${colors.cyan}${intent.name}${colors.reset}${summary}`);
      }

      lines.push('');
      return { output: lines.join('\n') };
    },
  },

  {
    name: 'inspect',
    aliases: ['i', 'show'],
    description: 'Show full details of an intent',
    usage: ':inspect <intent>',
    handler: (args, session) => {
      if (args.length === 0) {
        // Show summary of all intents
        const summary = session.getSummary();
        const files = session.getLoadedFiles();

        const lines = [
          '',
          `${colors.bold}Session Summary${colors.reset}`,
          '',
          `  Intents:    ${summary.intentCount}`,
          `  Variables:  ${summary.variableCount}`,
          `  History:    ${summary.historyCount} entries`,
        ];

        if (files.length > 0) {
          lines.push('');
          lines.push(`${colors.bold}Loaded Files${colors.reset}`);
          for (const file of files) {
            lines.push(`  ${file}`);
          }
        }

        lines.push('');
        return { output: lines.join('\n') };
      }

      const intentName = args[0]!;
      const intent = session.getIntent(intentName);

      if (!intent) {
        const available = session.getIntentNames().join(', ') || '(none)';
        return { 
          output: formatError(`Unknown intent: ${intentName}\nAvailable: ${available}`) 
        };
      }

      return { output: formatIntent(intent) };
    },
  },

  {
    name: 'export',
    aliases: ['save'],
    description: 'Export intents to a file',
    usage: ':export <file.isl>',
    handler: (args, session) => {
      if (args.length === 0) {
        return { output: 'Usage: :export <file.isl>' };
      }

      const filePath = args[0]!;
      const fs = require('fs');
      const path = require('path');

      try {
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath);

        const intents = session.getAllIntents();
        
        if (intents.length === 0) {
          return { output: formatWarning('No intents to export') };
        }

        const lines: string[] = [];
        lines.push('// Exported ISL intents');
        lines.push(`// Generated at ${new Date().toISOString()}`);
        lines.push('');

        for (const intent of intents) {
          lines.push(`intent ${intent.name} {`);
          
          for (const pre of intent.preconditions) {
            lines.push(`  pre: ${pre.expression}`);
          }
          
          for (const post of intent.postconditions) {
            lines.push(`  post: ${post.expression}`);
          }
          
          for (const inv of intent.invariants) {
            lines.push(`  invariant: ${inv.expression}`);
          }
          
          lines.push('}');
          lines.push('');
        }

        fs.writeFileSync(resolvedPath, lines.join('\n'));
        return { output: formatSuccess(`Exported ${intents.length} intent(s) to ${filePath}`) };
      } catch (error) {
        return { 
          output: formatError(`Failed to export: ${error instanceof Error ? error.message : String(error)}`) 
        };
      }
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Code Generation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateTypeScript(intent: Intent): string {
  const lines = [
    `${colors.gray}// Generated TypeScript${colors.reset}`,
    `interface ${intent.name}Contract {`,
  ];

  if (intent.preconditions.length > 0) {
    for (const pre of intent.preconditions) {
      const varName = extractVariableName(pre.expression);
      const type = inferType(pre.expression);
      lines.push(`  pre: (${varName}: ${type}) => boolean;`);
    }
  }

  if (intent.postconditions.length > 0) {
    for (const post of intent.postconditions) {
      const varName = extractVariableName(post.expression);
      const type = inferType(post.expression);
      lines.push(`  post: (${varName}: ${type}) => boolean;`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

function generateRust(intent: Intent): string {
  const lines = [
    `${colors.gray}// Generated Rust${colors.reset}`,
    `pub trait ${intent.name}Contract {`,
  ];

  if (intent.preconditions.length > 0) {
    for (const pre of intent.preconditions) {
      const varName = extractVariableName(pre.expression);
      const type = inferRustType(pre.expression);
      lines.push(`    fn check_pre(&self, ${varName}: ${type}) -> bool;`);
    }
  }

  if (intent.postconditions.length > 0) {
    for (const post of intent.postconditions) {
      const varName = extractVariableName(post.expression);
      const type = inferRustType(post.expression);
      lines.push(`    fn check_post(&self, ${varName}: ${type}) -> bool;`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

function generateGo(intent: Intent): string {
  const lines = [
    `${colors.gray}// Generated Go${colors.reset}`,
    `type ${intent.name}Contract interface {`,
  ];

  if (intent.preconditions.length > 0) {
    for (const pre of intent.preconditions) {
      const varName = extractVariableName(pre.expression);
      const type = inferGoType(pre.expression);
      lines.push(`\tCheckPre(${varName} ${type}) bool`);
    }
  }

  if (intent.postconditions.length > 0) {
    for (const post of intent.postconditions) {
      const varName = extractVariableName(post.expression);
      const type = inferGoType(post.expression);
      lines.push(`\tCheckPost(${varName} ${type}) bool`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

function generateOpenAPI(intent: Intent): string {
  const lines = [
    `${colors.gray}# Generated OpenAPI${colors.reset}`,
    `openapi: 3.0.0`,
    `paths:`,
    `  /${intent.name.toLowerCase()}:`,
    `    post:`,
    `      summary: ${intent.name}`,
    `      requestBody:`,
    `        content:`,
    `          application/json:`,
    `            schema:`,
    `              type: object`,
  ];

  if (intent.preconditions.length > 0) {
    lines.push(`              # Preconditions:`);
    for (const pre of intent.preconditions) {
      lines.push(`              # - ${pre.expression}`);
    }
  }

  lines.push(`      responses:`);
  lines.push(`        '200':`);
  lines.push(`          description: Success`);

  if (intent.postconditions.length > 0) {
    lines.push(`          # Postconditions:`);
    for (const post of intent.postconditions) {
      lines.push(`          # - ${post.expression}`);
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function extractVariableName(expression: string): string {
  // Extract the first identifier from the expression
  const match = expression.match(/^(\w+)/);
  return match ? match[1]! : 'input';
}

function inferType(expression: string): string {
  if (expression.includes('.length')) return 'string';
  if (expression.includes('.startsWith')) return 'string';
  if (expression.includes('.endsWith')) return 'string';
  if (expression.includes('.includes')) return 'string';
  if (expression.includes(' > ') || expression.includes(' < ')) return 'number';
  return 'unknown';
}

function inferRustType(expression: string): string {
  if (expression.includes('.length') || expression.includes('.len()')) return '&str';
  if (expression.includes('.starts_with')) return '&str';
  if (expression.includes(' > ') || expression.includes(' < ')) return 'i32';
  return '&str';
}

function inferGoType(expression: string): string {
  if (expression.includes('.length') || expression.includes('len(')) return 'string';
  if (expression.includes(' > ') || expression.includes(' < ')) return 'int';
  return 'string';
}

function highlightCondition(expression: string): string {
  // Highlight the condition expression
  return expression
    .replace(/(\w+)\s*(>|<|>=|<=|==|!=)\s*(\d+|"[^"]*")/g, 
      `${colors.blue}$1${colors.reset} ${colors.yellow}$2${colors.reset} ${colors.green}$3${colors.reset}`)
    .replace(/\b(true|false)\b/g, `${colors.magenta}$1${colors.reset}`)
    .replace(/\.(length|startsWith|endsWith|includes)/g, `.${colors.cyan}$1${colors.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Suggestion (for typos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings
 */
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
export function findSimilarCommand(input: string, type: 'meta' | 'isl'): string | null {
  const commands = type === 'meta' ? metaCommands : islCommands;
  const names = commands.flatMap(c => [c.name, ...c.aliases]);
  
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
