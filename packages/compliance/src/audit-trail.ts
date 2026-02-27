/**
 * CISO Audit Trail Generator
 * 
 * Generates comprehensive audit trails for compliance reporting
 */

import type { Domain, ComplianceReport, ControlMapping } from './types';
import { createHash } from 'crypto';

export interface AuditTrail {
  id: string;
  timestamp: string;
  framework: string;
  organization: string;
  system: string;
  version: string;
  summary: AuditSummary;
  controls: AuditControl[];
  evidence: AuditEvidence[];
  changes: AuditChange[];
  attestations: AuditAttestation[];
}

export interface AuditSummary {
  totalControls: number;
  implementedControls: number;
  partialControls: number;
  notImplementedControls: number;
  overallCompliance: number;
  criticalGaps: number;
  highRiskGaps: number;
  lastUpdated: string;
}

export interface AuditControl {
  controlId: string;
  controlName: string;
  category: string;
  status: 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';
  risk: 'critical' | 'high' | 'medium' | 'low';
  evidenceCount: number;
  lastVerified: string;
  verifiedBy: string;
  artifacts: string[];
}

export interface AuditEvidence {
  id: string;
  controlId: string;
  type: 'isl_spec' | 'verification' | 'test' | 'scan' | 'manual' | 'entity' | 'behavior' | 'annotation';
  description: string;
  source: string;
  timestamp: string;
  hash: string;
  confidence: number;
  artifacts: string[];
}

export interface AuditChange {
  id: string;
  timestamp: string;
  type: 'control_added' | 'control_removed' | 'status_changed' | 'evidence_added' | 'evidence_removed';
  description: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
}

export interface AuditAttestation {
  id: string;
  controlId?: string;
  type: 'system' | 'control' | 'evidence';
  attestant: string;
  role: string;
  statement: string;
  timestamp: string;
  status: 'active' | 'expired' | 'revoked';
  evidence: string[];
}

export class AuditTrailGenerator {
  generateAuditTrail(
    domain: Domain,
    complianceReport: ComplianceReport,
    options: {
      organization: string;
      system: string;
      version: string;
      verifiedBy: string;
    }
  ): AuditTrail {
    const auditId = this.generateAuditId(domain, options);
    const timestamp = new Date().toISOString();

    return {
      id: auditId,
      timestamp,
      framework: complianceReport.framework,
      organization: options.organization,
      system: options.system,
      version: options.version,
      summary: this.generateSummary(complianceReport),
      controls: this.generateControls(complianceReport.controlMappings, options.verifiedBy),
      evidence: this.generateEvidence(complianceReport.controlMappings),
      changes: [], // Would be populated from historical data
      attestations: this.generateAttestations(options.verifiedBy),
    };
  }

  private generateAuditId(domain: Domain, options: any): string {
    const input = `${domain.name}-${options.system}-${options.version}-${Date.now()}`;
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  private generateSummary(report: ComplianceReport): AuditSummary {
    const total = report.controlMappings.length;
    const implemented = report.controlMappings.filter(c => c.status === 'implemented').length;
    const partial = report.controlMappings.filter(c => c.status === 'partial').length;
    const notImplemented = report.controlMappings.filter(c => c.status === 'not_implemented').length;
    const criticalGaps = report.controlMappings.filter(c => c.risk === 'critical').length;
    const highRiskGaps = report.controlMappings.filter(c => c.risk === 'high').length;

    return {
      totalControls: total,
      implementedControls: implemented,
      partialControls: partial,
      notImplementedControls: notImplemented,
      overallCompliance: Math.round((implemented / total) * 100),
      criticalGaps,
      highRiskGaps,
      lastUpdated: new Date().toISOString(),
    };
  }

  private generateControls(controlMappings: ControlMapping[], verifiedBy: string): AuditControl[] {
    return controlMappings.map(mapping => ({
      controlId: mapping.controlId,
      controlName: mapping.controlName,
      category: mapping.category || 'Unknown',
      status: mapping.status as 'implemented' | 'partial' | 'not_implemented' | 'not_applicable',
      risk: (mapping.risk === 'info' ? 'low' : mapping.risk) as 'critical' | 'high' | 'medium' | 'low',
      evidenceCount: mapping.evidence.length,
      lastVerified: new Date().toISOString(),
      verifiedBy,
      artifacts: this.generateArtifacts(mapping),
    }));
  }

  private generateEvidence(controlMappings: ControlMapping[]): AuditEvidence[] {
    const evidence: AuditEvidence[] = [];
    
    controlMappings.forEach(mapping => {
      mapping.evidence.forEach((e, index) => {
        evidence.push({
          id: `${mapping.controlId}-evidence-${index}`,
          controlId: mapping.controlId,
          type: e.type as 'isl_spec' | 'verification' | 'test' | 'scan' | 'manual' | 'entity' | 'behavior' | 'annotation',
          description: e.description || '',
          source: e.source,
          timestamp: new Date().toISOString(),
          hash: this.generateHash(e.source),
          confidence: e.confidence || 0.5,
          artifacts: [],
        });
      });
    });

    return evidence;
  }

  private generateArtifacts(mapping: ControlMapping): string[] {
    const artifacts: string[] = [];
    
    // Add ISL spec artifact
    artifacts.push('isl-specification.isl');
    
    // Add verification artifacts
    if (mapping.evidence.some(e => e.type === 'verification')) {
      artifacts.push('verification-report.json');
      artifacts.push('trust-score.json');
    }
    
    // Add test artifacts
    if (mapping.evidence.some(e => e.type === 'behavior' || e.type === 'entity')) {
      artifacts.push('test-results.xml');
      artifacts.push('coverage-report.html');
    }
    
    // Add security scan artifacts
    if (mapping.evidence.some(e => e.type === 'annotation')) {
      artifacts.push('security-scan.json');
      artifacts.push('dependency-audit.json');
    }
    
    return artifacts;
  }

  private generateAttestations(verifiedBy: string): AuditAttestation[] {
    return [
      {
        id: 'system-attestation-1',
        type: 'system',
        attestant: verifiedBy,
        role: 'Security Officer',
        statement: 'I attest that this system has been reviewed and meets the compliance requirements based on ISL verification evidence.',
        timestamp: new Date().toISOString(),
        status: 'active',
        evidence: ['isl-specification.isl', 'verification-report.json'],
      },
    ];
  }

  private generateHash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  exportCISOReport(auditTrail: AuditTrail): string {
    return `
# CISO Compliance Audit Report

**Organization:** ${auditTrail.organization}
**System:** ${auditTrail.system}
**Framework:** ${auditTrail.framework.toUpperCase()}
**Report Date:** ${auditTrail.timestamp}
**Audit ID:** ${auditTrail.id}

## Executive Summary

- **Overall Compliance:** ${auditTrail.summary.overallCompliance}%
- **Controls Implemented:** ${auditTrail.summary.implementedControls}/${auditTrail.summary.totalControls}
- **Critical Gaps:** ${auditTrail.summary.criticalGaps}
- **High-Risk Gaps:** ${auditTrail.summary.highRiskGaps}

## Compliance Status

| Status | Count | Percentage |
|--------|-------|------------|
| Implemented | ${auditTrail.summary.implementedControls} | ${Math.round((auditTrail.summary.implementedControls / auditTrail.summary.totalControls) * 100)}% |
| Partial | ${auditTrail.summary.partialControls} | ${Math.round((auditTrail.summary.partialControls / auditTrail.summary.totalControls) * 100)}% |
| Not Implemented | ${auditTrail.summary.notImplementedControls} | ${Math.round((auditTrail.summary.notImplementedControls / auditTrail.summary.totalControls) * 100)}% |

## Critical Findings

${auditTrail.controls
  .filter(c => c.risk === 'critical')
  .map(c => `- **${c.controlId}**: ${c.controlName} - ${c.status.toUpperCase()}`)
  .join('\n')}

## Evidence Summary

Total evidence artifacts: ${auditTrail.evidence.length}
- ISL Specifications: ${auditTrail.evidence.filter(e => e.type === 'isl_spec').length}
- Verification Results: ${auditTrail.evidence.filter(e => e.type === 'verification').length}
- Test Results: ${auditTrail.evidence.filter(e => e.type === 'test').length}
- Security Scans: ${auditTrail.evidence.filter(e => e.type === 'scan').length}

## Attestations

${auditTrail.attestations
  .map(a => `- **${a.attestant}** (${a.role}): ${a.statement}`)
  .join('\n')}

## Recommendation

${auditTrail.summary.overallCompliance >= 80 
  ? '✅ System meets compliance requirements and is approved for production deployment.'
  : auditTrail.summary.overallCompliance >= 60
  ? '⚠️ System requires remediation of critical gaps before production deployment.'
  : '❌ System is not compliant and requires significant remediation.'}

---
*This report was generated automatically by ISL compliance analysis on ${auditTrail.timestamp}*
    `.trim();
  }
}
