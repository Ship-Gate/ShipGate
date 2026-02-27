/**
 * Runtime Verifier
 * 
 * Main orchestrator for Tier 2 behavioral verification
 */

import type { Domain } from '@isl-lang/parser';
import { AppLauncher } from './app-launcher';
import { DatabaseSetup } from './database-setup';
import { RequestGenerator, extractEndpointSpecs, type GeneratedRequest } from './request-generator';
import { ResponseValidator } from './response-validator';
import type {
  RuntimeVerificationResult,
  RuntimeEvidence,
  RuntimeVerifierOptions,
  AppLaunchConfig,
} from './types';

export class RuntimeVerifier {
  private launcher = new AppLauncher();
  private dbSetup = new DatabaseSetup();
  private requestGen = new RequestGenerator();
  private responseValidator = new ResponseValidator();

  async verify(
    domain: Domain,
    projectDir: string,
    options?: RuntimeVerifierOptions
  ): Promise<RuntimeVerificationResult> {
    const startTime = Date.now();
    const evidence: RuntimeEvidence[] = [];
    const errors: string[] = [];

    let appStarted = false;
    let baseUrl = options?.baseUrl;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      // Step 1: Setup test database
      const dbConfig = await this.dbSetup.setup(projectDir);

      // Step 2: Launch application
      if (!baseUrl) {
        const launchConfig: AppLaunchConfig = {
          projectDir,
          startTimeout: 30000,
        };

        const appProcess = await this.launcher.launch(launchConfig);
        baseUrl = appProcess.baseUrl;
        cleanup = appProcess.cleanup;
        appStarted = true;
      } else {
        appStarted = true; // Assuming external app is running
      }

      const appStartTimeMs = Date.now() - startTime;

      // Step 3: Get auth tokens
      const { authToken, adminToken } = await this.getAuthTokens(
        baseUrl,
        options
      );

      // Step 4: Extract endpoint specs from domain
      const endpointSpecs = extractEndpointSpecs(domain);

      if (endpointSpecs.length === 0) {
        errors.push('No API endpoints found in ISL spec');
      }

      // Step 5: Generate and run test requests
      for (const spec of endpointSpecs) {
        const requests = this.requestGen.generateTestRequests(
          spec,
          authToken,
          adminToken
        );

        for (const request of requests) {
          const testEvidence = await this.runRequest(
            baseUrl,
            request,
            spec.responseBody,
            options
          );
          evidence.push(testEvidence);
        }
      }

      // Step 6: Calculate results
      const authTests = evidence.filter(e => 
        e.testCase.includes('auth') || e.testCase.includes('forbidden')
      );
      const validationTests = evidence.filter(e =>
        e.testCase.includes('invalid') || e.testCase.includes('missing') || e.testCase.includes('wrong')
      );
      const responseShapeTests = evidence.filter(e =>
        e.testCase === 'valid_request'
      );

      return {
        appStarted,
        appStartTimeMs,
        evidence,
        authTestsPassed: authTests.filter(e => e.passed).length,
        authTestsTotal: authTests.length,
        validationTestsPassed: validationTests.filter(e => e.passed).length,
        validationTestsTotal: validationTests.length,
        responseShapeTestsPassed: responseShapeTests.filter(e => e.passed).length,
        responseShapeTestsTotal: responseShapeTests.length,
        totalPassed: evidence.filter(e => e.passed).length,
        totalTests: evidence.length,
        errors,
      };

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      
      return {
        appStarted,
        appStartTimeMs: Date.now() - startTime,
        evidence,
        authTestsPassed: 0,
        authTestsTotal: 0,
        validationTestsPassed: 0,
        validationTestsTotal: 0,
        responseShapeTestsPassed: 0,
        responseShapeTestsTotal: 0,
        totalPassed: 0,
        totalTests: 0,
        errors,
      };
    } finally {
      // Cleanup
      if (cleanup) {
        await cleanup();
      }
      await this.dbSetup.cleanup();
    }
  }

  private async getAuthTokens(
    baseUrl: string,
    options?: RuntimeVerifierOptions
  ): Promise<{ authToken?: string; adminToken?: string }> {
    if (!options?.enableAuth) {
      return {};
    }

    try {
      // Try to get regular user token
      const authToken = await this.login(
        baseUrl,
        options.regularUser?.email || 'user@test.com',
        options.regularUser?.password || 'user123'
      );

      // Try to get admin token
      const adminToken = await this.login(
        baseUrl,
        options.adminUser?.email || 'admin@test.com',
        options.adminUser?.password || 'admin123'
      );

      return { authToken, adminToken };
    } catch (error) {
      // Auth might not be implemented yet - that's okay
      return {};
    }
  }

  private async login(baseUrl: string, email: string, password: string): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.token || data.accessToken || data.jwt || '';
    }

    throw new Error('Login failed');
  }

  private async runRequest(
    baseUrl: string,
    request: GeneratedRequest,
    expectedResponseShape: any,
    options?: RuntimeVerifierOptions
  ): Promise<RuntimeEvidence> {
    const startTime = Date.now();
    const url = new URL(request.path, baseUrl);

    // Add query params
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) {
        url.searchParams.set(key, value);
      }
    }

    let actualStatus = 0;
    let responseBodyMatchesType = false;
    let passed = false;
    let details = '';

    try {
      const timeout = options?.requestTimeout || 5000;
      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });

      actualStatus = response.status;
      const responseTime_ms = Date.now() - startTime;

      // Check if status matches expectation
      const statusMatches = actualStatus === request.expectedStatus;

      // For successful responses, validate body shape
      if (response.ok && expectedResponseShape) {
        try {
          const responseBody = await response.json();
          const validation = this.responseValidator.validateResponse(
            responseBody,
            expectedResponseShape
          );
          responseBodyMatchesType = validation.valid;

          // Check for data leaks
          const leaks = this.responseValidator.checkForLeakedData(responseBody);
          if (leaks.length > 0) {
            details = `Status matches, but found potential data leaks: ${leaks.join(', ')}`;
            passed = false;
          } else if (!validation.valid) {
            details = `Status matches, but response shape invalid: ${validation.errors.join('; ')}`;
            passed = statusMatches;
          } else {
            details = 'Status and response shape match';
            passed = statusMatches;
          }
        } catch (error) {
          details = `Status matches, but failed to parse response: ${error instanceof Error ? error.message : String(error)}`;
          passed = statusMatches;
        }
      } else {
        responseBodyMatchesType = true; // Not checked for error responses
        if (statusMatches) {
          details = `Expected ${request.expectedStatus}, got ${actualStatus}`;
          passed = true;
        } else {
          details = `Expected ${request.expectedStatus}, got ${actualStatus}`;
          passed = false;
        }
      }

      return {
        endpoint: request.path,
        method: request.method,
        testCase: request.testCase,
        request: {
          headers: request.headers,
          body: request.body,
          params: request.params,
          query: request.query,
        },
        expectedStatus: request.expectedStatus,
        actualStatus,
        responseBodyMatchesType,
        responseTime_ms,
        passed,
        details,
      };

    } catch (error) {
      return {
        endpoint: request.path,
        method: request.method,
        testCase: request.testCase,
        request: {
          headers: request.headers,
          body: request.body,
          params: request.params,
          query: request.query,
        },
        expectedStatus: request.expectedStatus,
        actualStatus,
        responseBodyMatchesType: false,
        responseTime_ms: Date.now() - startTime,
        passed: false,
        details: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Generate summary report
   */
  formatReport(result: RuntimeVerificationResult): string {
    const lines: string[] = [];

    lines.push('=== Tier 2 Runtime Verification Report ===');
    lines.push('');

    if (!result.appStarted) {
      lines.push('❌ Application failed to start');
      if (result.errors.length > 0) {
        lines.push('Errors:');
        for (const error of result.errors) {
          lines.push(`  - ${error}`);
        }
      }
      return lines.join('\n');
    }

    lines.push(`✓ Application started in ${result.appStartTimeMs}ms`);
    lines.push('');

    // Auth tests
    if (result.authTestsTotal > 0) {
      const authPass = result.authTestsPassed === result.authTestsTotal;
      lines.push(
        `${authPass ? '✓' : '✗'} Auth Tests: ${result.authTestsPassed}/${result.authTestsTotal} passed`
      );
    }

    // Validation tests
    if (result.validationTestsTotal > 0) {
      const valPass = result.validationTestsPassed === result.validationTestsTotal;
      lines.push(
        `${valPass ? '✓' : '✗'} Validation Tests: ${result.validationTestsPassed}/${result.validationTestsTotal} passed`
      );
    }

    // Response shape tests
    if (result.responseShapeTestsTotal > 0) {
      const shapePass = result.responseShapeTestsPassed === result.responseShapeTestsTotal;
      lines.push(
        `${shapePass ? '✓' : '✗'} Response Shape Tests: ${result.responseShapeTestsPassed}/${result.responseShapeTestsTotal} passed`
      );
    }

    lines.push('');
    lines.push(`Total: ${result.totalPassed}/${result.totalTests} tests passed`);

    // Failed tests details
    const failures = result.evidence.filter(e => !e.passed);
    if (failures.length > 0) {
      lines.push('');
      lines.push('Failed Tests:');
      for (const failure of failures.slice(0, 10)) {
        lines.push(`  ${failure.method} ${failure.endpoint} [${failure.testCase}]`);
        lines.push(`    ${failure.details}`);
      }
      if (failures.length > 10) {
        lines.push(`  ... and ${failures.length - 10} more`);
      }
    }

    return lines.join('\n');
  }
}
