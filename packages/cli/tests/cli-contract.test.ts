/**
 * CLI Contract & Snapshot Tests
 *
 * Automatically enumerates every CLI command/subcommand by statically parsing
 * the Commander registrations in cli.ts (zero hardcoding).  Snapshots:
 *
 *   1. Full surface-area manifest (command names, parent hierarchy)
 *   2. Per-command option signatures (flags, descriptions, defaults)
 *   3. Per-command argument signatures (name, required/optional, variadic)
 *   4. Per-command descriptions
 *   5. Alias map
 *   6. Global program options and version
 *
 * A normalization layer strips ANSI codes, absolute paths, timestamps,
 * durations, and version strings so snapshots stay stable across machines
 * and minor releases.
 *
 * Works via static source analysis — no build or runtime import required.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Source Path ──────────────────────────────────────────────────────────────

const CLI_SRC = resolve(__dirname, '../src/cli.ts');

// ─── Normalization Layer ──────────────────────────────────────────────────────

function normalize(raw: string): string {
  let s = raw;

  // Strip ANSI escape codes
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/\x1B\][^\x07]*\x07/g, '');

  // Normalize Windows paths
  s = s.replace(/[A-Z]:\\[^\s"')]+/gi, (m) =>
    '<PATH>/' + m.split(/[\\/]/).slice(-1)[0],
  );

  // Normalize Unix absolute paths
  s = s.replace(/\/(?:Users|home|tmp|var)[^\s"')]+/g, (m) => {
    const parts = m.split('/');
    return '<PATH>/' + parts[parts.length - 1];
  });

  // Strip timestamps
  s = s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>');
  s = s.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>');

  // Strip durations
  s = s.replace(/\d+(\.\d+)?\s*ms/g, '<DURATION>');
  s = s.replace(/\d+(\.\d+)?\s*s(?:econds?)?/g, '<DURATION>');

  // Normalize semver
  s = s.replace(/\d+\.\d+\.\d+(-[\w.]+)?/g, '<VERSION>');

  // Collapse blank lines, trim
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.split('\n').map((l) => l.trimEnd()).join('\n').trim();

  return s;
}

// ─── Static Source Parser ─────────────────────────────────────────────────────

interface ParsedOption {
  flags: string;
  description: string;
  defaultValue?: string;
}

interface ParsedCommand {
  /** Full path, e.g. "shipgate truthpack build" */
  path: string;
  /** Leaf name, e.g. "truthpack build" */
  name: string;
  /** Raw .command() argument, e.g. "verify [path]" */
  signature: string;
  description: string;
  options: ParsedOption[];
  aliases: string[];
  /** True if another command uses this as its parent */
  isGroup: boolean;
  /** Parent command path, empty string for top-level */
  parent: string;
}

/**
 * Parse cli.ts source text and extract every Commander command registration.
 *
 * Strategy:
 *   1. Build a map of variable → parent path by finding assignments like
 *      `const shipgateCommand = program.command('shipgate')` or
 *      `const X = parentVar.command('name')`.
 *   2. Find every `.command('...')` call and resolve its parent.
 *   3. For each command block (text from `.command(` to `.action(` or next
 *      command registration), extract `.description()`, `.option()`,
 *      `.requiredOption()`, and `.alias()`.
 */
function parseCliSource(source: string): {
  commands: ParsedCommand[];
  version: string;
  globalOptions: ParsedOption[];
} {
  // ── Extract version ─────────────────────────────────────────────────────
  const versionMatch = source.match(/const\s+VERSION\s*=\s*'([^']+)'/);
  const version = versionMatch?.[1] ?? 'unknown';

  // ── Extract global options ──────────────────────────────────────────────
  // Global options are on the `program` chain before any .command() call.
  // Find the block: program\n  .name(...)\n  .description(...)\n  .version(...)  .option(...)
  const globalOptions: ParsedOption[] = [];
  const globalBlock = source.match(
    /^program\s*\n((?:\s+\.(?:name|description|version|option|hook)\([\s\S]*?\)\s*\n?)*)/m,
  );
  if (globalBlock) {
    const optRe = /\.option\(\s*'([^']+)'\s*,\s*'([^']*)'(?:\s*,\s*'([^']*)')?\s*\)/g;
    let m;
    while ((m = optRe.exec(globalBlock[0])) !== null) {
      globalOptions.push({
        flags: m[1],
        description: m[2],
        ...(m[3] !== undefined ? { defaultValue: m[3] } : {}),
      });
    }
  }

  // ── Build variable → parent-path map ────────────────────────────────────
  // Matches: `const varName = parentVar\n  .command('cmdName')`
  //      or: `const varName = parentVar.command('cmdName')`
  const varMap: Record<string, string> = { program: '' };
  const varAssignRe =
    /const\s+(\w+)\s*=\s*(\w+)\s*(?:\n\s*)?\.command\(\s*'([^']+)'\s*\)/g;
  let vm;
  while ((vm = varAssignRe.exec(source)) !== null) {
    const [, varName, parentVar, cmdName] = vm;
    const parentPath = varMap[parentVar] ?? '';
    const fullPath = parentPath ? `${parentPath} ${cmdName}` : cmdName;
    varMap[varName] = fullPath;
  }

  // ── Find all .command() registrations ───────────────────────────────────
  // Matches both `program\n  .command('...')` and `varName\n  .command('...')`
  // as well as inline `varName.command('...')`
  const cmdRe = /(\w+)\s*(?:\n\s*)?\.command\(\s*'([^']+)'\s*\)/g;
  const rawCommands: {
    parentVar: string;
    signature: string;
    startIdx: number;
  }[] = [];
  let cm;
  while ((cm = cmdRe.exec(source)) !== null) {
    // Skip if this is part of a const assignment (handled above for var mapping,
    // but we still need the command entry)
    rawCommands.push({
      parentVar: cm[1],
      signature: cm[2],
      startIdx: cm.index,
    });
  }

  // ── Extract each command's block and parse it ───────────────────────────
  const commands: ParsedCommand[] = [];
  const parentPaths = new Set<string>();

  for (let i = 0; i < rawCommands.length; i++) {
    const { parentVar, signature, startIdx } = rawCommands[i];
    const endIdx = i + 1 < rawCommands.length
      ? rawCommands[i + 1].startIdx
      : source.length;
    const block = source.slice(startIdx, endIdx);

    // Split signature into name tokens and arg tokens.
    // 'truthpack build' → name='truthpack build', no args
    // 'verify [path]'  → name='verify', args=['[path]']
    // 'proof verify <bundle-path>' → name='proof verify', args=['<bundle-path>']
    const sigTokens = signature.split(/\s+/);
    const nameTokens: string[] = [];
    for (const tok of sigTokens) {
      if (tok.startsWith('<') || tok.startsWith('[')) break;
      nameTokens.push(tok);
    }
    const cmdName = nameTokens.join(' ') || sigTokens[0];

    // Resolve parent
    const parentPath = varMap[parentVar] ?? '';
    const fullPath = parentPath ? `${parentPath} ${cmdName}` : cmdName;

    if (parentPath) parentPaths.add(parentPath);

    // Description — handle both single-line and multi-line string concat
    let description = '';
    const descSingle = block.match(/\.description\(\s*'([^']*)'\s*\)/);
    const descTemplate = block.match(/\.description\(\s*`([^`]*)`\s*\)/);
    const descConcat = block.match(
      /\.description\(\s*\n?\s*'([^']*)'(?:\s*\+\s*\n?\s*'[^']*')*/,
    );
    if (descSingle) {
      description = descSingle[1];
    } else if (descTemplate) {
      description = descTemplate[1].split('\n')[0].trim();
    } else if (descConcat) {
      // Multi-line concat: take first line
      description = descConcat[1];
    }

    // Options
    const options: ParsedOption[] = [];
    const optRe =
      /\.(?:option|requiredOption)\(\s*'([^']+)'\s*,\s*'([^']*)'(?:\s*,\s*'([^']*)')?\s*(?:,\s*'([^']*)')?\s*\)/g;
    let om;
    while ((om = optRe.exec(block)) !== null) {
      options.push({
        flags: om[1],
        description: om[2],
        ...(om[3] !== undefined && !om[3].startsWith('(') ? { defaultValue: om[3] } : {}),
      });
    }

    // Aliases
    const aliases: string[] = [];
    const aliasRe = /\.alias\(\s*'([^']+)'\s*\)/g;
    let am;
    while ((am = aliasRe.exec(block)) !== null) {
      aliases.push(am[1]);
    }

    commands.push({
      path: fullPath,
      name: cmdName,
      signature,
      description,
      options,
      aliases,
      isGroup: false, // set below
      parent: parentPath,
    });
  }

  // Mark groups
  for (const cmd of commands) {
    if (parentPaths.has(cmd.path)) {
      cmd.isGroup = true;
    }
  }

  return { commands, version, globalOptions };
}

// ─── Parse at module level ────────────────────────────────────────────────────

const source = readFileSync(CLI_SRC, 'utf-8');
const parsed = parseCliSource(source);
const { commands, version, globalOptions } = parsed;

// Build it.each table
const cmdTable = commands.map((c, i) => ({ label: c.path, idx: i }));

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CLI Contract Snapshots', () => {

  // ── Sanity ────────────────────────────────────────────────────────────────

  it('discovers at least 15 commands from cli.ts', () => {
    expect(commands.length).toBeGreaterThanOrEqual(15);
  });

  // ── Root Program ──────────────────────────────────────────────────────────

  describe('root program', () => {
    it('version snapshot', () => {
      expect(normalize(version)).toMatchSnapshot();
    });

    it('global options snapshot', () => {
      const sig = globalOptions
        .map((o) => `${o.flags}  ${o.description}${o.defaultValue ? ` [default: ${o.defaultValue}]` : ''}`)
        .sort()
        .join('\n');
      expect(sig).toMatchSnapshot();
    });
  });

  // ── Surface area drift detection ──────────────────────────────────────────

  describe('surface area', () => {
    it('command list snapshot (detects added/removed commands)', () => {
      const surface = commands
        .map((c) => `${c.isGroup ? '[group] ' : ''}${c.path}`)
        .sort()
        .join('\n');
      expect(surface).toMatchSnapshot();
    });

    it('full command tree snapshot', () => {
      const tree = commands
        .map((c) => {
          const indent = c.parent ? '  ' : '';
          const groupTag = c.isGroup ? ' [group]' : '';
          return `${indent}${c.path}${groupTag}`;
        })
        .join('\n');
      expect(tree).toMatchSnapshot();
    });
  });

  // ── Per-command description snapshots ──────────────────────────────────────

  describe('command descriptions', () => {
    it.each(cmdTable)('$label description', ({ idx }) => {
      const cmd = commands[idx];
      expect(normalize(cmd.description)).toMatchSnapshot();
    });
  });

  // ── Per-command option signature snapshots ─────────────────────────────────

  describe('command option signatures', () => {
    it.each(cmdTable)('$label options', ({ idx }) => {
      const cmd = commands[idx];
      const sig = cmd.options
        .map((o) => `${o.flags}  ${o.description}${o.defaultValue ? ` [default: ${o.defaultValue}]` : ''}`)
        .sort()
        .join('\n') || '(no options)';
      expect(sig).toMatchSnapshot();
    });
  });

  // ── Per-command argument snapshots ─────────────────────────────────────────

  describe('command argument signatures', () => {
    it.each(cmdTable)('$label args', ({ idx }) => {
      const cmd = commands[idx];
      // Parse args from the signature, skipping name tokens.
      // 'proof verify <bundle-path>' → args = ['<bundle-path>']
      const sigTokens = cmd.signature.split(/\s+/);
      const sigParts = sigTokens.filter((t) => t.startsWith('<') || t.startsWith('['));
      const args = sigParts.length > 0
        ? sigParts.map((a) => {
            const required = a.startsWith('<');
            const variadic = a.includes('...');
            const name = a.replace(/[<>\[\]\.]/g, '');
            return `${name} ${required ? '<required>' : '[optional]'}${variadic ? ' ...' : ''}`;
          }).join('\n')
        : '(no arguments)';
      expect(args).toMatchSnapshot();
    });
  });

  // ── Alias coverage ────────────────────────────────────────────────────────

  describe('command aliases', () => {
    it('alias map snapshot', () => {
      const aliases = commands
        .filter((c) => c.aliases.length > 0)
        .map((c) => `${c.path} → ${c.aliases.join(', ')}`)
        .sort()
        .join('\n');
      expect(aliases || '(no aliases)').toMatchSnapshot();
    });
  });

  // ── Contract: no command has empty description ─────────────────────────────

  describe('contract invariants', () => {
    it.each(cmdTable)('$label has a description', ({ idx }) => {
      // Every user-facing command should have a non-empty description.
      // Groups may delegate description to subcommands, but should still
      // have at least a brief one-liner.
      const cmd = commands[idx];
      expect(cmd.description.length).toBeGreaterThan(0);
    });
  });
});
