/**
 * Tests for Report Formatters
 */

import { describe, it, expect } from 'vitest';
import { formatMarkdownReport, formatHtmlReport, formatJsonReport } from '../../src/compliance/report-formatter.js';
import { generateSampleSoc2Compliant } from '../../src/compliance/sample-reports.js';

describe('Report Formatters', () => {
  const sampleReport = generateSampleSoc2Compliant();

  describe('Markdown Formatter', () => {
    it('should generate valid markdown', () => {
      const markdown = formatMarkdownReport(sampleReport);

      expect(markdown).toContain('# SOC2 Compliance Evidence');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('## Control Evidence');
    });

    it('should include project metadata', () => {
      const markdown = formatMarkdownReport(sampleReport);

      expect(markdown).toContain(`**Project:** ${sampleReport.projectName}`);
      expect(markdown).toContain('**Generated:**');
      expect(markdown).toContain('**Framework Version:**');
    });

    it('should include executive summary table', () => {
      const markdown = formatMarkdownReport(sampleReport);

      expect(markdown).toContain('| Metric | Count |');
      expect(markdown).toContain('| Total Controls |');
      expect(markdown).toContain('| ✅ Compliant |');
      expect(markdown).toContain('| ❌ Non-Compliant |');
    });

    it('should include controls grouped by category', () => {
      const markdown = formatMarkdownReport(sampleReport);

      // Should have category headers
      expect(markdown).toMatch(/### .+/);
      
      // Should have control headers
      expect(markdown).toMatch(/#### .+ — .+/);
    });

    it('should include evidence details', () => {
      const markdown = formatMarkdownReport(sampleReport);

      expect(markdown).toContain('**Evidence:**');
      expect(markdown).toContain('Method:');
      expect(markdown).toContain('Confidence:');
    });

    it('should include remediation when needed', () => {
      const markdown = formatMarkdownReport(sampleReport);

      // For compliant report, may not have remediation
      // But structure should support it
      if (sampleReport.controls.some(c => c.remediation)) {
        expect(markdown).toContain('**Remediation Required:**');
      }
    });

    it('should include status emojis', () => {
      const markdown = formatMarkdownReport(sampleReport);

      // Should have at least one status emoji
      const hasStatusEmoji = markdown.includes('✅') || 
                            markdown.includes('⚠️') || 
                            markdown.includes('❌');
      expect(hasStatusEmoji).toBe(true);
    });
  });

  describe('HTML Formatter', () => {
    it('should generate valid HTML', () => {
      const html = formatHtmlReport(sampleReport);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include CSS styling', () => {
      const html = formatHtmlReport(sampleReport);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toContain('font-family');
    });

    it('should include project title', () => {
      const html = formatHtmlReport(sampleReport);

      expect(html).toContain(`<title>SOC2 Compliance Report - ${sampleReport.projectName}</title>`);
    });

    it('should include report content', () => {
      const html = formatHtmlReport(sampleReport);

      expect(html).toContain('Executive Summary');
      expect(html).toContain('Control Evidence');
    });

    it('should be print-optimized', () => {
      const html = formatHtmlReport(sampleReport);

      // Should have container with proper styling
      expect(html).toContain('class="container"');
    });
  });

  describe('JSON Formatter', () => {
    it('should generate valid JSON', () => {
      const json = formatJsonReport(sampleReport);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all report fields', () => {
      const json = formatJsonReport(sampleReport);
      const parsed = JSON.parse(json);

      expect(parsed.framework).toBe('soc2');
      expect(parsed.projectName).toBeDefined();
      expect(parsed.executiveSummary).toBeDefined();
      expect(parsed.controls).toBeDefined();
      expect(Array.isArray(parsed.controls)).toBe(true);
    });

    it('should be formatted with indentation', () => {
      const json = formatJsonReport(sampleReport);

      // Should have newlines and indentation
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should preserve all control data', () => {
      const json = formatJsonReport(sampleReport);
      const parsed = JSON.parse(json);

      const control = parsed.controls[0];
      expect(control.controlId).toBeDefined();
      expect(control.controlName).toBeDefined();
      expect(control.status).toBeDefined();
      expect(control.evidence).toBeDefined();
    });
  });

  describe('Format Consistency', () => {
    it('should produce consistent data across formats', () => {
      const markdown = formatMarkdownReport(sampleReport);
      const html = formatHtmlReport(sampleReport);
      const json = formatJsonReport(sampleReport);

      // All should contain project name
      expect(markdown).toContain(sampleReport.projectName);
      expect(html).toContain(sampleReport.projectName);
      expect(json).toContain(sampleReport.projectName);

      // All should contain framework
      expect(markdown.toLowerCase()).toContain('soc2');
      expect(html.toLowerCase()).toContain('soc2');
      expect(json.toLowerCase()).toContain('soc2');
    });

    it('should include same number of controls', () => {
      const json = formatJsonReport(sampleReport);
      const parsed = JSON.parse(json);

      expect(parsed.controls.length).toBe(sampleReport.controls.length);
    });
  });
});
