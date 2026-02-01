/**
 * Compliance Report Generator
 * 
 * Main entry point for generating compliance reports from ISL specifications.
 * Supports PCI-DSS, SOC2, HIPAA, and GDPR frameworks.
 */

import type {
  Domain,
  ComplianceFramework,
  ComplianceReport,
  ComplianceOptions,
  ControlMapping,
  ComplianceGap,
  VerificationProof,
  ComplianceSummary,
  RiskLevel,
  VerifyResult,
} from './types';
import { PCIDSSFramework } from './frameworks/pci';
import { SOC2Framework } from './frameworks/soc2';
import { HIPAAFramework } from './frameworks/hipaa';
import { GDPRFramework } from './frameworks/gdpr';
import { EvidenceCollector } from './evidence';
import { ComplianceAnalyzer } from './analyzer';

const FRAMEWORK_VERSIONS: Record<ComplianceFramework, string> = {
  'pci-dss': '4.0',
  'soc2': '2017',
  'hipaa': 'Security Rule',
  'gdpr': '2016/679',
};

export class ComplianceGenerator {
  private domain: Domain;
  private options: ComplianceOptions;

  constructor(domain: Domain, options: ComplianceOptions = {}) {
    this.domain = domain;
    this.options = {
      includeEvidence: true,
      includeRecommendations: true,
      outputFormat: 'markdown',
      ...options,
    };
  }

  generate(framework: ComplianceFramework): ComplianceReport {
    const controlMappings = this.mapControls(framework);
    const gaps = this.identifyGaps(controlMappings, framework);
    const verificationProofs = this.collectVerificationProofs();
    const summary = this.calculateSummary(controlMappings);
    const status = this.determineStatus(summary);
    const markdown = this.generateMarkdown(framework, controlMappings, gaps, verificationProofs, summary, status);

    return {
      framework,
      frameworkVersion: FRAMEWORK_VERSIONS[framework],
      domain: this.domain.name,
      domainVersion: this.domain.version,
      generatedAt: new Date().toISOString(),
      status,
      summary,
      controlMappings,
      gaps,
      verificationProofs,
      markdown,
    };
  }

  private mapControls(framework: ComplianceFramework): ControlMapping[] {
    switch (framework) {
      case 'pci-dss':
        return new PCIDSSFramework().mapDomain(this.domain);
      case 'soc2':
        return new SOC2Framework().mapDomain(this.domain);
      case 'hipaa':
        return new HIPAAFramework().mapDomain(this.domain);
      case 'gdpr':
        return new GDPRFramework().mapDomain(this.domain);
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }
  }

  private identifyGaps(controlMappings: ControlMapping[], framework: ComplianceFramework): ComplianceGap[] {
    const gaps: ComplianceGap[] = [];

    for (const mapping of controlMappings) {
      if (mapping.status === 'not_implemented' || mapping.status === 'partial') {
        const gap = this.createGap(mapping, framework);
        gaps.push(gap);
      }
    }

    return gaps.sort((a, b) => {
      const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.priority] - order[b.priority];
    });
  }

  private createGap(mapping: ControlMapping, framework: ComplianceFramework): ComplianceGap {
    const recommendations = this.getRecommendation(mapping, framework);
    
    return {
      controlId: mapping.controlId,
      requirement: mapping.description,
      currentState: mapping.status === 'partial' 
        ? 'Partially implemented' 
        : 'Not implemented',
      recommendation: recommendations.text,
      suggestedISL: recommendations.isl,
      priority: mapping.risk || 'medium',
    };
  }

  private getRecommendation(mapping: ControlMapping, framework: ComplianceFramework): { text: string; isl?: string } {
    const controlLower = mapping.controlName.toLowerCase();

    // Authentication recommendations
    if (controlLower.includes('auth') || controlLower.includes('access')) {
      return {
        text: 'Add authentication and access control specifications',
        isl: `security {
  authentication: "jwt"
  authorization: ["role_check"]
}`,
      };
    }

    // Audit logging recommendations
    if (controlLower.includes('audit') || controlLower.includes('log') || controlLower.includes('monitor')) {
      return {
        text: 'Add observability specifications with audit logging',
        isl: `observability {
  logs [
    { level: "info", message: "Action completed", fields: ["user_id", "action", "timestamp"] }
  ]
  metrics ["request_count", "latency_ms"]
}`,
      };
    }

    // Encryption recommendations
    if (controlLower.includes('encrypt') || controlLower.includes('protect')) {
      return {
        text: 'Add encryption specifications for sensitive data',
        isl: `security {
  encryption {
    algorithm: "AES-256-GCM"
    key_rotation: "90.days"
  }
}`,
      };
    }

    // Data subject rights (GDPR)
    if (controlLower.includes('erasure') || controlLower.includes('delete')) {
      return {
        text: 'Implement data deletion behavior',
        isl: `behavior DeleteUserData {
  input { user_id: UserId }
  
  postcondition user_data_deleted:
    !exists(UserData where user_id == input.user_id)
}`,
      };
    }

    // Key management
    if (controlLower.includes('key')) {
      return {
        text: 'Add key rotation temporal specification',
        isl: `temporal {
  eventually within 90.days: encryption_key_rotated
}`,
      };
    }

    // Default recommendation
    return {
      text: `Implement control: ${mapping.controlName}`,
    };
  }

  private collectVerificationProofs(): VerificationProof[] {
    const proofs: VerificationProof[] = [];

    if (this.options.verifyResults) {
      for (const result of this.options.verifyResults) {
        proofs.push({
          behavior: result.behavior,
          verified: result.passed,
          score: result.score,
          proofBundle: result.proofBundle,
        });
      }
    }

    return proofs;
  }

  private calculateSummary(controlMappings: ControlMapping[]): ComplianceSummary {
    const total = controlMappings.length;
    const implemented = controlMappings.filter(m => m.status === 'implemented').length;
    const partial = controlMappings.filter(m => m.status === 'partial').length;
    const notImplemented = controlMappings.filter(m => m.status === 'not_implemented').length;
    const notApplicable = controlMappings.filter(m => m.status === 'not_applicable').length;

    const applicable = total - notApplicable;
    const compliancePercentage = applicable > 0
      ? Math.round(((implemented + partial * 0.5) / applicable) * 100)
      : 100;

    // Determine overall risk
    let riskLevel: RiskLevel = 'low';
    const criticalGaps = controlMappings.filter(m => m.risk === 'critical' && m.status !== 'implemented');
    const highGaps = controlMappings.filter(m => m.risk === 'high' && m.status !== 'implemented');

    if (criticalGaps.length > 0) riskLevel = 'critical';
    else if (highGaps.length > 0) riskLevel = 'high';
    else if (compliancePercentage < 80) riskLevel = 'medium';

    return {
      totalControls: total,
      implementedControls: implemented,
      partialControls: partial,
      notImplementedControls: notImplemented,
      notApplicableControls: notApplicable,
      compliancePercentage,
      riskLevel,
    };
  }

  private determineStatus(summary: ComplianceSummary): 'compliant' | 'compliant_with_exceptions' | 'non_compliant' {
    if (summary.compliancePercentage >= 95 && summary.riskLevel !== 'critical') {
      return 'compliant';
    }
    if (summary.compliancePercentage >= 70 && summary.riskLevel !== 'critical') {
      return 'compliant_with_exceptions';
    }
    return 'non_compliant';
  }

  private generateMarkdown(
    framework: ComplianceFramework,
    controlMappings: ControlMapping[],
    gaps: ComplianceGap[],
    verificationProofs: VerificationProof[],
    summary: ComplianceSummary,
    status: 'compliant' | 'compliant_with_exceptions' | 'non_compliant'
  ): string {
    const frameworkName = this.getFrameworkName(framework);
    const statusText = status === 'compliant' 
      ? 'COMPLIANT' 
      : status === 'compliant_with_exceptions'
        ? 'COMPLIANT WITH EXCEPTIONS'
        : 'NON-COMPLIANT';

    let md = `# ${frameworkName} Compliance Report

**Domain:** ${this.domain.name} v${this.domain.version}
**Generated:** ${new Date().toISOString().split('T')[0]}
**Status:** ${statusText}

## Executive Summary

The ${this.domain.name} domain has been analyzed for ${frameworkName} v${FRAMEWORK_VERSIONS[framework]} compliance.

- **Controls Implemented:** ${summary.implementedControls}/${summary.totalControls - summary.notApplicableControls} (${summary.compliancePercentage}%)
- **Gaps Identified:** ${gaps.length}
- **Risk Level:** ${summary.riskLevel.charAt(0).toUpperCase() + summary.riskLevel.slice(1)}

## Control Mapping

`;

    // Group controls by category
    const categories = new Map<string, ControlMapping[]>();
    for (const mapping of controlMappings) {
      const category = this.getControlCategory(mapping.controlId, framework);
      const list = categories.get(category) || [];
      list.push(mapping);
      categories.set(category, list);
    }

    for (const [category, mappings] of categories) {
      md += `### ${category}\n\n`;
      md += `| Control | Status | Evidence |\n`;
      md += `|---------|--------|----------|\n`;

      for (const mapping of mappings) {
        const statusIcon = this.getStatusIcon(mapping.status);
        const evidenceText = mapping.evidence.length > 0
          ? mapping.evidence[0].content.substring(0, 50) + (mapping.evidence[0].content.length > 50 ? '...' : '')
          : 'No evidence';
        md += `| ${mapping.controlId} - ${mapping.controlName} | ${statusIcon} ${this.getStatusText(mapping.status)} | ${evidenceText} |\n`;
      }

      md += '\n';

      // Add evidence details for implemented controls
      if (this.options.includeEvidence) {
        const implementedWithEvidence = mappings.filter(m => m.status === 'implemented' && m.evidence.length > 0);
        if (implementedWithEvidence.length > 0) {
          md += `**Evidence:**\n\n`;
          for (const mapping of implementedWithEvidence.slice(0, 3)) {
            md += `- **${mapping.controlId}**: ${mapping.evidence.map(e => e.source).join(', ')}\n`;
          }
          md += '\n';
        }
      }
    }

    // Gaps section
    if (gaps.length > 0 && this.options.includeRecommendations) {
      md += `## Gaps and Recommendations\n\n`;

      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        md += `### Gap ${i + 1}: ${gap.controlId}\n`;
        md += `**Requirement:** ${gap.requirement}\n`;
        md += `**Current State:** ${gap.currentState}\n`;
        md += `**Priority:** ${gap.priority.toUpperCase()}\n`;
        md += `**Recommendation:** ${gap.recommendation}\n`;

        if (gap.suggestedISL) {
          md += `\n\`\`\`isl\n${gap.suggestedISL}\n\`\`\`\n`;
        }
        md += '\n';
      }
    }

    // Verification evidence
    if (verificationProofs.length > 0) {
      md += `## Verification Evidence\n\n`;
      md += `| Behavior | Verified | Score | Proof Bundle |\n`;
      md += `|----------|----------|-------|--------------|\n`;

      for (const proof of verificationProofs) {
        const verifiedIcon = proof.verified ? '✅' : '❌';
        const proofLink = proof.proofBundle ? `[${proof.proofBundle}](./proofs/${proof.proofBundle}.zip)` : 'N/A';
        md += `| ${proof.behavior} | ${verifiedIcon} | ${proof.score}/100 | ${proofLink} |\n`;
      }
      md += '\n';
    }

    return md;
  }

  private getFrameworkName(framework: ComplianceFramework): string {
    switch (framework) {
      case 'pci-dss': return 'PCI-DSS';
      case 'soc2': return 'SOC2';
      case 'hipaa': return 'HIPAA';
      case 'gdpr': return 'GDPR';
    }
  }

  private getControlCategory(controlId: string, framework: ComplianceFramework): string {
    // This is simplified - in production, would look up from framework
    if (framework === 'pci-dss') {
      const reqNum = parseInt(controlId.split('.')[0], 10);
      const categories: Record<number, string> = {
        3: 'Protect Stored Cardholder Data',
        6: 'Develop Secure Systems',
        7: 'Restrict Access',
        8: 'Identify Users',
        10: 'Track and Monitor',
        11: 'Test Security',
        12: 'Information Security',
      };
      return categories[reqNum] || 'Other';
    }
    return 'General';
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'implemented': return '✅';
      case 'partial': return '⚠️';
      case 'not_implemented': return '❌';
      case 'not_applicable': return '➖';
      default: return '❓';
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'implemented': return 'Implemented';
      case 'partial': return 'Partial';
      case 'not_implemented': return 'Not implemented';
      case 'not_applicable': return 'N/A';
      default: return 'Unknown';
    }
  }
}

/**
 * Generate a compliance report for a domain
 */
export function generate(
  domain: Domain,
  framework: ComplianceFramework,
  evidence?: VerifyResult[]
): ComplianceReport {
  const generator = new ComplianceGenerator(domain, { verifyResults: evidence });
  return generator.generate(framework);
}

/**
 * Alias for generate() with more explicit naming
 */
export const generateReport = generate;
