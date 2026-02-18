/**
 * Runtime Verification to Proof Bundle Converter
 * 
 * Converts Tier 2 runtime verification results to PropertyProof format
 */

import type { PropertyProof, RuntimeTestEvidence } from '../proof/types';
import type { RuntimeVerificationResult, RuntimeEvidence } from './types';

export function convertRuntimeToProofs(
  runtimeResult: RuntimeVerificationResult
): PropertyProof[] {
  const proofs: PropertyProof[] = [];

  // Property 1: Auth blocking
  if (runtimeResult.authTestsTotal > 0) {
    const authEvidence = runtimeResult.evidence.filter(e =>
      e.testCase.includes('auth') || e.testCase.includes('forbidden')
    );

    const runtimeEvidence: RuntimeTestEvidence[] = authEvidence.map(e => ({
      endpoint: e.endpoint,
      method: e.method,
      testCase: e.testCase,
      expectedStatus: e.expectedStatus,
      actualStatus: e.actualStatus,
      responseTime_ms: e.responseTime_ms,
      passed: e.passed,
      details: e.details,
    }));

    const allPassed = runtimeResult.authTestsPassed === runtimeResult.authTestsTotal;
    
    proofs.push({
      property: 'runtime-auth-blocking',
      status: allPassed ? 'PROVEN' : 'FAILED',
      confidence: allPassed ? 'definitive' : 'high',
      evidence: runtimeEvidence,
      findings: [],
      method: 'runtime-http-test',
      summary: `Auth correctly blocks ${runtimeResult.authTestsPassed}/${runtimeResult.authTestsTotal} unauthorized requests`,
      duration_ms: authEvidence.reduce((sum, e) => sum + e.responseTime_ms, 0),
    });
  } else {
    proofs.push({
      property: 'runtime-auth-blocking',
      status: 'NOT_VERIFIED',
      confidence: 'medium',
      evidence: [],
      findings: [],
      method: 'runtime-http-test',
      summary: 'No auth tests executed - no protected endpoints found in spec',
      duration_ms: 0,
    });
  }

  // Property 2: Input validation
  if (runtimeResult.validationTestsTotal > 0) {
    const validationEvidence = runtimeResult.evidence.filter(e =>
      e.testCase.includes('invalid') || e.testCase.includes('missing') || e.testCase.includes('wrong')
    );

    const runtimeEvidence: RuntimeTestEvidence[] = validationEvidence.map(e => ({
      endpoint: e.endpoint,
      method: e.method,
      testCase: e.testCase,
      expectedStatus: e.expectedStatus,
      actualStatus: e.actualStatus,
      responseTime_ms: e.responseTime_ms,
      passed: e.passed,
      details: e.details,
    }));

    const allPassed = runtimeResult.validationTestsPassed === runtimeResult.validationTestsTotal;

    proofs.push({
      property: 'runtime-input-validation',
      status: allPassed ? 'PROVEN' : 'FAILED',
      confidence: allPassed ? 'definitive' : 'high',
      evidence: runtimeEvidence,
      findings: [],
      method: 'runtime-http-test',
      summary: `Input validation correctly rejects ${runtimeResult.validationTestsPassed}/${runtimeResult.validationTestsTotal} malformed requests`,
      duration_ms: validationEvidence.reduce((sum, e) => sum + e.responseTime_ms, 0),
    });
  } else {
    proofs.push({
      property: 'runtime-input-validation',
      status: 'NOT_VERIFIED',
      confidence: 'medium',
      evidence: [],
      findings: [],
      method: 'runtime-http-test',
      summary: 'No validation tests executed - no endpoints with request bodies found',
      duration_ms: 0,
    });
  }

  // Property 3: Response shape
  if (runtimeResult.responseShapeTestsTotal > 0) {
    const shapeEvidence = runtimeResult.evidence.filter(e =>
      e.testCase === 'valid_request'
    );

    const runtimeEvidence: RuntimeTestEvidence[] = shapeEvidence.map(e => ({
      endpoint: e.endpoint,
      method: e.method,
      testCase: e.testCase,
      expectedStatus: e.expectedStatus,
      actualStatus: e.actualStatus,
      responseTime_ms: e.responseTime_ms,
      passed: e.passed,
      details: e.details,
    }));

    const allPassed = runtimeResult.responseShapeTestsPassed === runtimeResult.responseShapeTestsTotal;

    proofs.push({
      property: 'runtime-response-shape',
      status: allPassed ? 'PROVEN' : 'FAILED',
      confidence: allPassed ? 'definitive' : 'high',
      evidence: runtimeEvidence,
      findings: [],
      method: 'runtime-http-test',
      summary: `All ${runtimeResult.responseShapeTestsPassed}/${runtimeResult.responseShapeTestsTotal} endpoints return responses matching declared types`,
      duration_ms: shapeEvidence.reduce((sum, e) => sum + e.responseTime_ms, 0),
    });
  } else {
    proofs.push({
      property: 'runtime-response-shape',
      status: 'NOT_VERIFIED',
      confidence: 'medium',
      evidence: [],
      findings: [],
      method: 'runtime-http-test',
      summary: 'No response shape tests executed - no endpoints with response type specs found',
      duration_ms: 0,
    });
  }

  // Property 4: No data leaks
  const dataLeakEvidence = runtimeResult.evidence.filter(e =>
    e.details.toLowerCase().includes('leak')
  );

  if (runtimeResult.totalTests > 0) {
    const runtimeEvidence: RuntimeTestEvidence[] = dataLeakEvidence.map(e => ({
      endpoint: e.endpoint,
      method: e.method,
      testCase: e.testCase,
      expectedStatus: e.expectedStatus,
      actualStatus: e.actualStatus,
      responseTime_ms: e.responseTime_ms,
      passed: e.passed,
      details: e.details,
    }));

    proofs.push({
      property: 'runtime-no-data-leak',
      status: dataLeakEvidence.length === 0 ? 'PROVEN' : 'FAILED',
      confidence: dataLeakEvidence.length === 0 ? 'definitive' : 'high',
      evidence: runtimeEvidence,
      findings: [],
      method: 'runtime-http-test',
      summary: dataLeakEvidence.length === 0
        ? `No sensitive data leaked in ${runtimeResult.totalTests} responses`
        : `Found ${dataLeakEvidence.length} potential data leaks`,
      duration_ms: dataLeakEvidence.reduce((sum, e) => sum + e.responseTime_ms, 0),
    });
  } else {
    proofs.push({
      property: 'runtime-no-data-leak',
      status: 'NOT_VERIFIED',
      confidence: 'medium',
      evidence: [],
      findings: [],
      method: 'runtime-http-test',
      summary: runtimeResult.errors[0] || 'App failed to start - no runtime tests executed',
      duration_ms: 0,
    });
  }

  return proofs;
}

/**
 * Generate summary statistics for runtime verification
 */
export function getRuntimeSummary(runtimeResult: RuntimeVerificationResult): {
  tier2Verified: boolean;
  tier2PropertiesProven: number;
  tier2PropertiesTotal: number;
  residualRisks: string[];
} {
  const proofs = convertRuntimeToProofs(runtimeResult);
  const proven = proofs.filter(p => p.status === 'PROVEN').length;
  const total = proofs.length;
  const notVerified = proofs.filter(p => p.status === 'NOT_VERIFIED');

  const residualRisks: string[] = [];
  
  if (!runtimeResult.appStarted) {
    residualRisks.push('App failed to start - Tier 2 verification incomplete');
  }

  for (const proof of notVerified) {
    residualRisks.push(`${proof.property}: ${proof.summary}`);
  }

  return {
    tier2Verified: runtimeResult.appStarted && proven === total,
    tier2PropertiesProven: proven,
    tier2PropertiesTotal: total,
    residualRisks,
  };
}
