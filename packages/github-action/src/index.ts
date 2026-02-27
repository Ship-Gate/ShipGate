/**
 * ISL Verify GitHub Action
 * 
 * Entry point for the GitHub Action that verifies ISL specifications.
 */

import * as core from '@actions/core';

import { parseInputs, type ActionInputs } from './inputs.js';
import { ISLChecker } from './checker.js';
import { ISLVerifier, type VerificationResult } from './verifier.js';
import { createAnnotations } from './annotations.js';
import { generateJobSummary } from './summary.js';
import { formatReport, type ActionReport } from './reporter.js';

// ============================================================================
// Main Action
// ============================================================================

async function run(): Promise<void> {
  const startTime = Date.now();

  try {
    // Parse inputs
    core.info('🔍 Parsing action inputs...');
    const inputs = parseInputs();
    
    core.debug(`Inputs: ${JSON.stringify(inputs, null, 2)}`);

    // Initialize report
    const report: ActionReport = {
      verdict: 'unchecked',
      score: 0,
      errors: [],
      warnings: [],
      specsChecked: 0,
      coverage: {
        preconditions: 0,
        postconditions: 0,
        invariants: 0,
        temporal: 0,
      },
      duration: 0,
    };

    // Step 1: Check ISL specs
    core.startGroup('📋 Checking ISL Specifications');
    const checker = new ISLChecker(inputs);
    const checkResult = await checker.check();
    
    report.errors.push(...checkResult.errors);
    report.warnings.push(...checkResult.warnings);
    report.specsChecked = checkResult.specsChecked;

    core.info(`Checked ${checkResult.specsChecked} specification files`);
    core.info(`Found ${checkResult.errors.length} errors, ${checkResult.warnings.length} warnings`);
    core.endGroup();

    // Step 2: Verify implementation (if provided and not check-only)
    let verificationResult: VerificationResult | null = null;
    
    if (!inputs.checkOnly && inputs.implementation) {
      core.startGroup('🔬 Verifying Implementation');
      const verifier = new ISLVerifier(inputs);
      verificationResult = await verifier.verify();
      
      report.verdict = verificationResult.verdict;
      report.score = verificationResult.score;
      report.coverage = verificationResult.coverage;
      report.errors.push(...verificationResult.errors);
      report.warnings.push(...verificationResult.warnings);

      core.info(`Verification verdict: ${verificationResult.verdict}`);
      core.info(`Verification score: ${verificationResult.score}/100`);
      core.endGroup();
    } else if (inputs.checkOnly) {
      core.info('ℹ️ Check-only mode, skipping verification');
      report.verdict = checkResult.errors.length === 0 ? 'checked' : 'failed';
    } else {
      core.info('ℹ️ No implementation provided, skipping verification');
      report.verdict = checkResult.errors.length === 0 ? 'checked' : 'failed';
    }

    // Calculate duration
    report.duration = Date.now() - startTime;

    // Step 3: Create GitHub annotations
    core.startGroup('📝 Creating Annotations');
    await createAnnotations(report.errors, report.warnings);
    core.endGroup();

    // Step 4: Generate job summary
    core.startGroup('📊 Generating Job Summary');
    await generateJobSummary(report, inputs);
    core.endGroup();

    // Step 5: Set outputs
    setOutputs(report);

    // Step 6: Format and display report
    const formattedReport = formatReport(report);
    core.info('\n' + formattedReport);

    // Step 7: Determine if action should fail
    const shouldFail = determineFail(report, inputs);
    
    if (shouldFail) {
      core.setFailed(getFailureMessage(report, inputs));
    } else {
      core.info('✅ ISL verification completed successfully');
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${message}`);
    
    if (error instanceof Error && error.stack) {
      core.debug(error.stack);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function setOutputs(report: ActionReport): void {
  core.setOutput('verdict', report.verdict);
  core.setOutput('score', report.score.toString());
  core.setOutput('errors', report.errors.length.toString());
  core.setOutput('warnings', report.warnings.length.toString());
  core.setOutput('specs-checked', report.specsChecked.toString());
  core.setOutput('coverage-preconditions', report.coverage.preconditions.toString());
  core.setOutput('coverage-postconditions', report.coverage.postconditions.toString());
  core.setOutput('coverage-invariants', report.coverage.invariants.toString());
}

function determineFail(report: ActionReport, inputs: ActionInputs): boolean {
  // Fail on errors
  if (report.errors.length > 0) {
    return true;
  }

  // Fail on warnings if configured
  if (inputs.failOnWarning && report.warnings.length > 0) {
    return true;
  }

  // Fail if score below threshold
  if (inputs.failThreshold > 0 && report.score < inputs.failThreshold) {
    return true;
  }

  // Fail on unsafe verdict
  if (report.verdict === 'unsafe') {
    return true;
  }

  return false;
}

function getFailureMessage(report: ActionReport, inputs: ActionInputs): string {
  const reasons: string[] = [];

  if (report.errors.length > 0) {
    reasons.push(`${report.errors.length} error(s) found`);
  }

  if (inputs.failOnWarning && report.warnings.length > 0) {
    reasons.push(`${report.warnings.length} warning(s) found (fail-on-warning enabled)`);
  }

  if (inputs.failThreshold > 0 && report.score < inputs.failThreshold) {
    reasons.push(`Score ${report.score} below threshold ${inputs.failThreshold}`);
  }

  if (report.verdict === 'unsafe') {
    reasons.push('Verification verdict: unsafe');
  }

  return `ISL verification failed: ${reasons.join(', ')}`;
}

// ============================================================================
// Run Action
// ============================================================================

run();
