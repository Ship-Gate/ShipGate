/**
 * ISL Gate GitHub Action
 * 
 * Runs ISL/Shipgate gate checks and reports results via PR comment + Check Run annotations
 */

import { setFailed, info, warning, error, summary } from '@actions/core';
import { GitHubContext } from './types.js';
import { parseInputs, validateInputs } from './utils/inputs.js';
import { getFilesToCheck } from './utils/files.js';
import { GitHubClient } from './github/client.js';
import { runGate, shouldFail } from './gate/runner.js';
import { generateMarkdownReport, generateStepSummary } from './reporters/markdown.js';
import { generateCheckRunOutput } from './reporters/annotations.js';
import { createJsonReport, saveJsonReport, generateSarifReport } from './reporters/json.js';

/**
 * Main action entry point
 */
async function run(): Promise<void> {
  try {
    // Parse and validate inputs
    const inputs = parseInputs();
    validateInputs(inputs);
    
    // Build GitHub context
    const context = buildGitHubContext();
    info(`Running in ${context.eventName} event`);
    
    // Initialize GitHub client
    const github = new GitHubClient(inputs.token, context);
    
    // Determine files to check
    let filesToCheck: string[] = [];
    if (inputs.changedOnly) {
      filesToCheck = await getFilesToCheck(
        inputs.token,
        context,
        true
      );
      info(`Checking ${filesToCheck.length} changed files`);
    }
    
    // Find ISL spec file
    const specFile = await findSpecFile(inputs.repositoryPath);
    if (!specFile) {
      warning('No ISL spec file found. Running in specless mode.');
    }
    
    // Run the gate
    const gateResult = await runGate({
      projectRoot: inputs.repositoryPath,
      spec: specFile || undefined,
      implementation: inputs.repositoryPath,
      threshold: inputs.threshold,
      files: filesToCheck,
      configPath: inputs.configPath,
    });
    
    // Process results
    const shouldFailAction = shouldFail(
      gateResult.result,
      gateResult.findings,
      inputs.failOn
    );
    
    // Create report
    const report = createJsonReport(
      gateResult.result.verdict,
      gateResult.result.score || 0,
      gateResult.findings,
      undefined, // fingerprint not available in AuthoritativeGateResult
      gateResult.metrics.durationMs
    );
    
    // Save JSON report
    const reportPath = `${process.env.RUNNER_TEMP || '/tmp'}/gate-report.json`;
    saveJsonReport(report, reportPath);
    
    // Set outputs
    setOutput('verdict', report.verdict);
    setOutput('score', report.score.toString());
    setOutput('violations', report.totalFindings.toString());
    setOutput('evidence-path', '.islstudio/evidence');
    
    // Generate step summary
    await summary.addRaw(generateStepSummary(report));
    
    // Post PR comment if enabled
    if (inputs.enableComment && context.pullRequest) {
      try {
        const markdown = generateMarkdownReport(report);
        await github.upsertComment(markdown, 'ISL Gate');
        info('PR comment posted successfully');
      } catch (err) {
        warning(`Failed to post PR comment: ${err}`);
      }
    }
    
    // Create check run if enabled
    if (inputs.enableCheckRun) {
      try {
        const checkOutput = generateCheckRunOutput(
          `ISL Gate: ${report.verdict}`,
          `Score: ${report.score}/100, Findings: ${report.totalFindings}`,
          gateResult.findings
        );
        
        await github.createOrUpdateCheckRun(
          'ISL Gate',
          'completed',
          report.verdict === 'SHIP' ? 'success' : 'failure',
          checkOutput
        );
        info('Check run created successfully');
      } catch (err) {
        warning(`Failed to create check run: ${err}`);
      }
    }
    
    // Upload SARIF report if there are findings
    if (gateResult.findings.length > 0) {
      try {
        const sarif = generateSarifReport(gateResult.findings);
        const sarifPath = `${process.env.RUNNER_TEMP || '/tmp'}/gate-report.sarif`;
        saveJsonReport(sarif, sarifPath);
        
        // Note: SARIF upload would require additional GitHub API calls
        info(`SARIF report generated at: ${sarifPath}`);
      } catch (err) {
        warning(`Failed to generate SARIF report: ${err}`);
      }
    }
    
    // Fail the action if needed
    if (inputs.mode === 'enforce' && shouldFailAction) {
      setFailed(
        `ISL Gate: ${report.verdict} (score: ${report.score}/100, findings: ${report.totalFindings})`
      );
    }
    
    info(`Gate completed successfully: ${report.verdict}`);
    
  } catch (err) {
    error(`Action failed: ${err}`);
    setFailed(`Action failed: ${err}`);
    process.exit(1);
  }
}

/**
 * Build GitHub context from environment variables
 */
function buildGitHubContext(): GitHubContext {
  return {
    eventName: process.env.GITHUB_EVENT_NAME || 'unknown',
    sha: process.env.GITHUB_SHA || '',
    ref: process.env.GITHUB_REF || '',
    repository: {
      owner: process.env.GITHUB_REPOSITORY_OWNER || '',
      repo: process.env.GITHUB_REPOSITORY?.split('/')[1] || '',
    },
    pullRequest: process.env.GITHUB_EVENT_NAME === 'pull_request' ? {
      number: parseInt(process.env.GITHUB_PR_NUMBER || '0'),
      baseSha: process.env.GITHUB_BASE_SHA || '',
      headSha: process.env.GITHUB_HEAD_SHA || '',
    } : undefined,
    actor: process.env.GITHUB_ACTOR || '',
    runId: parseInt(process.env.GITHUB_RUN_ID || '0'),
    serverUrl: process.env.GITHUB_SERVER_URL || 'https://github.com',
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  };
}

/**
 * Find ISL spec file in repository
 */
async function findSpecFile(projectRoot: string): Promise<string | null> {
  const { access } = await import('fs/promises');
  const { join } = await import('path');
  
  // Common spec file locations
  const specPaths = [
    join(projectRoot, 'intent.isl'),
    join(projectRoot, 'spec.isl'),
    join(projectRoot, 'app.isl'),
    join(projectRoot, 'src', 'intent.isl'),
    join(projectRoot, 'specs', 'intent.isl'),
  ];
  
  for (const specPath of specPaths) {
    try {
      await access(specPath);
      return specPath;
    } catch {
      // File doesn't exist, continue
    }
  }
  
  return null;
}

/**
 * Helper to set GitHub output
 */
function setOutput(name: string, value: string): void {
  // GitHub Actions output file format
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const fs = require('fs');
    fs.appendFileSync(outputPath, `${name}=${value}\n`);
  }
  console.log(`::set-output name=${name}::${value}`);
}

// Run the action
if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { run };
