/**
 * Patch Writer - Generate PR-ready diffs with rationale comments
 * 
 * Creates unified diffs that can be applied with `git apply` or reviewed in PRs.
 * Includes rationale comments explaining why each patch was applied.
 */

import type { PatchOperation, PatchRecord, Violation } from './types.js';
import { getHealableFinding } from './healable-findings.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface PatchDiff {
  /** File path */
  file: string;
  /** Unified diff format */
  diff: string;
  /** Rationale for this patch */
  rationale: string;
  /** Rule ID that triggered this patch */
  ruleId: string;
  /** Original violation message */
  violationMessage: string;
  /** Lines changed (added - removed) */
  linesChanged: number;
}

export interface PatchSet {
  /** All patches in this set */
  patches: PatchDiff[];
  /** Summary statistics */
  summary: {
    totalFiles: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    healableFindings: number;
    requiresReview: number;
  };
}

/**
 * Generate a unified diff for a patch operation
 */
export async function generatePatchDiff(
  patch: PatchOperation,
  violation: Violation,
  originalContent: string,
  projectRoot: string
): Promise<PatchDiff | null> {
  const finding = getHealableFinding(violation.ruleId);
  const rationale = finding
    ? `${finding.name}: ${finding.fixDescription}`
    : `Fix for ${violation.ruleId}: ${violation.message}`;

  const filePath = patch.file;
  const fullPath = filePath.startsWith('/') ? filePath : `${projectRoot}/${filePath}`;

  if (!existsSync(fullPath)) {
    // New file - create full diff
    return {
      file: filePath,
      diff: generateNewFileDiff(filePath, patch.content, rationale),
      rationale,
      ruleId: violation.ruleId,
      violationMessage: violation.message,
      linesChanged: patch.content.split('\n').length,
    };
  }

  const originalLines = originalContent.split('\n');
  const newContent = applyPatchToContent(originalContent, patch);
  const newLines = newContent.split('\n');

  // Generate unified diff
  const diff = generateUnifiedDiff(
    filePath,
    originalLines,
    newLines,
    patch.span?.startLine ?? 1,
    rationale
  );

  const linesChanged = newLines.length - originalLines.length;

  return {
    file: filePath,
    diff,
    rationale,
    ruleId: violation.ruleId,
    violationMessage: violation.message,
    linesChanged,
  };
}

/**
 * Generate unified diff format
 */
function generateUnifiedDiff(
  filePath: string,
  originalLines: string[],
  newLines: string[],
  contextLine: number,
  rationale: string
): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`--- a/${filePath}`);
  lines.push(`+++ b/${filePath}`);
  lines.push(`@@ -${contextLine},${originalLines.length} +${contextLine},${newLines.length} @@`);
  lines.push(`// Heal: ${rationale}`);

  // Find differences using simple line-by-line comparison
  // For production, consider using a proper diff library like `diff`
  let origIdx = 0;
  let newIdx = 0;
  const hunkStart = contextLine;
  let hunkOrigIdx = 0;
  let hunkNewIdx = 0;

  while (origIdx < originalLines.length || newIdx < newLines.length) {
    const origLine = origIdx < originalLines.length ? originalLines[origIdx] : null;
    const newLine = newIdx < newLines.length ? newLines[newIdx] : null;

    if (origLine === newLine) {
      // Context line
      lines.push(` ${origLine}`);
      origIdx++;
      newIdx++;
      hunkOrigIdx++;
      hunkNewIdx++;
    } else if (origLine === null) {
      // Addition
      lines.push(`+${newLine}`);
      newIdx++;
      hunkNewIdx++;
    } else if (newLine === null) {
      // Deletion
      lines.push(`-${origLine}`);
      origIdx++;
      hunkOrigIdx++;
    } else {
      // Change
      lines.push(`-${origLine}`);
      lines.push(`+${newLine}`);
      origIdx++;
      newIdx++;
      hunkOrigIdx++;
      hunkNewIdx++;
    }
  }

  return lines.join('\n');
}

/**
 * Generate diff for a new file
 */
function generateNewFileDiff(
  filePath: string,
  content: string,
  rationale: string
): string {
  const lines: string[] = [];
  lines.push(`--- /dev/null`);
  lines.push(`+++ b/${filePath}`);
  lines.push(`@@ -0,0 +1,${content.split('\n').length} @@`);
  lines.push(`// Heal: ${rationale}`);
  
  for (const line of content.split('\n')) {
    lines.push(`+${line}`);
  }

  return lines.join('\n');
}

/**
 * Apply a patch operation to content (in-memory, for diff generation)
 */
function applyPatchToContent(content: string, patch: PatchOperation): string {
  const lines = content.split('\n');

  switch (patch.type) {
    case 'insert': {
      if (patch.span) {
        const insertLine = patch.span.startLine - 1;
        const insertContent = patch.content.split('\n');
        lines.splice(insertLine, 0, ...insertContent);
      } else {
        // Append to end
        lines.push(...patch.content.split('\n'));
      }
      break;
    }

    case 'replace': {
      if (patch.span) {
        const startLine = patch.span.startLine - 1;
        const endLine = patch.span.endLine - 1;
        const replaceContent = patch.content.split('\n');
        lines.splice(startLine, endLine - startLine + 1, ...replaceContent);
      }
      break;
    }

    case 'delete': {
      if (patch.span) {
        const startLine = patch.span.startLine - 1;
        const endLine = patch.span.endLine - 1;
        lines.splice(startLine, endLine - startLine + 1);
      }
      break;
    }

    case 'wrap': {
      if (patch.span && patch.wrapPrefix && patch.wrapSuffix) {
        const startLine = patch.span.startLine - 1;
        const endLine = patch.span.endLine - 1;
        const wrapped = [
          ...patch.wrapPrefix.split('\n'),
          ...lines.slice(startLine, endLine + 1),
          ...patch.wrapSuffix.split('\n'),
        ];
        lines.splice(startLine, endLine - startLine + 1, ...wrapped);
      }
      break;
    }
  }

  return lines.join('\n');
}

/**
 * Generate a complete patch set from patch records
 */
export async function generatePatchSet(
  patches: PatchRecord[],
  violations: Violation[],
  projectRoot: string
): Promise<PatchSet> {
  const patchDiffs: PatchDiff[] = [];
  const fileMap = new Map<string, string>();

  // Group patches by file and load original content
  for (const patch of patches) {
    const filePath = patch.file;
    const fullPath = filePath.startsWith('/') ? filePath : `${projectRoot}/${filePath}`;

    if (!fileMap.has(filePath)) {
      if (existsSync(fullPath)) {
        fileMap.set(filePath, await readFile(fullPath, 'utf-8'));
      } else {
        fileMap.set(filePath, '');
      }
    }
  }

  // Generate diffs for each patch
  for (const patch of patches) {
    const violation = violations.find(v => v.ruleId === patch.ruleId);
    if (!violation) continue;

    const originalContent = fileMap.get(patch.file) || '';
    const diff = await generatePatchDiff(
      patch.operation,
      violation,
      originalContent,
      projectRoot
    );

    if (diff) {
      patchDiffs.push(diff);
    }
  }

  // Calculate summary
  const totalLinesAdded = patchDiffs.reduce((sum, p) => {
    const added = p.diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
    return sum + added;
  }, 0);

  const totalLinesRemoved = patchDiffs.reduce((sum, p) => {
    const removed = p.diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length;
    return sum + removed;
  }, 0);

  const healableFindings = new Set(patchDiffs.map(p => p.ruleId)).size;
  const requiresReview = patchDiffs.filter(p => {
    const finding = getHealableFinding(p.ruleId);
    return finding?.requiresReview ?? false;
  }).length;

  return {
    patches: patchDiffs,
    summary: {
      totalFiles: new Set(patchDiffs.map(p => p.file)).size,
      totalLinesAdded,
      totalLinesRemoved,
      healableFindings,
      requiresReview,
    },
  };
}

/**
 * Format patch set as a readable report
 */
export function formatPatchSet(patchSet: PatchSet): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('PATCH SET SUMMARY');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Files modified: ${patchSet.summary.totalFiles}`);
  lines.push(`Lines added: ${patchSet.summary.totalLinesAdded}`);
  lines.push(`Lines removed: ${patchSet.summary.totalLinesRemoved}`);
  lines.push(`Healable findings: ${patchSet.summary.healableFindings}`);
  lines.push(`Patches requiring review: ${patchSet.summary.requiresReview}`);
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('PATCHES');
  lines.push('='.repeat(80));
  lines.push('');

  for (const patch of patchSet.patches) {
    lines.push(`File: ${patch.file}`);
    lines.push(`Rule: ${patch.ruleId}`);
    lines.push(`Rationale: ${patch.rationale}`);
    lines.push(`Violation: ${patch.violationMessage}`);
    lines.push(`Lines changed: ${patch.linesChanged > 0 ? '+' : ''}${patch.linesChanged}`);
    lines.push('');
    lines.push('---');
    lines.push(patch.diff);
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write patch set to files (for dry-run mode)
 */
export async function writePatchSet(
  patchSet: PatchSet,
  outputDir: string
): Promise<string[]> {
  const { mkdir, writeFile } = await import('fs/promises');
  const { join } = await import('path');

  await mkdir(outputDir, { recursive: true });

  const writtenFiles: string[] = [];

  // Write summary
  const summaryPath = join(outputDir, 'patch-summary.txt');
  await writeFile(summaryPath, formatPatchSet(patchSet), 'utf-8');
  writtenFiles.push(summaryPath);

  // Write individual patch files
  for (const patch of patchSet.patches) {
    const patchFileName = patch.file.replace(/\//g, '_').replace(/\\/g, '_') + '.patch';
    const patchPath = join(outputDir, patchFileName);
    await writeFile(patchPath, patch.diff, 'utf-8');
    writtenFiles.push(patchPath);
  }

  // Write complete unified diff
  const unifiedDiff = patchSet.patches.map(p => p.diff).join('\n\n');
  const unifiedPath = join(outputDir, 'all-patches.patch');
  await writeFile(unifiedPath, unifiedDiff, 'utf-8');
  writtenFiles.push(unifiedPath);

  return writtenFiles;
}
