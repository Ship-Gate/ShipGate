import type { ProofBundle } from '@isl-verify/core';
import type { ComplianceFramework, ComplianceReport, ComplianceSummary } from '../types';
import { SOC2Framework } from '../frameworks/soc2';
import { HIPAAFramework } from '../frameworks/hipaa';
import { PCIDSSFramework } from '../frameworks/pci-dss';
import { EUAIActFramework } from '../frameworks/eu-ai-act';

export class ComplianceReportGenerator {
  static generate(bundle: ProofBundle, framework: ComplianceFramework): ComplianceReport {
    let controls;
    switch (framework) {
      case 'soc2':
        controls = SOC2Framework.evaluate(bundle);
        break;
      case 'hipaa':
        controls = HIPAAFramework.evaluate(bundle);
        break;
      case 'pci-dss':
        controls = PCIDSSFramework.evaluate(bundle);
        break;
      case 'eu-ai-act':
        controls = EUAIActFramework.evaluate(bundle);
        break;
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }

    const summary = this.calculateSummary(controls);

    return {
      framework,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      controls,
      summary,
    };
  }

  private static calculateSummary(controls: any[]): ComplianceSummary {
    const totalControls = controls.length;
    const passed = controls.filter((c) => c.status === 'pass').length;
    const failed = controls.filter((c) => c.status === 'fail').length;
    const partial = controls.filter((c) => c.status === 'partial').length;
    const notApplicable = controls.filter((c) => c.status === 'not_applicable').length;

    const complianceScore = totalControls > 0 ? (passed / totalControls) * 100 : 0;

    return {
      totalControls,
      passed,
      failed,
      partial,
      notApplicable,
      complianceScore: Math.round(complianceScore * 100) / 100,
    };
  }

  static exportToMarkdown(report: ComplianceReport): string {
    const lines = [
      `# ${report.framework.toUpperCase()} Compliance Report`,
      ``,
      `Generated: ${report.timestamp}`,
      ``,
      `## Summary`,
      ``,
      `- **Compliance Score**: ${report.summary.complianceScore}%`,
      `- **Total Controls**: ${report.summary.totalControls}`,
      `- **Passed**: ${report.summary.passed}`,
      `- **Failed**: ${report.summary.failed}`,
      `- **Partial**: ${report.summary.partial}`,
      `- **Not Applicable**: ${report.summary.notApplicable}`,
      ``,
      `## Controls`,
      ``,
    ];

    report.controls.forEach((control) => {
      const statusEmoji = {
        pass: '✅',
        fail: '❌',
        partial: '⚠️',
        not_applicable: '➖',
      }[control.status];

      lines.push(`### ${statusEmoji} ${control.controlId} - ${control.name}`);
      lines.push(``);
      lines.push(`**Description**: ${control.description}`);
      lines.push(``);
      lines.push(`**Status**: ${control.status}`);
      lines.push(``);

      if (control.evidence.length > 0) {
        lines.push(`**Evidence**:`);
        control.evidence.forEach((e) => lines.push(`- ${e}`));
        lines.push(``);
      }

      if (control.recommendations && control.recommendations.length > 0) {
        lines.push(`**Recommendations**:`);
        control.recommendations.forEach((r) => lines.push(`- ${r}`));
        lines.push(``);
      }
    });

    return lines.join('\n');
  }
}
