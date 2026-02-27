/**
 * PR Analysis - Smart File Selector
 *
 * Decides which files in a PR need full verification, specless checks,
 * or can be safely skipped. Produces a {@link VerificationPlan}.
 *
 * @module @isl-lang/gate/pr-analysis
 */

import type {
  PRAnalysis,
  VerificationPlan,
  ResolvedPRAnalysisConfig,
  SkipReason,
} from './types.js';
import {
  isTestFile,
  isTypeOnly,
  isConfigFile,
  isCriticalPath,
  isSourceFile,
} from './file-classifier.js';
import { findMatchingSpec } from './spec-matcher.js';

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Produce a smart verification plan from a PR analysis.
 *
 * Classification logic:
 * 1. Test files → skip
 * 2. Type-only files → skip
 * 3. Config/infra files → skip
 * 4. Non-source files → skip (images, docs, etc.)
 * 5. Source with matching ISL spec → fullVerify
 * 6. Source on critical path, no spec → speclessVerify + generateSpec if new
 * 7. Everything else → skip (non-critical, no spec)
 */
export function selectFilesForVerification(
  analysis: PRAnalysis,
  config: ResolvedPRAnalysisConfig,
  availableSpecs: string[],
): VerificationPlan {
  const plan: VerificationPlan = {
    fullVerify: [],
    speclessVerify: [],
    skip: [],
    generateSpec: [],
  };

  for (const file of analysis.changedFiles) {
    // Deleted files don't need verification
    if (file.changeType === 'deleted') {
      plan.skip.push({ file, reason: 'non_critical' });
      continue;
    }

    // 1. Test files → skip
    if (isTestFile(file.path, config.testPatterns)) {
      plan.skip.push({ file, reason: 'test_file' });
      continue;
    }

    // 2. Type-only → skip
    if (isTypeOnly(file.path, config.typeOnlyExtensions)) {
      plan.skip.push({ file, reason: 'type_only' });
      continue;
    }

    // 3. Config/infra → skip
    if (isConfigFile(file.path, config.configPatterns)) {
      plan.skip.push({ file, reason: 'config_file' });
      continue;
    }

    // 4. Non-source files → skip
    if (!isSourceFile(file.path)) {
      plan.skip.push({ file, reason: 'non_critical' });
      continue;
    }

    // 5. Has matching ISL spec → full verify
    const spec = findMatchingSpec(file.path, availableSpecs);
    if (spec) {
      plan.fullVerify.push({ file, spec });
      continue;
    }

    // 6. Critical path without spec → specless verify
    if (isCriticalPath(file.path, config.criticalPathPatterns)) {
      plan.speclessVerify.push(file);

      // Suggest spec generation for new critical-path files
      if (file.changeType === 'added') {
        plan.generateSpec.push(file);
      }
      continue;
    }

    // 7. Non-critical, no spec → skip
    plan.skip.push({ file, reason: 'non_critical' });
  }

  return plan;
}

// ============================================================================
// Plan Summary
// ============================================================================

/**
 * Format a verification plan into a human-readable summary.
 */
export function formatVerificationPlan(plan: VerificationPlan): string {
  const lines: string[] = [];

  lines.push('Verification Plan:');

  // Full verify
  if (plan.fullVerify.length > 0) {
    lines.push('  Full verify (ISL spec):');
    for (const { file, spec } of plan.fullVerify) {
      lines.push(`    ✓ ${file.path} → ${spec}`);
    }
  }

  // Specless verify
  if (plan.speclessVerify.length > 0) {
    lines.push('  Specless verify (critical path, no spec):');
    for (const file of plan.speclessVerify) {
      const label = file.changeType === 'added' ? 'NEW' : 'MODIFIED';
      lines.push(`    ⚠ ${file.path} (${label} — no spec)`);
    }
  }

  // Skip
  if (plan.skip.length > 0) {
    lines.push('  Skip (low risk):');
    for (const { file, reason } of plan.skip) {
      const label = skipReasonLabel(reason);
      lines.push(`    ○ ${file.path} (${label})`);
    }
  }

  // Spec generation recommendations
  if (plan.generateSpec.length > 0) {
    lines.push('  Recommend spec generation:');
    for (const file of plan.generateSpec) {
      lines.push(`    → shipgate isl generate ${file.path}`);
    }
  }

  return lines.join('\n');
}

/**
 * Map a skip reason to a display label.
 */
function skipReasonLabel(reason: SkipReason): string {
  switch (reason) {
    case 'test_file': return 'test file';
    case 'type_only': return 'types only';
    case 'config_file': return 'config';
    case 'non_critical': return 'non-critical';
  }
}
