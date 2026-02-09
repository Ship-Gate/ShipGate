export interface TerminalLine {
  text: string;
  type: 'command' | 'success' | 'error' | 'warning' | 'info' | 'dim' | 'blank' | 'divider' | 'verdict';
  /** Delay before this line appears (ms) */
  delay?: number;
}

export const INIT_COMMAND = 'npx shipgate init';
export const VERIFY_COMMAND = 'npx shipgate verify';

export const TERMINAL_INIT_LINES: TerminalLine[] = [
  { text: '$ npx shipgate init', type: 'command', delay: 0 },
  { text: '', type: 'blank', delay: 400 },
  { text: '  ✓ Detected: Next.js + TypeScript', type: 'success', delay: 600 },
  { text: '  ✓ Generated 12 behavioral specs', type: 'success', delay: 400 },
  { text: '  ✓ Created .shipgate/config.yml', type: 'success', delay: 400 },
  { text: '', type: 'blank', delay: 200 },
];

export const TERMINAL_VERIFY_LINES: TerminalLine[] = [
  { text: '$ npx shipgate verify', type: 'command', delay: 600 },
  { text: '', type: 'blank', delay: 400 },
  { text: '  Scanning 47 files...', type: 'dim', delay: 800 },
  { text: '', type: 'blank', delay: 600 },
  { text: '  ✗ FAKE FEATURE  src/api/payments.ts:42', type: 'error', delay: 500 },
  { text: '    Function processRefund() is exported but contains', type: 'info', delay: 100 },
  { text: '    no implementation — empty function body.', type: 'info', delay: 100 },
  { text: '', type: 'blank', delay: 400 },
  { text: '  ✗ HALLUCINATED API  src/services/auth.ts:18', type: 'error', delay: 500 },
  { text: '    Calls stripe.customers.validateIdentity() — this', type: 'info', delay: 100 },
  { text: '    method does not exist in Stripe SDK v14.', type: 'info', delay: 100 },
  { text: '', type: 'blank', delay: 400 },
  { text: '  ✗ SECURITY  src/middleware/auth.ts:7', type: 'error', delay: 500 },
  { text: '    Password stored as plaintext in session cookie.', type: 'info', delay: 100 },
  { text: '    Missing bcrypt hash before storage.', type: 'info', delay: 100 },
  { text: '', type: 'blank', delay: 300 },
  { text: '  ─────────────────────────────────────', type: 'divider', delay: 300 },
  { text: '  Results: 3 violations found', type: 'warning', delay: 200 },
  { text: '  Verdict: NO_SHIP ✗', type: 'verdict', delay: 300 },
  { text: '', type: 'blank', delay: 100 },
  { text: '  Fix violations before merging to main.', type: 'dim', delay: 200 },
];

export const ALL_TERMINAL_LINES: TerminalLine[] = [
  ...TERMINAL_INIT_LINES,
  ...TERMINAL_VERIFY_LINES,
];

/** ISL spec example for Solution section */
export const ISL_SPEC_EXAMPLE = `intent TransferMoney {
  precondition: sender.balance >= amount
  precondition: amount > 0
  postcondition: sender.balance == old.balance - amount
  postcondition: receiver.balance == old.balance + amount
  invariant: totalSupply == constant
}`;

export const VIOLATION_EXAMPLE = `✗ VIOLATION: precondition missing

  sender.balance >= amount is never checked
  in src/api/transfer.ts:23

  → Function deducts amount without
    verifying sufficient balance.

  Verdict: NO_SHIP`;
