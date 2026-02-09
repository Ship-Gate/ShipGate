/**
 * Postinstall message for shipgate CLI.
 *
 * Prints a short welcome message after `npm install shipgate` or `npx shipgate`.
 * Wrapped in try/catch so it never blocks installation.
 */
try {
  const message = [
    '',
    '\x1b[1m\x1b[36m  ShipGate installed successfully!\x1b[0m',
    '',
    "  Run \x1b[33mshipgate init\x1b[0m to set up your project.",
    '  Docs: \x1b[4m\x1b[36mhttps://shipgate.dev\x1b[0m',
    '',
  ].join('\n');

  console.log(message);
} catch {
  // Never fail the install
}
