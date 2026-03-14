import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CheckResult, ProofManifest, VerificationResult, Verdict } from './types.js';
import { validateSchema } from './checks/schema.js';
import { verifyBundleId } from './checks/bundle-id.js';
import { verifyEvidenceCompleteness, verifyEvidenceIntegrity } from './checks/evidence.js';
import { verifyVerdictConsistency } from './checks/verdict.js';
import { verifySignature } from './checks/signature.js';
import { verifyTimestamp } from './checks/timestamp.js';
import { verifyMethodRequirements } from './checks/method-requirements.js';
import { verifyChain } from './checks/chain.js';

export interface VerifyOptions {
  signingKey?: string;
}

export async function verifyProofBundle(
  bundlePath: string,
  options: VerifyOptions = {},
): Promise<VerificationResult> {
  const checks: CheckResult[] = [];
  const reasons: string[] = [];

  let rawContent: string;
  let manifest: ProofManifest;

  try {
    rawContent = await readFile(join(bundlePath, 'manifest.json'), 'utf-8');
  } catch {
    return {
      valid: false,
      verdict: 'REJECTED',
      reasons: ['Cannot read manifest.json from bundle path'],
      checks: [],
    };
  }

  try {
    manifest = JSON.parse(rawContent) as ProofManifest;
  } catch {
    return {
      valid: false,
      verdict: 'REJECTED',
      reasons: ['manifest.json is not valid JSON'],
      checks: [],
    };
  }

  const schemaResult = validateSchema(manifest);
  checks.push(schemaResult);
  if (!schemaResult.passed) {
    return {
      valid: false,
      verdict: 'REJECTED',
      reasons: [`Schema invalid: ${schemaResult.details}`],
      checks,
    };
  }

  const bundleIdResult = verifyBundleId(manifest);
  checks.push(bundleIdResult);
  if (!bundleIdResult.passed) reasons.push(bundleIdResult.details);

  const completenessResult = verifyEvidenceCompleteness(manifest);
  checks.push(completenessResult);
  if (!completenessResult.passed) reasons.push(completenessResult.details);

  const integrityResult = await verifyEvidenceIntegrity(manifest, bundlePath);
  checks.push(integrityResult);
  if (!integrityResult.passed) reasons.push(integrityResult.details);

  const verdictResult = verifyVerdictConsistency(manifest);
  checks.push(verdictResult);
  if (!verdictResult.passed) reasons.push(verdictResult.details);

  const sigResult = verifySignature(manifest, rawContent, options.signingKey);
  checks.push(sigResult);
  if (!sigResult.passed) reasons.push(sigResult.details);

  const tsResult = verifyTimestamp(manifest);
  checks.push(tsResult);
  if (!tsResult.passed) reasons.push(tsResult.details);

  const methodResult = verifyMethodRequirements(manifest);
  checks.push(methodResult);
  if (!methodResult.passed) reasons.push(methodResult.details);

  const chainResult = await verifyChain(manifest, bundlePath);
  checks.push(chainResult);
  if (!chainResult.passed) reasons.push(chainResult.details);

  const allPassed = checks.every((c) => c.passed);
  const anyHardFail = !bundleIdResult.passed || !schemaResult.passed || !verdictResult.passed;

  let verdict: Verdict;
  if (allPassed) {
    verdict = 'VERIFIED';
  } else if (anyHardFail) {
    verdict = 'REJECTED';
  } else {
    verdict = 'INCOMPLETE';
  }

  return { valid: allPassed, verdict, reasons, checks };
}
