/**
 * Interactive Prompts
 *
 * Readline-based prompts for the `shipgate init` guided setup.
 * Provides single-select, multi-select, confirm, and text input.
 * Falls back to defaults in non-TTY environments (CI).
 */

import { createInterface, type Interface } from 'readline';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
  hint?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Readline Management
// ─────────────────────────────────────────────────────────────────────────────

let rl: Interface | null = null;

function getReadline(): Interface {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: false,
    });
  }
  return rl;
}

/**
 * Close the shared readline instance. Call when prompts are done.
 */
export function closePrompts(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function isTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stderr.isTTY);
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = getReadline();
    readline.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Select (single choice)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt user to select one option from a list.
 *
 * @param message  The question to display
 * @param options  List of options
 * @param defaultIndex  Zero-based index of the default option
 * @returns The `value` of the selected option
 */
export async function select(
  message: string,
  options: SelectOption[],
  defaultIndex = 0,
): Promise<string> {
  if (!isTTY()) {
    return options[defaultIndex]?.value ?? options[0]!.value;
  }

  process.stderr.write('\n');
  process.stderr.write(chalk.cyan('? ') + chalk.bold(message) + '\n');

  for (let i = 0; i < options.length; i++) {
    const marker = i === defaultIndex ? chalk.cyan('❯') : ' ';
    const hint = options[i]!.hint ? chalk.gray(` (${options[i]!.hint})`) : '';
    process.stderr.write(`  ${marker} ${chalk.white(`${i + 1}`)}  ${options[i]!.label}${hint}\n`);
  }

  const defaultDisplay = defaultIndex + 1;
  const answer = await ask(chalk.gray(`  Enter choice [${defaultDisplay}]: `));

  if (answer === '') {
    return options[defaultIndex]?.value ?? options[0]!.value;
  }

  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < options.length) {
    return options[idx]!.value;
  }

  // Invalid input — use default
  process.stderr.write(chalk.yellow(`  Using default: ${options[defaultIndex]!.label}\n`));
  return options[defaultIndex]?.value ?? options[0]!.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Select (multiple choices)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prompt user to select multiple options from a list.
 *
 * @param message  The question to display
 * @param options  List of options
 * @param defaultValues  Values that should be pre-selected
 * @returns Array of selected `value`s
 */
export async function multiSelect(
  message: string,
  options: SelectOption[],
  defaultValues: string[] = [],
): Promise<string[]> {
  if (!isTTY()) {
    return defaultValues.length > 0 ? defaultValues : options.map((o) => o.value);
  }

  process.stderr.write('\n');
  process.stderr.write(chalk.cyan('? ') + chalk.bold(message) + chalk.gray(' (comma-separated numbers)') + '\n');

  for (let i = 0; i < options.length; i++) {
    const isDefault = defaultValues.includes(options[i]!.value);
    const checkbox = isDefault ? chalk.green('◉') : chalk.gray('◯');
    const hint = options[i]!.hint ? chalk.gray(` (${options[i]!.hint})`) : '';
    process.stderr.write(`  ${checkbox} ${chalk.white(`${i + 1}`)}  ${options[i]!.label}${hint}\n`);
  }

  const defaultNums = options
    .map((o, i) => (defaultValues.includes(o.value) ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const defaultDisplay = defaultNums.length > 0 ? defaultNums.join(',') : 'all';

  const answer = await ask(chalk.gray(`  Enter selections [${defaultDisplay}]: `));

  if (answer === '') {
    return defaultValues.length > 0 ? defaultValues : options.map((o) => o.value);
  }

  if (answer.toLowerCase() === 'all') {
    return options.map((o) => o.value);
  }

  if (answer.toLowerCase() === 'none') {
    return [];
  }

  const indices = answer
    .split(',')
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < options.length);

  if (indices.length === 0) {
    process.stderr.write(chalk.yellow(`  Using defaults\n`));
    return defaultValues.length > 0 ? defaultValues : options.map((o) => o.value);
  }

  return indices.map((i) => options[i]!.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm (yes/no)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask a yes/no confirmation question.
 *
 * @param message  The question to display
 * @param defaultYes  Whether the default is yes (true) or no (false)
 * @returns true if user confirmed
 */
export async function confirm(message: string, defaultYes = true): Promise<boolean> {
  if (!isTTY()) {
    return defaultYes;
  }

  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(chalk.cyan('? ') + chalk.bold(message) + chalk.gray(` [${hint}] `));

  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ask for text input with an optional default.
 *
 * @param message  The question to display
 * @param defaultValue  Default value if user presses Enter
 * @returns The user's input or default
 */
export async function input(message: string, defaultValue = ''): Promise<string> {
  if (!isTTY()) {
    return defaultValue;
  }

  const hint = defaultValue ? chalk.gray(` (${defaultValue})`) : '';
  const answer = await ask(chalk.cyan('? ') + chalk.bold(message) + hint + ' ');

  return answer || defaultValue;
}
