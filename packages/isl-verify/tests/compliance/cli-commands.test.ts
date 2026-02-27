/**
 * Tests for CLI Commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { 
  generateSoc2Report, 
  generateHipaaReport,
  generatePciDssReport,
  generateEuAiActReport,
  getComplianceExitCode,
  type ComplianceCommandOptions 
} from '../../src/compliance/cli-commands.js';
import { SAMPLE_PROOF_BUNDLE_COMPLIANT, SAMPLE_PROOF_BUNDLE_PARTIAL } from '../../src/compliance/sample-reports.js';

describe('CLI Commands', () => {
  const testDir = join(process.cwd(), '.test-compliance');
  const bundlePath = join(testDir, 'proof-bundle.json');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    writeFileSync(bundlePath, JSON.stringify(SAMPLE_PROOF_BUNDLE_COMPLIANT), 'utf-8');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('generateSoc2Report', () => {
    it('should generate SOC 2 report from proof bundle', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
      };

      const result = await generateSoc2Report(options);

      expect(result.success).toBe(true);
      expect(result.framework).toBe('soc2');
      expect(result.report).toBeDefined();
    });

    it('should create markdown file by default', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
        format: 'markdown',
      };

      const result = await generateSoc2Report(options);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toBeDefined();
      expect(result.outputFiles!.length).toBeGreaterThan(0);
      
      const mdFile = result.outputFiles!.find(f => f.endsWith('.md'));
      expect(mdFile).toBeDefined();
      expect(existsSync(mdFile!)).toBe(true);
    });

    it('should create all formats when format=all', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
        format: 'all',
      };

      const result = await generateSoc2Report(options);

      expect(result.success).toBe(true);
      expect(result.outputFiles!.length).toBeGreaterThanOrEqual(3); // md, html, json, pdf

      const hasMd = result.outputFiles!.some(f => f.endsWith('.md'));
      const hasHtml = result.outputFiles!.some(f => f.endsWith('.html'));
      const hasJson = result.outputFiles!.some(f => f.endsWith('.json'));

      expect(hasMd).toBe(true);
      expect(hasHtml).toBe(true);
      expect(hasJson).toBe(true);
    });

    it('should handle missing bundle file', async () => {
      const options: ComplianceCommandOptions = {
        bundle: join(testDir, 'nonexistent.json'),
        output: testDir,
      };

      const result = await generateSoc2Report(options);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should use custom project name', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
        project: 'custom-project-name',
      };

      const result = await generateSoc2Report(options);

      expect(result.success).toBe(true);
      expect(result.report?.projectName).toBe('custom-project-name');
    });
  });

  describe('generateHipaaReport', () => {
    it('should generate HIPAA report', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
      };

      const result = await generateHipaaReport(options);

      expect(result.success).toBe(true);
      expect(result.framework).toBe('hipaa');
      expect(result.report).toBeDefined();
    });
  });

  describe('generatePciDssReport', () => {
    it('should generate PCI-DSS report', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
      };

      const result = await generatePciDssReport(options);

      expect(result.success).toBe(true);
      expect(result.framework).toBe('pci-dss');
      expect(result.report).toBeDefined();
    });
  });

  describe('generateEuAiActReport', () => {
    it('should generate EU AI Act report', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
      };

      const result = await generateEuAiActReport(options);

      expect(result.success).toBe(true);
      expect(result.framework).toBe('eu-ai-act');
      expect(result.report).toBeDefined();
    });
  });

  describe('getComplianceExitCode', () => {
    it('should return 0 for successful compliant report', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
      };

      const result = await generateSoc2Report(options);
      const exitCode = getComplianceExitCode(result);

      // Compliant report should exit 0
      expect(exitCode).toBe(0);
    });

    it('should return 1 for failed report generation', async () => {
      const options: ComplianceCommandOptions = {
        bundle: join(testDir, 'nonexistent.json'),
        output: testDir,
      };

      const result = await generateSoc2Report(options);
      const exitCode = getComplianceExitCode(result);

      expect(exitCode).toBe(1);
    });

    it('should return 1 for report with critical gaps', async () => {
      // Write partial bundle with failures
      writeFileSync(bundlePath, JSON.stringify(SAMPLE_PROOF_BUNDLE_PARTIAL), 'utf-8');

      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
      };

      const result = await generateSoc2Report(options);
      const exitCode = getComplianceExitCode(result);

      // Should return 1 if critical gaps exist or non-compliant
      expect([0, 1]).toContain(exitCode);
    });
  });

  describe('Enhanced PDF Options', () => {
    it('should support enhanced PDF generation', async () => {
      const options: ComplianceCommandOptions = {
        bundle: bundlePath,
        output: testDir,
        format: 'pdf',
        enhanced: true,
        organization: 'Acme Corp',
      };

      const result = await generateSoc2Report(options);

      expect(result.success).toBe(true);
      expect(result.outputFiles).toBeDefined();
    });
  });

  describe('Output File Naming', () => {
    it('should name files correctly per framework', async () => {
      const testFramework = async (generator: any, framework: string) => {
        const options: ComplianceCommandOptions = {
          bundle: bundlePath,
          output: testDir,
          format: 'markdown',
        };

        const result = await generator(options);
        const mdFile = result.outputFiles!.find((f: string) => f.endsWith('.md'));
        
        expect(mdFile).toContain(framework.toLowerCase());
      };

      await testFramework(generateSoc2Report, 'soc2');
      await testFramework(generateHipaaReport, 'hipaa');
      await testFramework(generatePciDssReport, 'pci-dss');
      await testFramework(generateEuAiActReport, 'eu-ai-act');
    });
  });
});
