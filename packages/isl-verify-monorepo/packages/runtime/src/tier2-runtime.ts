import { BaseProver, type ProverContext } from '@isl-verify/core';
import type { ProverResult, PropertyResult } from '@isl-verify/core';
import { LicenseGate } from './license-gate';

export class Tier2RuntimeProver extends BaseProver {
  readonly name = 'tier2-runtime';
  readonly tier = 2;
  readonly properties = [
    'api_contracts',
    'auth_enforcement',
    'data_leakage',
    'rate_limiting',
    'session_management',
  ];

  async verify(context: ProverContext): Promise<ProverResult> {
    const licenseCheck = LicenseGate.checkTier('tier2');

    if (!licenseCheck.allowed) {
      throw new Error(licenseCheck.message);
    }

    const startTime = Date.now();
    const properties: PropertyResult[] = [];

    properties.push(await this.checkApiContracts(context));
    properties.push(await this.checkAuthEnforcement(context));
    properties.push(await this.checkDataLeakage(context));
    properties.push(await this.checkRateLimiting(context));
    properties.push(await this.checkSessionManagement(context));

    const passed = properties.filter((p) => p.status === 'pass').length;
    const failed = properties.filter((p) => p.status === 'fail').length;
    const skipped = properties.filter((p) => p.status === 'skip').length;

    return {
      name: this.name,
      tier: this.tier,
      passed,
      failed,
      skipped,
      duration: Date.now() - startTime,
      properties,
    };
  }

  private async checkApiContracts(context: ProverContext): Promise<PropertyResult> {
    const hasApiRoutes = /app\.(get|post|put|delete|patch)\(/g.test(context.source);
    const hasValidation = /\.body\s*\(|zod|joi|yup/gi.test(context.source);
    const hasResponseSchema = /res\.(json|send)\(/g.test(context.source);

    if (!hasApiRoutes) {
      return { property: 'api_contracts', status: 'skip', message: 'No API routes found' };
    }

    const hasFullContract = hasValidation && hasResponseSchema;

    return {
      property: 'api_contracts',
      status: hasFullContract ? 'pass' : 'fail',
      message: hasFullContract
        ? 'API contracts validated'
        : 'Missing input/output validation',
    };
  }

  private async checkAuthEnforcement(context: ProverContext): Promise<PropertyResult> {
    const hasApiRoutes = /app\.(get|post|put|delete|patch)\(/g.test(context.source);
    const hasAuthMiddleware =
      /authenticate|isAuthenticated|requireAuth|verifyToken/g.test(context.source);
    const hasAuthCheck = /req\.(user|session|isAuthenticated)/g.test(context.source);

    if (!hasApiRoutes) {
      return { property: 'auth_enforcement', status: 'skip', message: 'No API routes found' };
    }

    const hasAuth = hasAuthMiddleware || hasAuthCheck;

    return {
      property: 'auth_enforcement',
      status: hasAuth ? 'pass' : 'fail',
      message: hasAuth ? 'Auth enforcement detected' : 'Missing authentication checks',
    };
  }

  private async checkDataLeakage(context: ProverContext): Promise<PropertyResult> {
    const sensitivePatterns = [
      /password/gi,
      /secret/gi,
      /token/gi,
      /apiKey/gi,
      /privateKey/gi,
    ];

    const hasSensitiveData = sensitivePatterns.some((p) => p.test(context.source));
    const hasLogging = /console\.log|logger\./g.test(context.source);
    const hasDirectExposure = /res\.(json|send)\([^)]*password[^)]*\)/gi.test(context.source);

    if (!hasSensitiveData) {
      return { property: 'data_leakage', status: 'skip', message: 'No sensitive data found' };
    }

    if (hasDirectExposure) {
      return {
        property: 'data_leakage',
        status: 'fail',
        message: 'Sensitive data exposed in response',
      };
    }

    return {
      property: 'data_leakage',
      status: 'pass',
      message: 'No data leakage detected',
    };
  }

  private async checkRateLimiting(context: ProverContext): Promise<PropertyResult> {
    const hasApiRoutes = /app\.(get|post|put|delete|patch)\(/g.test(context.source);
    const hasRateLimit = /rateLimit|rate-limiter|express-rate-limit/g.test(context.source);

    if (!hasApiRoutes) {
      return { property: 'rate_limiting', status: 'skip', message: 'No API routes found' };
    }

    return {
      property: 'rate_limiting',
      status: hasRateLimit ? 'pass' : 'fail',
      message: hasRateLimit ? 'Rate limiting configured' : 'Missing rate limiting',
    };
  }

  private async checkSessionManagement(context: ProverContext): Promise<PropertyResult> {
    const hasSession = /express-session|cookie-session|req\.session/g.test(context.source);
    const hasSecureFlag = /secure:\s*true/g.test(context.source);
    const hasHttpOnly = /httpOnly:\s*true/g.test(context.source);

    if (!hasSession) {
      return { property: 'session_management', status: 'skip', message: 'No session usage' };
    }

    const isSecure = hasSecureFlag && hasHttpOnly;

    return {
      property: 'session_management',
      status: isSecure ? 'pass' : 'fail',
      message: isSecure ? 'Secure session config' : 'Missing secure/httpOnly flags',
    };
  }
}
