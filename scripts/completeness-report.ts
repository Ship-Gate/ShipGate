#!/usr/bin/env npx tsx
/**
 * Completeness Report Generator
 * 
 * Generates a markdown dashboard report showing package completion status,
 * missing deliverables, and prioritized backlog.
 * 
 * Usage:
 *   npx tsx scripts/completeness-report.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  CompletenessReport,
  PrioritizedBacklog,
  PackageCompleteness,
} from './completeness-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const reportsDir = join(rootDir, 'reports');

// ---------------------------------------------------------------------------
// Generate markdown report
// ---------------------------------------------------------------------------

function generateMarkdown(
  completenessReport: CompletenessReport,
  backlog: PrioritizedBacklog,
): string {
  const lines: string[] = [];

  lines.push('# Package Completeness Dashboard');
  lines.push('');
  lines.push(`**Generated:** ${completenessReport.generatedAt}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Packages:** ${completenessReport.totalPackages}`);
  lines.push(`- **Complete:** ${completenessReport.completeCount} ✅`);
  lines.push(`- **Partial:** ${completenessReport.partialCount} ⚠️`);
  lines.push(`- **Shell:** ${completenessReport.shellCount} 🔨`);
  lines.push(`- **Status Mismatches:** ${completenessReport.mismatchedCount} ❌`);
  lines.push('');

  const completionRate = Math.round(
    (completenessReport.completeCount / completenessReport.totalPackages) * 100,
  );
  lines.push(`**Completion Rate:** ${completionRate}%`);
  lines.push('');

  // Status breakdown
  lines.push('## Status Breakdown');
  lines.push('');
  lines.push('| Status | Count | Percentage |');
  lines.push('|--------|-------|------------|');
  lines.push(
    `| Complete | ${completenessReport.completeCount} | ${Math.round((completenessReport.completeCount / completenessReport.totalPackages) * 100)}% |`,
  );
  lines.push(
    `| Partial | ${completenessReport.partialCount} | ${Math.round((completenessReport.partialCount / completenessReport.totalPackages) * 100)}% |`,
  );
  lines.push(
    `| Shell | ${completenessReport.shellCount} | ${Math.round((completenessReport.shellCount / completenessReport.totalPackages) * 100)}% |`,
  );
  lines.push('');

  // Mismatches
  if (completenessReport.mismatchedCount > 0) {
    lines.push('## ⚠️ Status Mismatches');
    lines.push('');
    lines.push(
      'These packages have declared status that does not match their actual assessed status:',
    );
    lines.push('');
    lines.push('| Package | Declared | Assessed | Missing Deliverables |');
    lines.push('|---------|----------|----------|---------------------|');

    const mismatches = completenessReport.packages.filter((p) => !p.statusMatches);
    for (const pkg of mismatches) {
      const missing = pkg.missingForComplete.length > 0 ? pkg.missingForComplete.join(', ') : 'None';
      lines.push(
        `| ${pkg.name} | ${pkg.declaredStatus} | ${pkg.assessedStatus} | ${missing} |`,
      );
    }
    lines.push('');
  }

  // Complete packages
  const completePackages = completenessReport.packages.filter(
    (p) => p.declaredStatus === 'complete',
  );
  if (completePackages.length > 0) {
    lines.push('## ✅ Complete Packages');
    lines.push('');
    lines.push(`**${completePackages.length}** packages marked as complete:`);
    lines.push('');
    for (const pkg of completePackages) {
      lines.push(`- **${pkg.name}**`);
    }
    lines.push('');
  }

  // Partial packages
  const partialPackages = completenessReport.packages.filter(
    (p) => p.declaredStatus === 'partial',
  );
  if (partialPackages.length > 0) {
    lines.push('## ⚠️ Partial Packages');
    lines.push('');
    lines.push(`**${partialPackages.length}** packages marked as partial:`);
    lines.push('');
    lines.push('| Package | Missing Deliverables |');
    lines.push('|---------|---------------------|');
    for (const pkg of partialPackages) {
      const missing =
        pkg.missingForComplete.length > 0 ? pkg.missingForComplete.join(', ') : 'None';
      lines.push(`| ${pkg.name} | ${missing} |`);
    }
    lines.push('');
  }

  // Shell packages
  const shellPackages = completenessReport.packages.filter((p) => p.declaredStatus === 'shell');
  if (shellPackages.length > 0) {
    lines.push('## 🔨 Shell Packages');
    lines.push('');
    lines.push(`**${shellPackages.length}** packages marked as shell (stub/incomplete):`);
    lines.push('');
    lines.push('| Package | Missing Deliverables |');
    lines.push('|---------|---------------------|');
    for (const pkg of shellPackages.slice(0, 20)) {
      // Show first 20 to avoid huge report
      const missing =
        pkg.missingForComplete.length > 0 ? pkg.missingForComplete.join(', ') : 'All';
      lines.push(`| ${pkg.name} | ${missing} |`);
    }
    if (shellPackages.length > 20) {
      lines.push(`| ... | ${shellPackages.length - 20} more packages |`);
    }
    lines.push('');
  }

  // Prioritized backlog
  lines.push('## 🎯 Prioritized Completion Backlog');
  lines.push('');
  lines.push(
    'Packages ranked by dependency importance and product impact. Focus on completing these first:',
  );
  lines.push('');
  lines.push(
    '| Rank | Package | Status | Priority Score | Dependents | Core | Missing |',
  );
  lines.push(
    '|------|---------|--------|----------------|------------|------|---------|',
  );

  const top20 = backlog.prioritized.slice(0, 20);
  for (let i = 0; i < top20.length; i++) {
    const item = top20[i];
    const missing =
      item.missingDeliverables.length > 0 ? item.missingDeliverables.join(', ') : 'None';
    lines.push(
      `| ${i + 1} | ${item.name} | ${item.status} | ${item.priorityScore} | ${item.factors.dependencyCount} | ${item.factors.isCore ? 'Yes' : 'No'} | ${missing} |`,
    );
  }
  lines.push('');

  // Action items
  lines.push('## 📋 Action Items');
  lines.push('');
  
  const incompletePackages = completenessReport.packages.filter(
    (p) => p.declaredStatus !== 'complete',
  );
  
  if (incompletePackages.length > 0) {
    lines.push(`**${incompletePackages.length}** packages need completion work:`);
    lines.push('');
    
    // Group by missing deliverable
    const missingExports = incompletePackages.filter((p) => !p.deliverables.exports.present);
    const missingTests = incompletePackages.filter((p) => !p.deliverables.tests.present);
    const missingDocs = incompletePackages.filter((p) => !p.deliverables.docs.present);
    const missingSamples = incompletePackages.filter((p) => !p.deliverables.sampleUsage.present);

    if (missingExports.length > 0) {
      lines.push(`### Missing Exports (${missingExports.length} packages)`);
      lines.push('');
      for (const pkg of missingExports.slice(0, 10)) {
        lines.push(`- ${pkg.name}`);
      }
      if (missingExports.length > 10) {
        lines.push(`- ... and ${missingExports.length - 10} more`);
      }
      lines.push('');
    }

    if (missingTests.length > 0) {
      lines.push(`### Missing Tests (${missingTests.length} packages)`);
      lines.push('');
      for (const pkg of missingTests.slice(0, 10)) {
        lines.push(`- ${pkg.name}`);
      }
      if (missingTests.length > 10) {
        lines.push(`- ... and ${missingTests.length - 10} more`);
      }
      lines.push('');
    }

    if (missingDocs.length > 0) {
      lines.push(`### Missing Documentation (${missingDocs.length} packages)`);
      lines.push('');
      for (const pkg of missingDocs.slice(0, 10)) {
        lines.push(`- ${pkg.name}`);
      }
      if (missingDocs.length > 10) {
        lines.push(`- ... and ${missingDocs.length - 10} more`);
      }
      lines.push('');
    }

    if (missingSamples.length > 0) {
      lines.push(`### Missing Sample Usage (${missingSamples.length} packages)`);
      lines.push('');
      for (const pkg of missingSamples.slice(0, 10)) {
        lines.push(`- ${pkg.name}`);
      }
      if (missingSamples.length > 10) {
        lines.push(`- ... and ${missingSamples.length - 10} more`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Report generated by completeness-report.ts*');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('\n📊 Generating Completeness Report...\n');

  // Load completeness report
  const completenessPath = join(reportsDir, 'completeness.json');
  if (!existsSync(completenessPath)) {
    console.error('❌ completeness.json not found. Run completeness-checker.ts first.');
    process.exit(1);
  }

  const completenessReport = JSON.parse(
    readFileSync(completenessPath, 'utf-8'),
  ) as CompletenessReport;

  // Load backlog
  const backlogPath = join(reportsDir, 'completeness-backlog.json');
  if (!existsSync(backlogPath)) {
    console.error('❌ completeness-backlog.json not found. Run completeness-backlog.ts first.');
    process.exit(1);
  }

  const backlog = JSON.parse(readFileSync(backlogPath, 'utf-8')) as PrioritizedBacklog;

  // Generate markdown
  const markdown = generateMarkdown(completenessReport, backlog);

  // Write report
  const reportPath = join(reportsDir, 'completeness.md');
  writeFileSync(reportPath, markdown);

  console.log(`✅ Generated completeness report`);
  console.log(`📄 reports/completeness.md\n`);
}

main();
