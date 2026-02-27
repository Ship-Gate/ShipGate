/**
 * ShipGate ISL Verify — GitHub Action Entry Point
 *
 * Runs ISL behavioral verification on PR code changes and reports
 * a SHIP / WARN / NO_SHIP verdict as outputs, PR comment, and exit code.
 *
 * Usage:
 *   - uses: shipgate/isl-verify@v1
 *     with:
 *       path: src/
 *       mode: auto
 *       fail-on: error
 *
 * @module @isl-lang/gate-action
 */

import * as core from '@actions/core';
import { verify } from './verify.js';
import { postPRComment } from './comment.js';
import type { ActionInputs, VerificationMode, FailOnLevel } from './types.js';

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

function parseInputs(): ActionInputs {
  const path = core.getInput('path') || '.';
  const modeRaw = core.getInput('mode') || 'auto';
  const failOnRaw = core.getInput('fail-on') || 'error';
  const configPath = core.getInput('config') || undefined;

  // Validate mode
  const validModes: VerificationMode[] = ['auto', 'strict', 'specless'];
  const mode: VerificationMode = validModes.includes(modeRaw as VerificationMode)
    ? (modeRaw as VerificationMode)
    : 'auto';

  // Validate fail-on
  const validFailOn: FailOnLevel[] = ['error', 'warning', 'unspecced'];
  const failOn: FailOnLevel = validFailOn.includes(failOnRaw as FailOnLevel)
    ? (failOnRaw as FailOnLevel)
    : 'error';

  return { path, mode, failOn, configPath };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const startTime = Date.now();

  try {
    const inputs = parseInputs();

    // Run verification
    const result = await verify(inputs);

    // Set outputs
    core.setOutput('verdict', result.verdict);
    core.setOutput('score', String(result.score));
    core.setOutput('report', result.reportPath ?? '');

    // Log summary
    const durationMs = Date.now() - startTime;
    core.info('');
    core.info('='.repeat(60));
    if (result.verdict === 'SHIP') {
      core.info(
        `  ShipGate: SHIP (score: ${result.score.toFixed(2)}) [${durationMs}ms]`,
      );
    } else if (result.verdict === 'WARN') {
      core.info(
        `  ShipGate: WARN (score: ${result.score.toFixed(2)}, ${result.blockers.length} warnings) [${durationMs}ms]`,
      );
    } else {
      core.info(
        `  ShipGate: NO_SHIP (score: ${result.score.toFixed(2)}, ${result.blockers.length} blockers) [${durationMs}ms]`,
      );
    }
    core.info('='.repeat(60));
    core.info('');

    // Post PR comment
    await postPRComment(result);

    // Set exit code for NO_SHIP
    if (result.verdict === 'NO_SHIP') {
      core.setFailed(`ShipGate: ${result.summary}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`ShipGate action failed: ${msg}`);
    if (error instanceof Error && error.stack) {
      core.debug(error.stack);
    }
  }
}

run();
