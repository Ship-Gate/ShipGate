// ============================================================================
// Help Command
// Show help information
// ============================================================================

import type { CommandResult, Domain } from '../types.js';
import { COMMANDS, KEYWORDS } from '../completions.js';

/**
 * Help command handler
 */
export function helpCommand(topic?: string, domain?: Domain | null): CommandResult {
  if (!topic) {
    return generalHelp();
  }

  switch (topic.toLowerCase()) {
    case 'commands':
      return commandsHelp();
    case 'expressions':
      return expressionsHelp();
    case 'load':
      return loadHelp();
    case 'check':
      return checkHelp();
    case 'generate':
      return generateHelp();
    case 'verify':
      return verifyHelp();
    case 'inspect':
      return inspectHelp();
    case 'domain':
      return domainHelp(domain);
    default:
      return {
        success: false,
        error: `Unknown help topic: ${topic}\nAvailable: commands, expressions, load, check, generate, verify, inspect, domain`,
      };
  }
}

/**
 * General help
 */
function generalHelp(): CommandResult {
  const lines = [
    '',
    'ISL Interactive REPL',
    '====================',
    '',
    'Commands:',
    '  :load <file>     Load an ISL domain file',
    '  :check           Type-check the current domain',
    '  :generate <what> Generate code (types|tests|docs|api|schema)',
    '  :verify <name>   Verify a behavior',
    '  :inspect <name>  Inspect entity, behavior, or type',
    '  :list <what>     List entities, behaviors, types, etc.',
    '  :state           Show current REPL state',
    '  :reset           Reset REPL state',
    '  :history         Show command history',
    '  :clear           Clear screen',
    '  :help [topic]    Show help (topics: commands, expressions, load, generate)',
    '  :exit / :quit    Exit REPL',
    '',
    'Expressions:',
    '  Type ISL expressions directly to evaluate them:',
    '  > CreateUser(email: "test@example.com", name: "Test")',
    '  > User.exists(email: "test@example.com")',
    '  > 1 + 2 * 3',
    '  > users.filter(u => u.active)',
    '',
    'Variables:',
    '  _ contains the result of the last expression',
    '',
    'Tab Completion:',
    '  Press Tab for auto-completion of commands, entities, behaviors',
    '',
    'History:',
    '  Use Up/Down arrows to navigate command history',
    '',
    'For more help: :help <topic>',
    '',
  ];

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Commands help
 */
function commandsHelp(): CommandResult {
  const lines = [
    '',
    'Available Commands',
    '==================',
    '',
  ];

  for (const cmd of COMMANDS) {
    lines.push(`  ${cmd.text.padEnd(15)} ${cmd.description}`);
  }

  lines.push('');
  lines.push('Commands start with : and are case-sensitive.');
  lines.push('');

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Expressions help
 */
function expressionsHelp(): CommandResult {
  const lines = [
    '',
    'ISL Expressions',
    '===============',
    '',
    'Literals:',
    '  42              Number',
    '  3.14            Decimal',
    '  "hello"         String',
    '  true, false     Boolean',
    '  null            Null',
    '  [1, 2, 3]       Array',
    '  {a: 1, b: 2}    Object',
    '',
    'Operators:',
    '  +, -, *, /      Arithmetic',
    '  ==, !=          Equality',
    '  <, <=, >, >=    Comparison',
    '  and, or, not    Logical',
    '  implies         Implication',
    '',
    'Function Calls:',
    '  BehaviorName(arg1: value1, arg2: value2)',
    '  Entity.method(args)',
    '',
    'Member Access:',
    '  object.property',
    '  array[index]',
    '',
    'Keywords:',
  ];

  for (const kw of KEYWORDS) {
    lines.push(`  ${kw.text.padEnd(12)} ${kw.description}`);
  }

  lines.push('');

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Load help
 */
function loadHelp(): CommandResult {
  const lines = [
    '',
    ':load Command',
    '=============',
    '',
    'Usage: :load <file.isl>',
    '',
    'Loads an ISL domain file and parses it.',
    '',
    'Examples:',
    '  :load domain.isl',
    '  :load ./specs/user-management.isl',
    '  :load /absolute/path/to/file.isl',
    '',
    'After loading:',
    '  - Domain is parsed and type-checked',
    '  - Entities and behaviors become available',
    '  - Tab completion includes domain elements',
    '',
    'Errors:',
    '  Parse errors are shown with line:column location',
    '  Type errors are shown as warnings',
    '',
  ];

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Check help
 */
function checkHelp(): CommandResult {
  const lines = [
    '',
    ':check Command',
    '==============',
    '',
    'Usage: :check',
    '',
    'Type-checks the currently loaded domain.',
    '',
    'Checks performed:',
    '  - Duplicate field names',
    '  - Type reference validity',
    '  - Lifecycle state validity',
    '  - Behavior input/output types',
    '  - Side effect entity references',
    '',
    'Output:',
    '  ✓ indicates passing checks',
    '  ✗ indicates errors',
    '  ⚠ indicates warnings',
    '',
  ];

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Generate help
 */
function generateHelp(): CommandResult {
  const lines = [
    '',
    ':generate Command',
    '=================',
    '',
    'Usage: :generate <target>',
    '',
    'Targets:',
    '  types    Generate TypeScript interfaces',
    '  tests    Generate test stubs',
    '  docs     Generate Markdown documentation',
    '  api      Generate Express API routes',
    '  schema   Generate SQL schema',
    '',
    'Examples:',
    '  :generate types     # TypeScript types for all entities',
    '  :generate tests     # Vitest test stubs',
    '  :generate schema    # PostgreSQL CREATE TABLE statements',
    '',
    'Output is printed to the console.',
    'Use copy/paste to save to files.',
    '',
  ];

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Verify help
 */
function verifyHelp(): CommandResult {
  const lines = [
    '',
    ':verify Command',
    '===============',
    '',
    'Usage: :verify <behavior_name>',
    '',
    'Verifies a behavior against its specification.',
    '',
    'Checks:',
    '  - Preconditions are satisfiable',
    '  - Postconditions are achievable',
    '  - Error conditions are handled',
    '  - Side effects reference valid entities',
    '',
    'Output:',
    '  ✓ Pass - condition verified',
    '  ✗ Fail - condition failed with counterexample',
    '  ? Unknown - could not verify',
    '',
    'Example:',
    '  :verify CreateUser',
    '',
  ];

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Inspect help
 */
function inspectHelp(): CommandResult {
  const lines = [
    '',
    ':inspect Command',
    '================',
    '',
    'Usage: :inspect [name]',
    '',
    'Without name: Shows domain summary',
    'With name: Shows details of entity, behavior, or type',
    '',
    'Examples:',
    '  :inspect           # Show domain summary',
    '  :inspect User      # Show User entity details',
    '  :inspect CreateUser # Show CreateUser behavior',
    '  :inspect Email     # Show Email type details',
    '',
    'Related:',
    '  :list entities     # List all entities',
    '  :list behaviors    # List all behaviors',
    '  :list types        # List all types',
    '',
  ];

  return {
    success: true,
    message: lines.join('\n'),
  };
}

/**
 * Domain-specific help
 */
function domainHelp(domain: Domain | null | undefined): CommandResult {
  if (!domain) {
    return {
      success: false,
      error: 'No domain loaded. Use :load <file.isl> first.',
    };
  }

  const lines = [
    '',
    `Domain: ${domain.name.name}`,
    '='.repeat(domain.name.name.length + 8),
    '',
    `Version: ${domain.version.value}`,
    '',
    'Entities:',
  ];

  for (const entity of domain.entities) {
    const desc = entity.description ? ` - ${entity.description.value}` : '';
    lines.push(`  ${entity.name.name}${desc}`);
  }

  lines.push('');
  lines.push('Behaviors:');

  for (const behavior of domain.behaviors) {
    const desc = behavior.description ? ` - ${behavior.description.value}` : '';
    lines.push(`  ${behavior.name.name}${desc}`);
  }

  if (domain.types.length > 0) {
    lines.push('');
    lines.push('Types:');
    for (const type of domain.types) {
      lines.push(`  ${type.name.name}`);
    }
  }

  lines.push('');
  lines.push('Use :inspect <name> for details.');
  lines.push('');

  return {
    success: true,
    message: lines.join('\n'),
  };
}
