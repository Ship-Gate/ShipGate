/**
 * Tests for intent/no-pii-logging Semantic Rule
 * 
 * Verifies that the rule correctly:
 * 1. Forbids all console.* in production code
 * 2. Forbids logging raw request body
 * 3. Forbids logging email/token/password values
 * 4. Allows safe logger wrappers: safeLog()/redact()
 * 5. Detects PII in audit metadata
 * 
 * @module @isl-lang/pipeline/tests
 */

import { describe, it, expect } from 'vitest';
import { SEMANTIC_RULES, runSemanticRules, type SemanticViolation } from '../src/semantic-rules';

// Get the no-pii-logging rule
const noPiiLoggingRule = SEMANTIC_RULES.find(r => r.id === 'intent/no-pii-logging')!;

describe('intent/no-pii-logging', () => {
  // =========================================================================
  // Test Helper
  // =========================================================================
  
  function checkCode(code: string, file = 'api/route.ts'): SemanticViolation[] {
    return noPiiLoggingRule.check(code, file);
  }

  // =========================================================================
  // RULE 1: Forbid console.* in production code
  // =========================================================================
  
  describe('Rule 1: Forbid console.* in production code', () => {
    it('should flag console.log', () => {
      const code = `
        export async function handler(req: Request) {
          console.log('Processing request');
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.log'))).toBe(true);
    });

    it('should flag console.error', () => {
      const code = `
        export async function handler(req: Request) {
          console.error('Something went wrong');
          return Response.json({ error: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.error'))).toBe(true);
    });

    it('should flag console.warn', () => {
      const code = `
        export async function handler(req: Request) {
          console.warn('Deprecation warning');
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.warn'))).toBe(true);
    });

    it('should flag console.debug', () => {
      const code = `
        export async function handler(req: Request) {
          console.debug('Debug info');
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.debug'))).toBe(true);
    });

    it('should flag console.info', () => {
      const code = `
        export async function handler(req: Request) {
          console.info('Info message');
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.info'))).toBe(true);
    });

    it('should flag console.trace', () => {
      const code = `
        export async function handler(req: Request) {
          console.trace('Stack trace');
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.trace'))).toBe(true);
    });

    it('should flag console.dir', () => {
      const code = `
        export async function handler(req: Request) {
          console.dir(someObject);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.dir'))).toBe(true);
    });

    it('should flag console.table', () => {
      const code = `
        export async function handler(req: Request) {
          console.table(data);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('console.table'))).toBe(true);
    });

    it('should skip test files', () => {
      const code = `console.log('Testing');`;
      const violations = checkCode(code, 'api/route.test.ts');
      expect(violations.length).toBe(0);
    });

    it('should skip spec files', () => {
      const code = `console.log('Testing');`;
      const violations = checkCode(code, 'api/route.spec.ts');
      expect(violations.length).toBe(0);
    });

    it('should skip .d.ts files', () => {
      const code = `console.log('Testing');`;
      const violations = checkCode(code, 'types/index.d.ts');
      expect(violations.length).toBe(0);
    });

    it('should provide correct auto-fix suggestion', () => {
      const code = `console.log('message');`;
      const violations = checkCode(code);
      expect(violations[0]?.fix).toContain('safeError');
    });
  });

  // =========================================================================
  // RULE 2: Forbid logging raw request body
  // =========================================================================
  
  describe('Rule 2: Forbid logging raw request body', () => {
    it('should flag console.log with req.body', () => {
      const code = `
        export async function handler(req: Request) {
          const body = await req.json();
          console.log('Request:', req.body);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('request body'))).toBe(true);
      expect(violations.some(v => v.severity === 'critical')).toBe(true);
    });

    it('should flag console.error with request.body', () => {
      const code = `
        export async function handler(request: Request) {
          console.error('Failed:', request.body);
          return Response.json({ error: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('request body'))).toBe(true);
    });

    it('should flag logger.info with requestBody', () => {
      const code = `
        export async function handler(req: Request) {
          logger.info('Received', { data: requestBody });
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('request body'))).toBe(true);
    });

    it('should flag log.debug with request.body', () => {
      const code = `
        export async function handler(req: Request) {
          log.debug('Debug', request.body);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('request body'))).toBe(true);
    });

    it('should allow redact(req.body)', () => {
      const code = `
        export async function handler(req: Request) {
          logger.info('Request', redact(req.body));
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('request body'))).toBe(false);
    });

    it('should allow safeLog with req.body', () => {
      const code = `
        export async function handler(req: Request) {
          safeLog('Request received', req.body);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('request body'))).toBe(false);
    });
  });

  // =========================================================================
  // RULE 3: Forbid logging request headers
  // =========================================================================
  
  describe('Rule 3: Forbid logging request headers', () => {
    it('should flag logging req.headers', () => {
      const code = `
        export async function handler(req: Request) {
          console.log('Headers:', req.headers);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('headers'))).toBe(true);
    });

    it('should flag logging request.headers', () => {
      const code = `
        export async function handler(request: Request) {
          logger.debug('Request headers', request.headers);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('headers'))).toBe(true);
    });

    it('should flag logging authorization header specifically', () => {
      const code = `
        export async function handler(req: Request) {
          console.log(headers['authorization']);
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => v.message.includes('headers') || v.message.includes('Authorization'))).toBe(true);
    });
  });

  // =========================================================================
  // RULE 4: Detect PII identifiers in logging
  // =========================================================================
  
  describe('Rule 4: Detect PII identifiers in logging', () => {
    // Authentication PII
    describe('Authentication PII', () => {
      it('should flag logging password', () => {
        const code = `console.log('User password:', password);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('password'))).toBe(true);
      });

      it('should flag logging token', () => {
        const code = `logger.info('Token:', accessToken);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('token'))).toBe(true);
      });

      it('should flag logging secret', () => {
        const code = `console.log('Secret:', apiSecret);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('secret'))).toBe(true);
      });

      it('should flag logging credential', () => {
        const code = `console.log('Credentials:', credential);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('credential'))).toBe(true);
      });

      it('should flag logging apiKey', () => {
        const code = `console.log('API Key:', apiKey);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('apiKey'))).toBe(true);
      });

      it('should flag logging authorization', () => {
        const code = `console.log('Auth:', authorization);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('authorization'))).toBe(true);
      });
    });

    // Personal PII
    describe('Personal PII', () => {
      it('should flag logging email', () => {
        const code = `console.log('Email:', email);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('email'))).toBe(true);
      });

      it('should flag logging SSN', () => {
        const code = `console.log('SSN:', ssn);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('ssn'))).toBe(true);
      });

      it('should flag logging phone', () => {
        const code = `console.log('Phone:', phoneNumber);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('phone'))).toBe(true);
      });

      it('should flag logging dateOfBirth', () => {
        const code = `console.log('DOB:', dateOfBirth);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('dateOfBirth'))).toBe(true);
      });

      it('should flag logging passport', () => {
        const code = `console.log('Passport:', passportNumber);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('passport'))).toBe(true);
      });
    });

    // Financial PII
    describe('Financial PII', () => {
      it('should flag logging creditCard', () => {
        const code = `console.log('Card:', creditCard);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('creditCard'))).toBe(true);
      });

      it('should flag logging CVV', () => {
        const code = `console.log('CVV:', cvv);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('cvv'))).toBe(true);
      });

      it('should flag logging bankAccount', () => {
        const code = `console.log('Account:', bankAccount);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('bankAccount'))).toBe(true);
      });
    });

    // Network PII
    describe('Network PII', () => {
      it('should flag logging ipAddress', () => {
        const code = `console.log('IP:', ipAddress);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('ipAddress'))).toBe(true);
      });

      it('should flag logging userAgent', () => {
        const code = `console.log('UA:', userAgent);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('userAgent'))).toBe(true);
      });

      it('should flag logging location', () => {
        const code = `console.log('Location:', location);`;
        const violations = checkCode(code);
        expect(violations.some(v => v.message.includes('location'))).toBe(true);
      });
    });
  });

  // =========================================================================
  // RULE 5: Allow safe wrappers
  // =========================================================================
  
  describe('Rule 5: Allow safe wrappers', () => {
    it('should allow safeLog()', () => {
      const code = `
        export async function handler(req: Request) {
          safeLog('User action', { userId: user.id, email: user.email });
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      // safeLog itself is safe, so should not flag the email inside it
      const piiViolations = violations.filter(v => 
        v.message.includes('email') && !v.message.includes('console')
      );
      expect(piiViolations.length).toBe(0);
    });

    it('should allow safeLogger.*', () => {
      const code = `
        export async function handler(req: Request) {
          safeLogger.info('Processing', { email: user.email });
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.filter(v => v.message.includes('email')).length).toBe(0);
    });

    it('should allow redact()', () => {
      const code = `
        export async function handler(req: Request) {
          logger.info('User data', redact({ email, password }));
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      const directPiiViolations = violations.filter(v => 
        v.message.includes('PII') && v.severity === 'critical'
      );
      // redact() should suppress PII violations
      expect(directPiiViolations.length).toBe(0);
    });

    it('should allow maskPii()', () => {
      const code = `
        export async function handler(req: Request) {
          logger.info('Actor', maskPii(actor));
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.filter(v => v.message.includes('PII')).length).toBe(0);
    });

    it('should allow sanitize()', () => {
      const code = `
        export async function handler(req: Request) {
          logger.info('Data', sanitize(userData));
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.filter(v => v.message.includes('PII')).length).toBe(0);
    });

    it('should allow safeError()', () => {
      const code = `
        export async function handler(req: Request) {
          try {
            await doSomething();
          } catch (err) {
            logger.error('Failed', safeError(err));
          }
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      // safeError wrapper should not cause PII violations
      expect(violations.filter(v => v.message.includes('PII')).length).toBe(0);
    });
  });

  // =========================================================================
  // RULE 6: Check audit metadata
  // =========================================================================
  
  describe('Rule 6: Check audit metadata for PII', () => {
    it('should flag raw email in audit payload', () => {
      const code = `
        export async function handler(req: Request) {
          await audit({
            action: 'user.login',
            success: true,
            email: user.email,
          });
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('audit') && v.message.includes('email')
      )).toBe(true);
    });

    it('should flag raw password in audit payload', () => {
      const code = `
        export async function handler(req: Request) {
          await audit({
            action: 'password.change',
            success: true,
            password: newPassword,
          });
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('audit') && v.message.includes('password')
      )).toBe(true);
    });

    it('should allow masked PII in audit payload', () => {
      const code = `
        export async function handler(req: Request) {
          await audit({
            action: 'user.login',
            success: true,
            email: maskEmail(user.email),
          });
          return Response.json({ ok: true });
        }
      `;
      const violations = checkCode(code);
      expect(violations.filter(v => 
        v.message.includes('audit') && v.message.includes('email')
      ).length).toBe(0);
    });
  });

  // =========================================================================
  // Integration: runSemanticRules
  // =========================================================================
  
  describe('Integration: runSemanticRules', () => {
    it('should find violations across multiple files', () => {
      const codeMap = new Map<string, string>([
        ['api/auth/login.ts', `
          export async function POST(req: Request) {
            console.log('Login attempt', req.body);
            return Response.json({ ok: true });
          }
        `],
        ['api/users/route.ts', `
          export async function GET(req: Request) {
            console.error('User email:', user.email);
            return Response.json({ ok: true });
          }
        `],
      ]);

      const violations = runSemanticRules(codeMap);
      const piiViolations = violations.filter(v => v.ruleId === 'intent/no-pii-logging');
      
      expect(piiViolations.length).toBeGreaterThan(0);
      expect(piiViolations.some(v => v.file.includes('login.ts'))).toBe(true);
      expect(piiViolations.some(v => v.file.includes('users'))).toBe(true);
    });

    it('should skip test files in bulk run', () => {
      const codeMap = new Map<string, string>([
        ['api/route.ts', `console.log('prod');`],
        ['api/route.test.ts', `console.log('test');`],
        ['api/route.spec.ts', `console.log('spec');`],
      ]);

      const violations = runSemanticRules(codeMap);
      const piiViolations = violations.filter(v => v.ruleId === 'intent/no-pii-logging');
      
      expect(piiViolations.length).toBe(1);
      expect(piiViolations[0].file).toBe('api/route.ts');
    });
  });

  // =========================================================================
  // Severity tests
  // =========================================================================
  
  describe('Severity levels', () => {
    it('should mark password logging as critical', () => {
      const code = `console.log('Password:', password);`;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('password') && v.severity === 'critical'
      )).toBe(true);
    });

    it('should mark token logging as critical', () => {
      const code = `console.log('Token:', accessToken);`;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('token') && v.severity === 'critical'
      )).toBe(true);
    });

    it('should mark email logging as high', () => {
      const code = `logger.info('Email:', email);`;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('email') && v.severity === 'high'
      )).toBe(true);
    });

    it('should mark IP address logging as medium', () => {
      const code = `logger.info('IP:', ipAddress);`;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('ipAddress') && v.severity === 'medium'
      )).toBe(true);
    });

    it('should mark request body logging as critical', () => {
      const code = `console.log('Body:', req.body);`;
      const violations = checkCode(code);
      expect(violations.some(v => 
        v.message.includes('request body') && v.severity === 'critical'
      )).toBe(true);
    });
  });

  // =========================================================================
  // Auto-fix suggestions
  // =========================================================================
  
  describe('Auto-fix suggestions', () => {
    it('should suggest logger replacement for console.log', () => {
      const code = `console.log('message');`;
      const violations = checkCode(code);
      expect(violations[0]?.fix).toMatch(/logger\.log|safeError/);
    });

    it('should suggest redact for request body', () => {
      const code = `console.log('Body:', req.body);`;
      const violations = checkCode(code);
      expect(violations.some(v => v.fix?.includes('redact'))).toBe(true);
    });

    it('should suggest safe wrapper for PII fields', () => {
      const code = `console.log('Email:', email);`;
      const violations = checkCode(code);
      expect(violations.some(v => v.fix?.includes('redact'))).toBe(true);
    });
  });
});
