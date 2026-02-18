/**
 * Compliance Report Generator
 * 
 * Maps ISL Verify proof bundle properties to compliance framework controls
 * Generates formatted reports for SOC 2, HIPAA, PCI-DSS, and EU AI Act
 */

import type { PropertyProof, ProofBundle } from '../proof/types.js';
import type { ProofBundleV1 } from '@isl-lang/proof';

export type ComplianceFramework = 'soc2' | 'hipaa' | 'pci-dss' | 'eu-ai-act';

export type ControlStatus = 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';

export interface ComplianceControl {
  controlId: string;
  controlName: string;
  category: string;
  description: string;
  status: ControlStatus;
  evidence: ComplianceEvidence[];
  remediation?: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface ComplianceEvidence {
  propertyName: string;
  propertyStatus: string;
  summary: string;
  confidence: string;
  method: string;
  evidenceCount: number;
  proofBundleRef?: string;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  frameworkVersion: string;
  projectName: string;
  generatedAt: string;
  proofBundleId?: string;
  proofBundleSignature?: string;
  executiveSummary: ExecutiveSummary;
  controls: ComplianceControl[];
  toolVersion: string;
}

export interface ExecutiveSummary {
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  nonCompliantControls: number;
  notApplicableControls: number;
  overallStatus: 'compliant' | 'partial' | 'non-compliant';
  criticalGaps: number;
  highPriorityGaps: number;
}

export interface PropertyToControlMapping {
  controlId: string;
  controlName: string;
  category: string;
  description: string;
  propertyNames: string[];
  requiredForCompliance: boolean;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * SOC 2 Type II Trust Services Criteria mappings
 */
const SOC2_MAPPINGS: PropertyToControlMapping[] = [
  {
    controlId: 'CC6.1',
    controlName: 'Logical and Physical Access Controls',
    category: 'Common Criteria - Security',
    description: "The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.",
    propertyNames: ['auth-coverage', 'auth-enforcement'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
  {
    controlId: 'CC6.6',
    controlName: 'System Operations',
    category: 'Common Criteria - Security',
    description: 'The entity implements logical access security measures to protect against threats from sources outside its system boundaries.',
    propertyNames: ['error-handling', 'input-validation'],
    requiredForCompliance: true,
    riskLevel: 'high',
  },
  {
    controlId: 'CC6.8',
    controlName: 'Change Management',
    category: 'Common Criteria - Security',
    description: 'The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.',
    propertyNames: ['import-integrity', 'type-safety'],
    requiredForCompliance: true,
    riskLevel: 'medium',
  },
  {
    controlId: 'CC7.1',
    controlName: 'System Monitoring',
    category: 'Common Criteria - Monitoring',
    description: 'To meet its objectives, the entity uses detection and monitoring procedures to identify anomalies.',
    propertyNames: ['type-safety', 'import-integrity', 'error-handling'],
    requiredForCompliance: true,
    riskLevel: 'medium',
  },
  {
    controlId: 'CC8.1',
    controlName: 'Change Management',
    category: 'Common Criteria - Change Management',
    description: 'The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.',
    propertyNames: ['secret-exposure', 'data-leakage'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
];

/**
 * HIPAA Security Rule mappings
 */
const HIPAA_MAPPINGS: PropertyToControlMapping[] = [
  {
    controlId: '§164.312(a)(1)',
    controlName: 'Access Control',
    category: 'Administrative Safeguards',
    description: 'Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.',
    propertyNames: ['auth-coverage', 'auth-enforcement'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
  {
    controlId: '§164.312(e)(1)',
    controlName: 'Transmission Security',
    category: 'Technical Safeguards',
    description: 'Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.',
    propertyNames: ['secret-exposure', 'data-leakage'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
  {
    controlId: '§164.312(c)(1)',
    controlName: 'Integrity',
    category: 'Technical Safeguards',
    description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction.',
    propertyNames: ['type-safety', 'input-validation', 'sql-injection'],
    requiredForCompliance: true,
    riskLevel: 'high',
  },
  {
    controlId: '§164.308(a)(1)(ii)(B)',
    controlName: 'Risk Management',
    category: 'Administrative Safeguards',
    description: 'Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level.',
    propertyNames: ['error-handling', 'xss-prevention', 'sql-injection'],
    requiredForCompliance: true,
    riskLevel: 'high',
  },
];

/**
 * PCI-DSS v4.0 mappings
 */
const PCI_DSS_MAPPINGS: PropertyToControlMapping[] = [
  {
    controlId: 'Req 6.5',
    controlName: 'Address Common Coding Vulnerabilities',
    category: 'Secure Development',
    description: 'Develop and maintain secure systems and software by addressing common coding vulnerabilities including SQL injection, XSS, and improper error handling.',
    propertyNames: ['sql-injection', 'xss-prevention', 'input-validation', 'error-handling'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
  {
    controlId: 'Req 6.6',
    controlName: 'Public-Facing Web Applications',
    category: 'Secure Development',
    description: 'For public-facing web applications, address new threats and vulnerabilities on an ongoing basis and ensure these applications are protected against known attacks.',
    propertyNames: ['auth-coverage', 'input-validation', 'sql-injection'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
  {
    controlId: 'Req 8.2',
    controlName: 'User Authentication',
    category: 'Access Control',
    description: 'In addition to assigning a unique ID, ensure proper user-authentication management for non-consumer users and administrators on all system components.',
    propertyNames: ['auth-coverage', 'auth-enforcement', 'secret-exposure'],
    requiredForCompliance: true,
    riskLevel: 'critical',
  },
  {
    controlId: 'Req 2.2',
    controlName: 'Configuration Standards',
    category: 'System Configuration',
    description: 'Develop configuration standards for all system components that are consistent with industry-accepted system hardening standards.',
    propertyNames: ['type-safety', 'error-handling', 'import-integrity'],
    requiredForCompliance: true,
    riskLevel: 'medium',
  },
];

/**
 * EU AI Act mappings
 */
const EU_AI_ACT_MAPPINGS: PropertyToControlMapping[] = [
  {
    controlId: 'Article 9',
    controlName: 'Risk Management System',
    category: 'Risk Management',
    description: 'High-risk AI systems shall be designed and developed with a risk management system consisting of a continuous iterative process throughout the entire lifecycle of the system.',
    propertyNames: ['type-safety', 'error-handling', 'input-validation', 'auth-coverage', 'import-integrity'],
    requiredForCompliance: true,
    riskLevel: 'high',
  },
  {
    controlId: 'Article 15',
    controlName: 'Accuracy, Robustness and Cybersecurity',
    category: 'Technical Requirements',
    description: 'High-risk AI systems shall be designed and developed in such a way to achieve appropriate levels of accuracy, robustness and cybersecurity.',
    propertyNames: ['type-safety', 'input-validation', 'error-handling'],
    requiredForCompliance: true,
    riskLevel: 'high',
  },
  {
    controlId: 'Article 12',
    controlName: 'Record-keeping',
    category: 'Transparency',
    description: 'High-risk AI systems shall be designed and developed with capabilities enabling the automatic recording of events (logs) over the lifetime of the system.',
    propertyNames: ['import-integrity', 'type-safety'],
    requiredForCompliance: true,
    riskLevel: 'medium',
  },
  {
    controlId: 'Article 10',
    controlName: 'Data and Data Governance',
    category: 'Data Quality',
    description: 'High-risk AI systems shall be designed and developed with data and data governance measures ensuring data quality.',
    propertyNames: ['input-validation', 'sql-injection', 'data-leakage'],
    requiredForCompliance: true,
    riskLevel: 'high',
  },
];

export class ComplianceReportGenerator {
  private proofBundle: ProofBundle;
  private legacyBundle?: ProofBundleV1;
  private projectName: string;

  constructor(proofBundle: ProofBundle, projectName: string = 'ISL-Verified-Project') {
    this.proofBundle = proofBundle;
    this.projectName = projectName;
  }

  setLegacyBundle(bundle: ProofBundleV1): void {
    this.legacyBundle = bundle;
  }

  /**
   * Generate compliance report for specified framework
   */
  generateReport(framework: ComplianceFramework): ComplianceReport {
    const mappings = this.getFrameworkMappings(framework);
    const controls = this.mapPropertiesToControls(mappings);
    const executiveSummary = this.generateExecutiveSummary(controls);

    return {
      framework,
      frameworkVersion: this.getFrameworkVersion(framework),
      projectName: this.projectName,
      generatedAt: new Date().toISOString(),
      proofBundleId: this.legacyBundle?.bundleHash,
      proofBundleSignature: this.legacyBundle?.signature,
      executiveSummary,
      controls,
      toolVersion: 'ISL Verify 1.0.0',
    };
  }

  /**
   * Get framework-specific mappings
   */
  private getFrameworkMappings(framework: ComplianceFramework): PropertyToControlMapping[] {
    switch (framework) {
      case 'soc2':
        return SOC2_MAPPINGS;
      case 'hipaa':
        return HIPAA_MAPPINGS;
      case 'pci-dss':
        return PCI_DSS_MAPPINGS;
      case 'eu-ai-act':
        return EU_AI_ACT_MAPPINGS;
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }
  }

  /**
   * Get framework version string
   */
  private getFrameworkVersion(framework: ComplianceFramework): string {
    switch (framework) {
      case 'soc2':
        return 'SOC 2 Type II (2017 Trust Services Criteria)';
      case 'hipaa':
        return 'HIPAA Security Rule (45 CFR Part 164)';
      case 'pci-dss':
        return 'PCI DSS v4.0';
      case 'eu-ai-act':
        return 'EU AI Act (2024)';
      default:
        return 'Unknown';
    }
  }

  /**
   * Map property proofs to compliance controls
   */
  private mapPropertiesToControls(mappings: PropertyToControlMapping[]): ComplianceControl[] {
    return mappings.map(mapping => {
      const relevantProofs = this.proofBundle.properties.filter(p =>
        mapping.propertyNames.includes(p.property)
      );

      const evidence = this.buildEvidence(relevantProofs);
      const status = this.determineControlStatus(relevantProofs, mapping.requiredForCompliance);
      const remediation = status !== 'compliant' ? this.generateRemediation(mapping, relevantProofs) : undefined;

      return {
        controlId: mapping.controlId,
        controlName: mapping.controlName,
        category: mapping.category,
        description: mapping.description,
        status,
        evidence,
        remediation,
        riskLevel: mapping.riskLevel,
      };
    });
  }

  /**
   * Build evidence from property proofs
   */
  private buildEvidence(proofs: PropertyProof[]): ComplianceEvidence[] {
    return proofs.map(proof => ({
      propertyName: proof.property,
      propertyStatus: proof.status,
      summary: proof.summary,
      confidence: proof.confidence,
      method: proof.method,
      evidenceCount: Array.isArray(proof.evidence) ? proof.evidence.length : 0,
      proofBundleRef: `proof-bundle.json#/properties/${proof.property}`,
    }));
  }

  /**
   * Determine control compliance status
   */
  private determineControlStatus(proofs: PropertyProof[], required: boolean): ControlStatus {
    if (proofs.length === 0) {
      return required ? 'non-compliant' : 'not-applicable';
    }

    const provenCount = proofs.filter(p => p.status === 'PROVEN').length;
    const partialCount = proofs.filter(p => p.status === 'PARTIAL').length;
    const failedCount = proofs.filter(p => p.status === 'FAILED').length;

    if (provenCount === proofs.length) {
      return 'compliant';
    }

    if (failedCount > 0 && required) {
      return 'non-compliant';
    }

    if (provenCount > 0 || partialCount > 0) {
      return 'partial';
    }

    return 'non-compliant';
  }

  /**
   * Generate remediation recommendations
   */
  private generateRemediation(mapping: PropertyToControlMapping, proofs: PropertyProof[]): string {
    const failedProps = proofs.filter(p => p.status === 'FAILED' || p.status === 'NOT_VERIFIED');
    const partialProps = proofs.filter(p => p.status === 'PARTIAL');

    const recommendations: string[] = [];

    if (failedProps.length > 0) {
      recommendations.push(`**Critical Issues:** ${failedProps.length} property check(s) failed:`);
      failedProps.forEach(p => {
        recommendations.push(`  - ${p.property}: ${p.summary}`);
        if (p.findings.length > 0) {
          p.findings.slice(0, 3).forEach(f => {
            recommendations.push(`    → ${f.message} (${f.file}:${f.line})`);
          });
        }
      });
    }

    if (partialProps.length > 0) {
      recommendations.push(`**Partial Compliance:** ${partialProps.length} property check(s) need improvement:`);
      partialProps.forEach(p => {
        recommendations.push(`  - ${p.property}: ${p.summary}`);
      });
    }

    if (proofs.length === 0) {
      recommendations.push(`**Not Verified:** This control requires verification of: ${mapping.propertyNames.join(', ')}`);
      recommendations.push(`Run ISL Verify to generate proof bundle for these properties.`);
    }

    return recommendations.join('\n');
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(controls: ComplianceControl[]): ExecutiveSummary {
    const totalControls = controls.length;
    const compliantControls = controls.filter(c => c.status === 'compliant').length;
    const partialControls = controls.filter(c => c.status === 'partial').length;
    const nonCompliantControls = controls.filter(c => c.status === 'non-compliant').length;
    const notApplicableControls = controls.filter(c => c.status === 'not-applicable').length;

    const criticalGaps = controls.filter(
      c => (c.status === 'non-compliant' || c.status === 'partial') && c.riskLevel === 'critical'
    ).length;

    const highPriorityGaps = controls.filter(
      c => (c.status === 'non-compliant' || c.status === 'partial') && c.riskLevel === 'high'
    ).length;

    let overallStatus: 'compliant' | 'partial' | 'non-compliant';
    if (nonCompliantControls === 0 && partialControls === 0) {
      overallStatus = 'compliant';
    } else if (criticalGaps > 0 || nonCompliantControls > compliantControls) {
      overallStatus = 'non-compliant';
    } else {
      overallStatus = 'partial';
    }

    return {
      totalControls,
      compliantControls,
      partialControls,
      nonCompliantControls,
      notApplicableControls,
      overallStatus,
      criticalGaps,
      highPriorityGaps,
    };
  }
}
