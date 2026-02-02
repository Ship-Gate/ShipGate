# @isl-lang/security-policies

Security policy pack and lint rules for ISL (Intent Specification Language) specifications. Enforces safe defaults for authentication, payments, webhooks, and data protection.

## Features

### Policy Pack

The security policy pack enforces:

- **No PII in Logs** - Detects PII fields (email, phone, SSN, etc.) that may be logged
- **Secrets Redaction** - Ensures passwords, API keys, and tokens have proper annotations and redaction invariants
- **Webhook Signature Required** - Webhook handlers must verify request signatures
- **Auth Rate Limiting** - Authentication endpoints must have rate limiting

### Lint Rules

Lint rules with auto-fix suggestions for:

- **Auth Behaviors** - Login, register, password reset must have rate limiting, audit logging, and password safety invariants
- **Payment Behaviors** - Require authentication, rate limiting, amount validation, and secure card handling
- **Webhook Behaviors** - Require signature verification, idempotency handling, and replay protection

## Installation

```bash
pnpm add @isl-lang/security-policies
```

## Usage

### Full Security Check

```typescript
import { checkSecurity } from '@isl-lang/security-policies';

const result = checkSecurity(domain);

if (!result.passed) {
  console.log('Security issues found:');
  for (const finding of result.allFindings) {
    console.log(`${finding.severity}: ${finding.title}`);
    console.log(`  ${finding.message}`);
    if (finding.suggestion) {
      console.log(`  Suggestion: ${finding.suggestion}`);
    }
  }
}
```

### Policy-Only Check

```typescript
import { checkPolicies } from '@isl-lang/security-policies';

const result = checkPolicies(domain);
console.log(`Score: ${result.score}/100`);
```

### Lint-Only Check

```typescript
import { lint } from '@isl-lang/security-policies';

const result = lint(domain);
console.log(`Errors: ${result.summary.errors}`);
console.log(`Warnings: ${result.summary.warnings}`);
console.log(`Fixable: ${result.fixableCount}`);
```

### Auto-Fix Generation

```typescript
import { 
  lint, 
  createAutofixGenerator 
} from '@isl-lang/security-policies';

const result = lint(domain);
const generator = createAutofixGenerator();

for (const finding of result.findings) {
  if (finding.autofix) {
    const fix = generator.generateEdits(finding, sourceText);
    console.log(fix.preview);
  }
}
```

### Custom Options

```typescript
import { createSecurityChecker } from '@isl-lang/security-policies';

const checker = createSecurityChecker({
  // Only check specific categories
  enabledPolicies: ['pii-protection', 'secrets-management'],
  
  // Only report warnings and errors
  minSeverity: 'warning',
  
  // Fail only on errors
  failOnSeverity: 'error',
  
  // Generate autofixes
  generateAutofixes: true,
});

const result = checker.check(domain);
```

## Policy Rules

### PII Protection

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| SEC-PII-001 | No PII in Logs | error | PII fields must be excluded from logs |
| SEC-PII-002 | No PII Exposure | warning | PII should not be in conditions that may be logged |

### Secrets Management

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| SEC-SECRET-001 | Secrets Must Be Annotated | error | Secret fields need [secret] annotation |
| SEC-SECRET-002 | Secrets Redaction | error | Secrets need never_appears_in invariants |
| SEC-SECRET-003 | Secrets Not in Output | error | Secrets must not appear in behavior output |

### Webhook Security

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| SEC-WEBHOOK-001 | Signature Required | error | Webhooks must verify signatures |
| SEC-WEBHOOK-002 | Idempotency | warning | Webhooks should be idempotent |
| SEC-WEBHOOK-003 | Replay Protection | warning | Webhooks should validate timestamps |

### Rate Limiting

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| SEC-RATE-001 | Auth Rate Limit | error | Auth endpoints must have rate limiting |
| SEC-RATE-002 | Strict Auth Limits | warning | Auth rate limits should be < 20/min |
| SEC-RATE-003 | Sensitive Operations | warning | Payments/transfers need rate limiting |
| SEC-RATE-004 | Anonymous IP Limit | warning | Anonymous endpoints should limit by IP |

## Lint Rules

### Auth Constraints

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| LINT-AUTH-001 | Auth Minimum Constraints | error | Rate limit, audit logging, password safety |
| LINT-AUTH-002 | Session Security | warning | Session behaviors need auth requirement |

### Payment Constraints

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| LINT-PAY-001 | Payment Minimum Constraints | error | Auth, rate limit, amount validation |
| LINT-PAY-002 | Fraud Check | warning | Payments should have fraud detection |
| LINT-PAY-003 | PCI Compliance | warning | Card handling needs PCI declaration |

### Webhook Constraints

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| LINT-WEBHOOK-001 | Webhook Minimum Constraints | error | Signature, idempotency, replay protection |
| LINT-WEBHOOK-002 | Error Handling | warning | Define specific error types |
| LINT-WEBHOOK-003 | Response Time | info | Should respond quickly |

## Auto-Fix Format

Findings include auto-fix suggestions as AST patches:

```typescript
interface ASTFix {
  description: string;      // Human-readable description
  operation: 'add' | 'remove' | 'modify' | 'wrap';
  targetKind: string;       // AST node kind to modify
  location: SourceLocation;
  patch: {
    text?: string;          // ISL code to insert
    position?: 'before' | 'after' | 'inside' | 'replace';
  };
}
```

## Example Output

```
# Security Analysis Report

**Overall Status:** ❌ FAILED
**Duration:** 12.34ms
**Fixable Issues:** 8

## Summary

### Policy Checks
- Score: 65/100
- Findings: 5

### Lint Checks
- Errors: 3
- Warnings: 4
- Info: 1

## All Findings

### Errors

🔴 **Auth Endpoint Missing Rate Limit** (SEC-RATE-001)

> Authentication behavior 'Login' does not have rate limiting

- **Location:** auth.isl:15
- **Behavior:** Login
- **Suggestion:** Add rate_limit in security block (recommended: 5 per ip_address)
- **Auto-fix available:** Yes
```

## License

MIT
