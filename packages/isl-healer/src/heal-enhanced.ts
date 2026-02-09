/**
 * Enhanced Heal Command Implementation
 * 
 * Supports dry-run and interactive modes with PR-ready patch generation.
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { createInterface } from 'readline';
import type { GateResult, Violation, PatchRecord, HealResult } from './types.js';
import { generatePatchSet, formatPatchSet, writePatchSet } from './patch-writer.js';
import { getHealableFinding } from './healable-findings.js';

export interface EnhancedHealOptions {
  /** Dry-run mode: preview patches without applying */
  dryRun?: boolean;
  /** Interactive mode: ask for confirmation per patch */
  interactive?: boolean;
  /** Output directory for dry-run patches */
  outputDir?: string;
  /** Project root */
  projectRoot?: string;
}

export interface EnhancedHealResult extends HealResult {
  /** Patch set generated (if dry-run or interactive) */
  patchSet?: {
    patches: Array<{
      file: string;
      ruleId: string;
      rationale: string;
      diff: string;
      linesChanged: number;
    }>;
    summary: {
      totalFiles: number;
      totalLinesAdded: number;
      totalLinesRemoved: number;
      healableFindings: number;
      requiresReview: number;
    };
  };
  /** Files written (if dry-run) */
  writtenFiles?: string[];
}

/**
 * Prompt user for yes/no confirmation
 */
async function promptYesNo(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Enhanced heal function that supports dry-run and interactive modes
 */
export async function enhancedHeal(
  runGate: () => Promise<GateResult>,
  applyPatches: (patches: PatchRecord[]) => Promise<void>,
  getPatches: () => PatchRecord[],
  getViolations: () => Violation[],
  options: EnhancedHealOptions = {}
): Promise<EnhancedHealResult> {
  const projectRoot = options.projectRoot || process.cwd();
  const outputDir = options.outputDir || join(projectRoot, '.isl-heal-patches');
  const isDryRun = options.dryRun ?? false;
  const isInteractive = options.interactive ?? false;

  // Run initial gate
  const initialGate = await runGate();

  if (initialGate.verdict === 'SHIP') {
    return {
      success: true,
      reason: 'ship',
      iterations: 0,
      finalScore: initialGate.score,
      finalVerdict: 'SHIP',
      history: [],
      files: [],
    };
  }

  // Collect patches from healing process
  const patches = getPatches();
  const violations = getViolations();

  if (patches.length === 0) {
    return {
      success: false,
      reason: 'unknown_rule',
      iterations: 0,
      finalScore: initialGate.score,
      finalVerdict: 'NO_SHIP',
      history: [],
      files: [],
      errors: ['No patches could be generated'],
    };
  }

  // Generate patch set
  const patchSet = await generatePatchSet(patches, violations, projectRoot);

  // Dry-run mode: write patches to files
  if (isDryRun) {
    const writtenFiles = await writePatchSet(patchSet, outputDir);
    
    console.log('');
    console.log(chalk.bold.cyan('DRY-RUN MODE: Patches previewed but not applied'));
    console.log('');
    console.log(chalk.gray(`Patches written to: ${outputDir}`));
    console.log(chalk.gray(`Files written: ${writtenFiles.length}`));
    console.log('');
    console.log(formatPatchSet(patchSet));

    return {
      success: false,
      reason: 'unknown_rule',
      iterations: 0,
      finalScore: initialGate.score,
      finalVerdict: 'NO_SHIP',
      history: [],
      files: [],
      patchSet: {
        patches: patchSet.patches.map(p => ({
          file: p.file,
          ruleId: p.ruleId,
          rationale: p.rationale,
          diff: p.diff,
          linesChanged: p.linesChanged,
        })),
        summary: patchSet.summary,
      },
      writtenFiles,
    };
  }

  // Interactive mode: ask for confirmation per patch
  if (isInteractive) {
    console.log('');
    console.log(chalk.bold.cyan('INTERACTIVE MODE: Review each patch'));
    console.log('');
    console.log(formatPatchSet(patchSet));
    console.log('');

    const patchesToApply: PatchRecord[] = [];

    for (const patchDiff of patchSet.patches) {
      const finding = getHealableFinding(patchDiff.ruleId);
      const requiresReview = finding?.requiresReview ?? false;

      console.log(chalk.bold(`\nPatch: ${patchDiff.file}`));
      console.log(chalk.gray(`Rule: ${patchDiff.ruleId}`));
      console.log(chalk.gray(`Rationale: ${patchDiff.rationale}`));
      if (requiresReview) {
        console.log(chalk.yellow('⚠️  This patch requires review'));
      }
      console.log('');
      console.log(patchDiff.diff);
      console.log('');

      const shouldApply = await promptYesNo(
        `Apply this patch to ${patchDiff.file}?`
      );

      if (shouldApply) {
        const patchRecord = patches.find(p => p.file === patchDiff.file && p.ruleId === patchDiff.ruleId);
        if (patchRecord) {
          patchesToApply.push(patchRecord);
        }
      } else {
        console.log(chalk.gray(`Skipping patch for ${patchDiff.file}`));
      }
    }

    if (patchesToApply.length === 0) {
      console.log(chalk.yellow('\nNo patches were approved. Exiting.'));
      return {
        success: false,
        reason: 'unknown_rule',
        iterations: 0,
        finalScore: initialGate.score,
        finalVerdict: 'NO_SHIP',
        history: [],
        files: [],
        errors: ['No patches were approved by user'],
      };
    }

    // Apply approved patches
    await applyPatches(patchesToApply);

    // Re-run gate to verify
    const finalGate = await runGate();

    return {
      success: finalGate.verdict === 'SHIP',
      reason: finalGate.verdict === 'SHIP' ? 'ship' : 'unknown_rule',
      iterations: 1,
      finalScore: finalGate.score,
      finalVerdict: finalGate.verdict,
      history: [
        {
          iteration: 1,
          violations: violations.map(v => ({
            ruleId: v.ruleId,
            file: v.file,
            line: v.span.startLine,
            message: v.message,
            severity: v.severity,
          })),
          patchesApplied: patchesToApply.map(p => p.file),
          fingerprint: finalGate.fingerprint,
          duration: 0,
        },
      ],
      files: Array.from(new Set(patchesToApply.map(p => p.file))),
      patchSet: {
        patches: patchSet.patches.filter(p => 
          patchesToApply.some(pa => pa.file === p.file && pa.ruleId === p.ruleId)
        ).map(p => ({
          file: p.file,
          ruleId: p.ruleId,
          rationale: p.rationale,
          diff: p.diff,
          linesChanged: p.linesChanged,
        })),
        summary: {
          ...patchSet.summary,
          totalFiles: new Set(patchesToApply.map(p => p.file)).size,
        },
      },
    };
  }

  // Normal mode: apply all patches
  await applyPatches(patches);

  // Re-run gate to verify
  const finalGate = await runGate();

  return {
    success: finalGate.verdict === 'SHIP',
    reason: finalGate.verdict === 'SHIP' ? 'ship' : 'unknown_rule',
    iterations: 1,
    finalScore: finalGate.score,
    finalVerdict: finalGate.verdict,
    history: [
      {
        iteration: 1,
        violations: violations.map(v => ({
          ruleId: v.ruleId,
          file: v.file,
          line: v.span.startLine,
          message: v.message,
          severity: v.severity,
        })),
        patchesApplied: patches.map(p => p.file),
        fingerprint: finalGate.fingerprint,
        duration: 0,
      },
    ],
    files: Array.from(new Set(patches.map(p => p.file))),
  };
}
