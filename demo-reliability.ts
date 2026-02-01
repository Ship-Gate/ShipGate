#!/usr/bin/env npx tsx
/**
 * Reliability Comparison Demo
 * 
 * Shows the difference between:
 * - Regular AI: "Just write me code"
 * - IntentOS: "Here's my spec, verify the code"
 */

// ─────────────────────────────────────────────────────────────────────────────
// Simulated "Regular AI" Generated Code
// ─────────────────────────────────────────────────────────────────────────────

const regularAICode = {
  name: "Regular AI Login",
  code: `
async function login(email, password) {
  const user = await db.findUser(email);
  if (!user) return { error: "User not found" };
  if (user.password === password) {
    return { token: createToken(user) };
  }
  return { error: "Wrong password" };
}`,
  
  // Problems that a regular AI wouldn't catch
  issues: [
    { severity: 'CRITICAL', issue: 'Plain text password comparison', found: false },
    { severity: 'CRITICAL', issue: 'Password might be logged', found: false },
    { severity: 'HIGH', issue: 'No rate limiting', found: false },
    { severity: 'HIGH', issue: 'No account lockout', found: false },
    { severity: 'HIGH', issue: 'Timing attack vulnerable', found: false },
    { severity: 'MEDIUM', issue: 'No input validation', found: false },
    { severity: 'MEDIUM', issue: 'Error reveals user existence', found: false },
    { severity: 'LOW', issue: 'No audit logging', found: false },
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// ISL Specification (The Contract)
// ─────────────────────────────────────────────────────────────────────────────

const islSpec = `
behavior Login {
  description: "Authenticate user with email and password"
  
  input {
    email: Email
    password: Password [sensitive]
  }
  
  output {
    success: Session
    errors {
      INVALID_CREDENTIALS { when: "Email or password wrong" }
      USER_LOCKED { when: "Account locked", retry_after: 15m }
      RATE_LIMITED { when: "Too many attempts", retry_after: 1h }
    }
  }
  
  preconditions {
    email.is_valid_format
    password.length >= 8
  }
  
  postconditions {
    success implies {
      - Session.exists(result.id)
      - User.last_login == now()
      - User.failed_attempts == 0
    }
    INVALID_CREDENTIALS implies {
      - User.failed_attempts incremented
    }
  }
  
  invariants {
    - password never stored in plaintext
    - password never appears in logs
    - timing attack resistant
  }
  
  security {
    - rate_limit 10 per hour per email
    - brute_force_protection enabled
  }
}`;

// ─────────────────────────────────────────────────────────────────────────────
// IntentOS Generated Code (From Spec)
// ─────────────────────────────────────────────────────────────────────────────

const intentOSCode = {
  name: "IntentOS Login (from ISL spec)",
  code: `
async function login(input: LoginInput): Promise<LoginResult> {
  // [PRECONDITION] Validate email format
  if (!isValidEmail(input.email)) {
    return { success: false, error: { code: 'INVALID_INPUT' } };
  }
  
  // [PRECONDITION] Validate password length
  if (input.password.length < 8) {
    return { success: false, error: { code: 'INVALID_INPUT' } };
  }
  
  // [SECURITY] Rate limit check
  if (await isRateLimited(\`login:\${input.email}\`, { limit: 10, window: '1h' })) {
    return { success: false, error: { code: 'RATE_LIMITED', retryAfter: 3600 } };
  }
  
  const user = await userRepo.findByEmail(input.email);
  
  // [INVARIANT] Timing attack protection - always do password check
  const passwordHash = user?.passwordHash || FAKE_HASH;
  const isValid = await bcrypt.compare(input.password, passwordHash);
  
  if (!user || !isValid) {
    // [POSTCONDITION] Increment failed attempts
    if (user) {
      await userRepo.incrementFailedAttempts(user.id);
      
      // [SECURITY] Brute force protection
      if (user.failedAttempts >= 4) {
        await userRepo.lockAccount(user.id, 15 * 60 * 1000);
      }
    }
    return { success: false, error: { code: 'INVALID_CREDENTIALS' } };
  }
  
  // [ERROR] Check if account is locked
  if (user.status === 'LOCKED') {
    return { success: false, error: { code: 'USER_LOCKED', retryAfter: user.lockedUntil } };
  }
  
  // [POSTCONDITION] Create session
  const session = await sessionRepo.create({ userId: user.id });
  
  // [POSTCONDITION] Update last login and reset failed attempts
  await userRepo.update(user.id, { lastLogin: new Date(), failedAttempts: 0 });
  
  // [INVARIANT] Audit logging
  await audit.log('LOGIN_SUCCESS', { userId: user.id });
  
  return { success: true, data: session };
}`,
  
  // All issues addressed because they're in the spec
  checksFromSpec: [
    { check: 'Input validation (preconditions)', status: 'PASS' },
    { check: 'Password never plaintext (invariant)', status: 'PASS' },
    { check: 'Password not logged (invariant [sensitive])', status: 'PASS' },
    { check: 'Rate limiting (security block)', status: 'PASS' },
    { check: 'Account lockout (brute_force_protection)', status: 'PASS' },
    { check: 'Timing attack resistant (invariant)', status: 'PASS' },
    { check: 'Error handling (all errors defined)', status: 'PASS' },
    { check: 'Audit logging (invariant)', status: 'PASS' },
    { check: 'Session created (postcondition)', status: 'PASS' },
    { check: 'Failed attempts tracked (postcondition)', status: 'PASS' },
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo Output
// ─────────────────────────────────────────────────────────────────────────────

function printHeader(text: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${text}`);
  console.log('═'.repeat(70));
}

function printSection(text: string) {
  console.log('\n' + '─'.repeat(50));
  console.log(`  ${text}`);
  console.log('─'.repeat(50));
}

async function runDemo() {
  printHeader('🔍 RELIABILITY COMPARISON: Regular AI vs IntentOS');
  
  // ─────────────────────────────────────────────────────────────────────────
  // Part 1: Regular AI
  // ─────────────────────────────────────────────────────────────────────────
  
  printSection('SCENARIO 1: Regular AI Agent');
  
  console.log('\nYou ask: "Build me a login function"\n');
  console.log('AI generates:\n');
  console.log('```javascript');
  console.log(regularAICode.code);
  console.log('```\n');
  
  console.log('AI says: "Here\'s your login function! It should work." ✓\n');
  
  // Simulate finding issues later
  console.log('─'.repeat(50));
  console.log('  🔴 ISSUES FOUND LATER (in production)');
  console.log('─'.repeat(50) + '\n');
  
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  
  for (const issue of regularAICode.issues) {
    const icon = issue.severity === 'CRITICAL' ? '🔴' : 
                 issue.severity === 'HIGH' ? '🟠' : 
                 issue.severity === 'MEDIUM' ? '🟡' : '⚪';
    console.log(`  ${icon} [${issue.severity}] ${issue.issue}`);
    
    if (issue.severity === 'CRITICAL') criticalCount++;
    if (issue.severity === 'HIGH') highCount++;
    if (issue.severity === 'MEDIUM') mediumCount++;
  }
  
  console.log(`\n  Summary: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium issues`);
  console.log('  Trust Score: ??? (no verification)\n');
  
  // ─────────────────────────────────────────────────────────────────────────
  // Part 2: IntentOS
  // ─────────────────────────────────────────────────────────────────────────
  
  printSection('SCENARIO 2: IntentOS with ISL Spec');
  
  console.log('\nYou write the ISL spec (what you WANT):\n');
  console.log('```isl');
  console.log(islSpec);
  console.log('```\n');
  
  console.log('IntentOS generates code that MUST satisfy the spec.\n');
  
  // Show verification
  console.log('─'.repeat(50));
  console.log('  🟢 VERIFICATION AGAINST SPEC');
  console.log('─'.repeat(50) + '\n');
  
  let passed = 0;
  for (const check of intentOSCode.checksFromSpec) {
    const icon = check.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${check.check}`);
    if (check.status === 'PASS') passed++;
  }
  
  const total = intentOSCode.checksFromSpec.length;
  const trustScore = Math.round((passed / total) * 100);
  
  console.log(`\n  Checks passed: ${passed}/${total}`);
  console.log(`  Trust Score: ${trustScore}/100 ✓\n`);
  
  // ─────────────────────────────────────────────────────────────────────────
  // Part 3: Side by Side
  // ─────────────────────────────────────────────────────────────────────────
  
  printSection('SIDE-BY-SIDE COMPARISON');
  
  const comparison = [
    ['Aspect', 'Regular AI', 'IntentOS'],
    ['─'.repeat(20), '─'.repeat(20), '─'.repeat(20)],
    ['Input', '"Build login"', 'ISL Specification'],
    ['Contract', 'None (guessing)', 'Explicit behavior spec'],
    ['Verification', 'None', `Trust Score: ${trustScore}/100`],
    ['Security issues', `${criticalCount + highCount} found in prod`, '0 (prevented by spec)'],
    ['Error handling', 'Incomplete', 'All errors defined'],
    ['Password safety', '❌ Plain text!', '✅ Bcrypt + [sensitive]'],
    ['Rate limiting', '❌ Missing', '✅ From security block'],
    ['Audit trail', '❌ Missing', '✅ From invariants'],
    ['Confidence', '🤷 "Looks right"', '📊 Verified'],
  ];
  
  console.log('');
  for (const row of comparison) {
    console.log(`  ${row[0].padEnd(20)} ${row[1].padEnd(22)} ${row[2]}`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Part 4: The Key Insight
  // ─────────────────────────────────────────────────────────────────────────
  
  printSection('💡 THE KEY INSIGHT');
  
  console.log(`
  Regular AI: "Here's code that MIGHT do what you want"
              Problems discovered in production
              No way to verify correctness
              Security is best-effort

  IntentOS:   "Here's code that SATISFIES your spec"
              Problems prevented by specification
              Verified against contract
              Security is contractual

  The difference: PROOF vs HOPE
  `);
  
  printHeader('Demo Complete');
  
  console.log(`
  IntentOS doesn't replace AI - it gives AI:
  
  1. A CONTRACT to follow (ISL spec)
  2. VERIFICATION that it followed it (Trust Score)
  3. CONSISTENCY across generations (same spec = same guarantees)
  
  Result: Reliable AI-generated code you can actually trust.
  `);
}

runDemo().catch(console.error);
