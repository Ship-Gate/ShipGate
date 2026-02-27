// ============================================================================
// Auth Domain Strategy
// Generates assertions for authentication/authorization behaviors
// ============================================================================

import type * as AST from '@isl-lang/parser';
import { BaseDomainStrategy } from './base';
import type {
  DomainType,
  GeneratedAssertion,
  StrategyContext,
} from '../types';

/**
 * Strategy for generating auth domain tests
 * 
 * Supported patterns:
 * - Invalid provider/email/password -> throws
 * - Token present in result
 * - Session expiry validation
 * - MFA requirements
 * - Account lockout after failed attempts
 */
export class AuthStrategy extends BaseDomainStrategy {
  domain: DomainType = 'auth';

  matches(behavior: AST.Behavior, domain: AST.Domain): boolean {
    // Check domain name
    if (this.domainNameMatches(domain, ['auth', 'identity', 'user', 'session'])) {
      return true;
    }

    // Check behavior name patterns
    if (this.behaviorNameMatches(behavior, [
      'login', 'logout', 'register', 'signup', 'signin',
      'authenticate', 'verify', 'mfa', 'password', 'token',
      'session', 'oauth', 'sso'
    ])) {
      return true;
    }

    // Check for auth-related input fields
    const inputFields = behavior.input.fields.map(f => f.name.name.toLowerCase());
    return inputFields.some(f => 
      ['email', 'password', 'token', 'provider', 'credential'].includes(f)
    );
  }

  generatePreconditionAssertions(
    precondition: AST.Expression,
    _behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const exprStr = this.compileExpr(precondition);

    // Pattern: input.email.length > 0
    if (this.isEmailValidation(precondition)) {
      assertions.push(this.supported(
        `expect(input.email).toBeDefined();\nexpect(input.email.length).toBeGreaterThan(0);`,
        'Email must be provided and non-empty',
        'auth.invalid_email'
      ));
      
      assertions.push(this.supported(
        `await expect(behavior(invalidEmailInput)).rejects.toMatchObject({ code: 'INVALID_EMAIL' });`,
        'Should throw for invalid email format',
        'auth.invalid_email'
      ));
    }

    // Pattern: input.password.length >= N
    if (this.isPasswordValidation(precondition)) {
      const minLength = this.extractMinLength(precondition);
      assertions.push(this.supported(
        `expect(input.password.length).toBeGreaterThanOrEqual(${minLength || 8});`,
        `Password must be at least ${minLength || 8} characters`,
        'auth.invalid_password'
      ));

      assertions.push(this.supported(
        `await expect(behavior({ ...validInput, password: 'short' })).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });`,
        'Should reject weak passwords',
        'auth.invalid_password'
      ));
    }

    // Pattern: User.exists(email: input.email) check (negated means user shouldn't exist)
    if (this.isUserExistsCheck(precondition)) {
      assertions.push(this.supported(
        `// Verify user doesn't already exist for registration\nconst existingUser = await User.findByEmail(input.email);\nexpect(existingUser).toBeNull();`,
        'User should not already exist',
        'auth.invalid_email'
      ));
    }

    // Pattern: Provider validation
    if (this.isProviderValidation(precondition)) {
      assertions.push(this.supported(
        `expect(['google', 'github', 'facebook', 'apple']).toContain(input.provider);`,
        'Provider must be valid OAuth provider',
        'auth.invalid_provider'
      ));

      assertions.push(this.supported(
        `await expect(behavior({ ...validInput, provider: 'invalid_provider' })).rejects.toMatchObject({ code: 'INVALID_PROVIDER' });`,
        'Should throw for invalid provider',
        'auth.invalid_provider'
      ));
    }

    // Generic precondition if no specific pattern matched
    if (assertions.length === 0) {
      assertions.push(this.supported(
        `expect(${exprStr}).toBe(true);`,
        `Precondition: ${exprStr}`,
        'generic.precondition'
      ));
    }

    return assertions;
  }

  generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    _behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const condition = this.getConditionName(postcondition.condition);

    for (const predicate of postcondition.predicates) {
      // Pattern: result has token/session
      if (this.isTokenPresent(predicate)) {
        assertions.push(this.supported(
          `expect(result.access_token).toBeDefined();\nexpect(typeof result.access_token).toBe('string');\nexpect(result.access_token.length).toBeGreaterThan(0);`,
          'Access token should be present and valid',
          'auth.token_present'
        ));

        if (this.hasRefreshToken(predicate)) {
          assertions.push(this.supported(
            `expect(result.refresh_token).toBeDefined();`,
            'Refresh token should be present',
            'auth.token_present'
          ));
        }
      }

      // Pattern: Session exists and is valid
      if (this.isSessionCreated(predicate)) {
        assertions.push(this.supported(
          `expect(result.session).toBeDefined();\nexpect(result.session.id).toBeDefined();\nexpect(result.session.revoked).toBe(false);`,
          'Session should be created and active',
          'auth.session_expiry'
        ));

        assertions.push(this.supported(
          `expect(new Date(result.session.expires_at).getTime()).toBeGreaterThan(Date.now());`,
          'Session should not be expired',
          'auth.session_expiry'
        ));
      }

      // Pattern: MFA required
      if (this.isMfaRequired(predicate)) {
        assertions.push(this.supported(
          `if (user.mfa_enabled) {\n  expect(result.requires_mfa).toBe(true);\n}`,
          'MFA should be required when enabled',
          'auth.mfa_required'
        ));
      }

      // Pattern: Account locked check
      if (this.isAccountLocked(predicate)) {
        assertions.push(this.supported(
          `const user = await User.findByEmail(input.email);\nif (user.failed_login_attempts >= 10) {\n  expect(result.success).toBe(false);\n  expect(result.error).toBe('ACCOUNT_LOCKED');\n}`,
          'Account should be locked after max failed attempts',
          'auth.account_locked'
        ));
      }

      // Pattern: User status update
      if (this.isUserStatusUpdate(predicate)) {
        assertions.push(this.supported(
          `const updatedUser = await User.findById(result.id);\nexpect(updatedUser.status).toBe('ACTIVE');`,
          'User status should be updated',
          'generic.postcondition'
        ));
      }

      // Pattern: Failed login attempts increment
      if (this.isFailedAttemptsIncrement(predicate)) {
        assertions.push(this.supported(
          `const userAfter = await User.findByEmail(input.email);\nexpect(userAfter.failed_login_attempts).toBe(userBefore.failed_login_attempts + 1);`,
          'Failed attempts should increment on invalid credentials',
          'auth.account_locked'
        ));
      }

      // Pattern: Audit log created
      if (this.isAuditLogCreated(predicate)) {
        const action = this.extractAuditAction(predicate);
        assertions.push(this.supported(
          `const auditLog = await AuditLog.findLatest({ action: '${action}' });\nexpect(auditLog).toBeDefined();\nexpect(auditLog.success).toBe(${condition === 'success'});`,
          `Audit log for ${action} should be created`,
          'generic.postcondition'
        ));
      }
    }

    // If no specific patterns matched, generate generic assertions
    if (assertions.length === 0) {
      for (const predicate of postcondition.predicates) {
        const exprStr = this.compileExpr(predicate);
        assertions.push(this.supported(
          `expect(${exprStr}).toBe(true);`,
          `Postcondition (${condition}): ${this.truncate(exprStr, 50)}`,
          'generic.postcondition'
        ));
      }
    }

    return assertions;
  }

  generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    _context: StrategyContext
  ): GeneratedAssertion[] {
    const assertions: GeneratedAssertion[] = [];
    const errorName = errorSpec.name.name;
    const when = errorSpec.when?.value || 'specific conditions';

    switch (errorName) {
      case 'INVALID_EMAIL':
        assertions.push(this.supported(
          `const invalidEmailInput = { ...validInput, email: 'not-an-email' };\nconst result = await ${behavior.name.name}(invalidEmailInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_EMAIL');\nexpect(result.retriable).toBe(false);`,
          'Should return INVALID_EMAIL for malformed email',
          'auth.invalid_email'
        ));
        break;

      case 'WEAK_PASSWORD':
        assertions.push(this.supported(
          `const weakPasswordInput = { ...validInput, password: '123' };\nconst result = await ${behavior.name.name}(weakPasswordInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('WEAK_PASSWORD');\nexpect(result.retriable).toBe(true);`,
          'Should return WEAK_PASSWORD for insufficient password',
          'auth.invalid_password'
        ));
        break;

      case 'INVALID_CREDENTIALS':
        assertions.push(this.supported(
          `const wrongPasswordInput = { ...validInput, password: 'wrong_password' };\nconst result = await ${behavior.name.name}(wrongPasswordInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('INVALID_CREDENTIALS');\nexpect(result.retriable).toBe(true);`,
          'Should return INVALID_CREDENTIALS for wrong password',
          'auth.invalid_password'
        ));
        break;

      case 'ACCOUNT_LOCKED':
        assertions.push(this.supported(
          `// After 10 failed attempts\nconst result = await ${behavior.name.name}(validInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('ACCOUNT_LOCKED');\nexpect(result.retriable).toBe(true);\nexpect(result.retryAfter).toBeDefined();`,
          'Should return ACCOUNT_LOCKED after max failed attempts',
          'auth.account_locked'
        ));
        break;

      case 'INVALID_TOKEN':
      case 'TOKEN_EXPIRED':
        assertions.push(this.supported(
          `const invalidTokenInput = { token: 'invalid_or_expired_token' };\nconst result = await ${behavior.name.name}(invalidTokenInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(false);`,
          `Should return ${errorName} for invalid/expired token`,
          'auth.token_present'
        ));
        break;

      case 'SESSION_NOT_FOUND':
        assertions.push(this.supported(
          `const nonExistentSession = { session_id: '00000000-0000-0000-0000-000000000000' };\nconst result = await ${behavior.name.name}(nonExistentSession);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('SESSION_NOT_FOUND');`,
          'Should return SESSION_NOT_FOUND for non-existent session',
          'auth.session_expiry'
        ));
        break;

      case 'EMAIL_NOT_VERIFIED':
        assertions.push(this.supported(
          `// Login with unverified email\nconst result = await ${behavior.name.name}(unverifiedUserInput);\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('EMAIL_NOT_VERIFIED');`,
          'Should return EMAIL_NOT_VERIFIED for unverified users',
          'auth.invalid_email'
        ));
        break;

      default:
        assertions.push(this.supported(
          `const result = await ${behavior.name.name}(inputFor${errorName}());\nexpect(result.success).toBe(false);\nexpect(result.error).toBe('${errorName}');\nexpect(result.retriable).toBe(${errorSpec.retriable});`,
          `Should return ${errorName} when ${when}`,
          'generic.postcondition'
        ));
    }

    return assertions;
  }

  // ============================================================================
  // PATTERN DETECTION HELPERS
  // ============================================================================

  private isEmailValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('email') && (str.includes('length') || str.includes('valid') || str.includes('format'));
  }

  private isPasswordValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('password') && str.includes('length');
  }

  private extractMinLength(expr: AST.Expression): number | null {
    if (expr.kind === 'BinaryExpr' && expr.right.kind === 'NumberLiteral') {
      return expr.right.value;
    }
    return null;
  }

  private isUserExistsCheck(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('user') && str.includes('exists');
  }

  private isProviderValidation(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('provider');
  }

  private isTokenPresent(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('token') || str.includes('access_token');
  }

  private hasRefreshToken(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('refresh_token');
  }

  private isSessionCreated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('session') && (str.includes('exists') || str.includes('id'));
  }

  private isMfaRequired(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('mfa') || str.includes('requires_mfa');
  }

  private isAccountLocked(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('locked') || str.includes('failed_login');
  }

  private isUserStatusUpdate(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('status') && (str.includes('active') || str.includes('pending'));
  }

  private isFailedAttemptsIncrement(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('failed_login_attempts') && str.includes('+');
  }

  private isAuditLogCreated(expr: AST.Expression): boolean {
    const str = this.compileExpr(expr).toLowerCase();
    return str.includes('auditlog') && str.includes('exists');
  }

  private extractAuditAction(expr: AST.Expression): string {
    const str = this.compileExpr(expr);
    const match = str.match(/action:\s*['"](\w+)['"]/);
    return match?.[1] ?? 'ACTION';
  }

  private getConditionName(condition: AST.Identifier | 'success' | 'any_error'): string {
    if (condition === 'success') return 'success';
    if (condition === 'any_error') return 'any error';
    return condition.name;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  }
}
