/**
 * Three Big Lies Checker
 *
 * Pattern-based detection of the 3 most dangerous AI code lies.
 * Produces NO-SHIP with specific, demo-ready violation messages.
 */

/** Strip comments so we don't match patterns in comments (e.g. "// no balance check") */
function stripComments(code: string): string {
  return code
    .replace(/\/\/[^\n]*/g, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // block comments
}

export interface Violation {
  id: string;
  rule: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  lineHint?: string;
}

export interface CheckResult {
  verdict: 'SHIP' | 'NO-SHIP';
  score: number;
  violations: Violation[];
  lie: string;
}

/**
 * Lie 1: Money - "This handles money correctly"
 * Catches: balance deduction without prior balance check
 */
export function checkMoneyTransfer(code: string): CheckResult {
  const violations: Violation[] = [];
  const c = stripComments(code);

  // Balance decremented without prior check
  const hasBalanceDeduction = /\.balance\s*-=|\w+\.balance\s*-\s*=/i.test(c);
  const hasBalanceCheck =
    /balance\s*>=|\.balance\s*>=|balance\s*<\s*amount|insufficient|sufficient/i.test(c);

  if (hasBalanceDeduction && !hasBalanceCheck) {
    violations.push({
      id: 'money/negative-balance',
      rule: 'balance_never_negative',
      message: 'Balance can go negative - no check for sufficient funds before transfer',
      severity: 'critical',
      lineHint: 'Look for: balance -= amount (without prior if balance >= amount)',
    });
  }

  return {
    verdict: violations.length > 0 ? 'NO-SHIP' : 'SHIP',
    score: violations.length > 0 ? 0 : 100,
    violations,
    lie: '"This handles money correctly"',
  };
}

/**
 * Lie 2: PII - "This handles login securely"
 * Catches: password or sensitive data in console.log
 */
export function checkPiiLogging(code: string): CheckResult {
  const violations: Violation[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes('console.log') && !line.includes('console.debug')) continue;

    if (/password|pwd|secret|token|credentials/i.test(line)) {
      violations.push({
        id: 'pii/password-logged',
        rule: 'no_pii_in_logs',
        message: 'Password or credentials may be logged - CRITICAL security violation',
        severity: 'critical',
        lineHint: `Line ${i + 1}: ${line.trim().slice(0, 60)}...`,
      });
    } else if (/email|user\.|body\.|input\./i.test(line)) {
      violations.push({
        id: 'pii/sensitive-logged',
        rule: 'no_pii_in_logs',
        message: 'PII (email, user data) in logs - may leak in production',
        severity: 'high',
        lineHint: `Line ${i + 1}`,
      });
    }
  }

  return {
    verdict: violations.length > 0 ? 'NO-SHIP' : 'SHIP',
    score: violations.length > 0 ? Math.max(0, 50 - violations.length * 25) : 100,
    violations,
    lie: '"This handles login securely"',
  };
}

/**
 * Lie 3: Validation - "Input is validated"
 * Catches: direct use of user input without validation
 */
export function checkInputValidation(code: string): CheckResult {
  const violations: Violation[] = [];
  const c = stripComments(code);

  const hasDirectUse =
    /users\.set\s*\(\s*email|\.set\s*\(\s*email\s*,/i.test(c) ||
    (c.includes('email') && c.includes('users.set') && !/\bvalidate\b|sanitize|length\s*>/i.test(c));

  const hasValidation =
    /\bvalidate\b|sanitize|escape|z\.string|yup\.|joi\.|\.length\s*>\s*0|\.includes\s*\(|isValid|schema\./i.test(c);

  if (hasDirectUse && !hasValidation) {
    violations.push({
      id: 'validation/missing',
      rule: 'input_validated',
      message: 'No input validation - accepts empty strings, invalid email, SQL injection, XSS',
      severity: 'critical',
      lineHint: 'Direct use of email/name without validate(), length check, or format check',
    });
  }

  return {
    verdict: violations.length > 0 ? 'NO-SHIP' : 'SHIP',
    score: violations.length > 0 ? 0 : 100,
    violations,
    lie: '"Input is validated"',
  };
}
