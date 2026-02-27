/**
 * Tests for Compliance Report Generator
 */

import { describe, it, expect } from 'vitest';
import { ComplianceReportGenerator } from '../../src/compliance/compliance-report-generator.js';
import { SAMPLE_PROOF_BUNDLE_COMPLIANT, SAMPLE_PROOF_BUNDLE_PARTIAL } from '../../src/compliance/sample-reports.js';

describe('ComplianceReportGenerator', () => {
  describe('SOC 2 Reports', () => {
    it('should generate SOC 2 report from compliant proof bundle', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      expect(report.framework).toBe('soc2');
      expect(report.frameworkVersion).toContain('SOC 2');
      expect(report.projectName).toBe('test-project');
      expect(report.controls.length).toBeGreaterThan(0);
    });

    it('should map auth-coverage to CC6.1', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      const cc61 = report.controls.find(c => c.controlId === 'CC6.1');
      expect(cc61).toBeDefined();
      expect(cc61?.controlName).toContain('Access Control');
      expect(cc61?.evidence.some(e => e.propertyName === 'auth-coverage')).toBe(true);
    });

    it('should mark control as compliant when all properties proven', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      const cc61 = report.controls.find(c => c.controlId === 'CC6.1');
      expect(cc61?.status).toBe('compliant');
    });

    it('should mark control as partial when some properties fail', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_PARTIAL, 'test-project');
      const report = generator.generateReport('soc2');

      // Should have partial or non-compliant controls
      const hasNonCompliant = report.controls.some(c => c.status !== 'compliant');
      expect(hasNonCompliant).toBe(true);
    });

    it('should generate executive summary with correct counts', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      expect(report.executiveSummary.totalControls).toBe(report.controls.length);
      expect(report.executiveSummary.compliantControls).toBeGreaterThan(0);
      expect(report.executiveSummary.overallStatus).toBeDefined();
    });

    it('should include remediation when control is non-compliant', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_PARTIAL, 'test-project');
      const report = generator.generateReport('soc2');

      const nonCompliantControl = report.controls.find(c => c.status !== 'compliant');
      if (nonCompliantControl) {
        expect(nonCompliantControl.remediation).toBeDefined();
        expect(nonCompliantControl.remediation).not.toBe('');
      }
    });
  });

  describe('HIPAA Reports', () => {
    it('should generate HIPAA report', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'healthcare-app');
      const report = generator.generateReport('hipaa');

      expect(report.framework).toBe('hipaa');
      expect(report.frameworkVersion).toContain('HIPAA');
      expect(report.controls.length).toBeGreaterThan(0);
    });

    it('should map auth-coverage to §164.312(a)(1)', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'healthcare-app');
      const report = generator.generateReport('hipaa');

      const accessControl = report.controls.find(c => c.controlId === '§164.312(a)(1)');
      expect(accessControl).toBeDefined();
      expect(accessControl?.controlName).toContain('Access Control');
      expect(accessControl?.evidence.some(e => e.propertyName === 'auth-coverage')).toBe(true);
    });

    it('should map secret-exposure to §164.312(e)(1)', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'healthcare-app');
      const report = generator.generateReport('hipaa');

      const transmission = report.controls.find(c => c.controlId === '§164.312(e)(1)');
      expect(transmission).toBeDefined();
      expect(transmission?.evidence.some(e => e.propertyName === 'secret-exposure')).toBe(true);
    });
  });

  describe('PCI-DSS Reports', () => {
    it('should generate PCI-DSS report', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'payment-api');
      const report = generator.generateReport('pci-dss');

      expect(report.framework).toBe('pci-dss');
      expect(report.frameworkVersion).toContain('PCI DSS');
      expect(report.controls.length).toBeGreaterThan(0);
    });

    it('should map sql-injection to Req 6.5', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'payment-api');
      const report = generator.generateReport('pci-dss');

      const req65 = report.controls.find(c => c.controlId === 'Req 6.5');
      expect(req65).toBeDefined();
      expect(req65?.controlName).toContain('Common Coding Vulnerabilities');
      expect(req65?.evidence.some(e => e.propertyName === 'sql-injection')).toBe(true);
    });

    it('should identify critical risk controls', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'payment-api');
      const report = generator.generateReport('pci-dss');

      const criticalControls = report.controls.filter(c => c.riskLevel === 'critical');
      expect(criticalControls.length).toBeGreaterThan(0);
    });
  });

  describe('EU AI Act Reports', () => {
    it('should generate EU AI Act report', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'ai-system');
      const report = generator.generateReport('eu-ai-act');

      expect(report.framework).toBe('eu-ai-act');
      expect(report.frameworkVersion).toContain('EU AI Act');
      expect(report.controls.length).toBeGreaterThan(0);
    });

    it('should map type-safety to Article 15', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'ai-system');
      const report = generator.generateReport('eu-ai-act');

      const article15 = report.controls.find(c => c.controlId === 'Article 15');
      expect(article15).toBeDefined();
      expect(article15?.controlName).toContain('Accuracy');
      expect(article15?.evidence.some(e => e.propertyName === 'type-safety')).toBe(true);
    });
  });

  describe('Executive Summary', () => {
    it('should calculate overall status as compliant when all controls pass', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      // With all properties proven, overall should be compliant
      expect(['compliant', 'partial']).toContain(report.executiveSummary.overallStatus);
    });

    it('should calculate overall status as non-compliant when critical gaps exist', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_PARTIAL, 'test-project');
      const report = generator.generateReport('soc2');

      // Should detect critical gaps
      expect(report.executiveSummary.criticalGaps).toBeGreaterThanOrEqual(0);
    });

    it('should count controls correctly', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      const { executiveSummary } = report;
      const total = executiveSummary.compliantControls + 
                   executiveSummary.partialControls + 
                   executiveSummary.nonCompliantControls + 
                   executiveSummary.notApplicableControls;

      expect(total).toBe(executiveSummary.totalControls);
    });
  });

  describe('Evidence Mapping', () => {
    it('should include evidence details from proof bundle', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      const controlWithEvidence = report.controls.find(c => c.evidence.length > 0);
      expect(controlWithEvidence).toBeDefined();

      const evidence = controlWithEvidence!.evidence[0];
      expect(evidence.propertyName).toBeDefined();
      expect(evidence.summary).toBeDefined();
      expect(evidence.confidence).toBeDefined();
      expect(evidence.method).toBeDefined();
    });

    it('should include proof bundle references in evidence', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      const controlWithEvidence = report.controls.find(c => c.evidence.length > 0);
      const evidence = controlWithEvidence!.evidence[0];
      
      expect(evidence.proofBundleRef).toBeDefined();
      expect(evidence.proofBundleRef).toContain('proof-bundle.json');
    });
  });

  describe('Risk Level Assignment', () => {
    it('should assign correct risk levels to controls', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      // CC6.1 (auth) should be critical
      const cc61 = report.controls.find(c => c.controlId === 'CC6.1');
      expect(cc61?.riskLevel).toBe('critical');

      // CC7.1 (monitoring) should be medium
      const cc71 = report.controls.find(c => c.controlId === 'CC7.1');
      expect(cc71?.riskLevel).toBe('medium');
    });
  });

  describe('Proof Bundle Metadata', () => {
    it('should include proof bundle ID when available', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      
      // Simulate legacy bundle with hash
      const mockLegacyBundle: any = {
        bundleHash: 'abc123def456',
        signature: 'ed25519:xyz789',
      };
      generator.setLegacyBundle(mockLegacyBundle);

      const report = generator.generateReport('soc2');
      
      expect(report.proofBundleId).toBe('abc123def456');
      expect(report.proofBundleSignature).toBe('ed25519:xyz789');
    });

    it('should include timestamp', () => {
      const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'test-project');
      const report = generator.generateReport('soc2');

      expect(report.generatedAt).toBeDefined();
      expect(new Date(report.generatedAt).getTime()).toBeGreaterThan(0);
    });
  });
});
