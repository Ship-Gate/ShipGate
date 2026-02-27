import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, renderClausesOnly, renderBannerOnly } from '../src/renderer.js';
import { getStyles } from '../src/styles.js';
import type { EvidenceReport } from '@isl-lang/evidence-schema';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): EvidenceReport {
  const json = readFileSync(join(__dirname, `../fixtures/${name}`), 'utf-8');
  return JSON.parse(json);
}

describe('Evidence HTML Renderer', () => {
  describe('render', () => {
    it('should render SHIP report correctly', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report);

      // Check banner
      expect(html).toContain('evidence-banner--ship');
      expect(html).toContain('SHIP');
      expect(html).toContain('100%');

      // Check clauses
      expect(html).toContain('user-001');
      expect(html).toContain('Create user returns valid ID');
      expect(html).toContain('evidence-status--pass');

      // Check metadata
      expect(html).toContain('UserService');
      expect(html).toContain('abc1234');
    });

    it('should render NO_SHIP report correctly', () => {
      const report = loadFixture('no-ship-report.json');
      const html = render(report);

      // Check banner
      expect(html).toContain('evidence-banner--no-ship');
      expect(html).toContain('NO_SHIP');
      expect(html).toContain('33%');

      // Check clauses with different statuses
      expect(html).toContain('evidence-status--pass');
      expect(html).toContain('evidence-status--partial');
      expect(html).toContain('evidence-status--fail');

      // Check error message
      expect(html).toContain('Expected inventory to decrease by 2');

      // Check assumptions
      expect(html).toContain('Inventory service is operational');
      expect(html).toContain('evidence-risk--medium');
      expect(html).toContain('evidence-risk--high');

      // Check open questions
      expect(html).toContain('Should we support backorders?');
      expect(html).toContain('Review with product team');

      // Check repro commands
      expect(html).toContain('pnpm test:orders');
      expect(html).toContain('DEBUG=orders:*');
    });

    it('should include styles by default', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report);

      expect(html).toContain('<style>');
      expect(html).toContain('.evidence-report');
    });

    it('should exclude styles when requested', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, { includeStyles: false });

      expect(html).not.toContain('<style>');
    });

    it('should generate full document when requested', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, { fullDocument: true });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should use custom title for full document', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, {
        fullDocument: true,
        title: 'Custom Report Title',
      });

      expect(html).toContain('<title>Custom Report Title</title>');
    });

    it('should use minimal styles when requested', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, { styleVariant: 'minimal' });

      // Extract the style tag content
      const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
      expect(styleMatch).toBeTruthy();
      const styleContent = styleMatch![1];

      // Minimal styles don't have CSS custom properties in the style block
      expect(styleContent).not.toContain('--evidence-');
      expect(styleContent).toContain('.evidence-report');
    });

    it('should include custom styles', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, {
        customStyles: '.my-custom-class { color: red; }',
      });

      expect(html).toContain('.my-custom-class { color: red; }');
    });

    it('should escape HTML in text content', () => {
      const report: EvidenceReport = {
        schemaVersion: '1.0.0',
        verdict: 'SHIP',
        summary: {
          totalClauses: 1,
          passedClauses: 1,
          partialClauses: 0,
          failedClauses: 0,
          passRate: 100,
          totalDurationMs: 10,
        },
        metadata: {
          contractName: '<script>alert("xss")</script>',
          verifierVersion: '1.0.0',
        },
        clauses: [
          {
            id: 'test',
            name: 'Test <b>bold</b>',
            status: 'PASS',
            evidence: [],
          },
        ],
        assumptions: [],
        openQuestions: [],
        reproCommands: [],
      };

      const html = render(report);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('should handle empty clauses', () => {
      const report: EvidenceReport = {
        schemaVersion: '1.0.0',
        verdict: 'SHIP',
        summary: {
          totalClauses: 0,
          passedClauses: 0,
          partialClauses: 0,
          failedClauses: 0,
          passRate: 0,
          totalDurationMs: 0,
        },
        metadata: {
          contractName: 'EmptyTest',
          verifierVersion: '1.0.0',
        },
        clauses: [],
        assumptions: [],
        openQuestions: [],
        reproCommands: [],
      };

      const html = render(report);

      expect(html).toContain('No clauses to display');
    });

    it('should handle empty assumptions', () => {
      const report = loadFixture('ship-report.json');
      report.assumptions = [];
      const html = render(report);

      expect(html).toContain('No assumptions documented');
    });
  });

  describe('renderClausesOnly', () => {
    it('should render only the clause table', () => {
      const report = loadFixture('ship-report.json');
      const html = renderClausesOnly(report.clauses);

      expect(html).toContain('<table');
      expect(html).toContain('user-001');
      expect(html).not.toContain('evidence-banner');
      expect(html).not.toContain('<style>');
    });
  });

  describe('renderBannerOnly', () => {
    it('should render only the score banner', () => {
      const report = loadFixture('ship-report.json');
      const html = renderBannerOnly(report);

      expect(html).toContain('evidence-banner');
      expect(html).toContain('SHIP');
      expect(html).not.toContain('<table');
      expect(html).not.toContain('Assumptions');
    });
  });

  describe('getStyles', () => {
    it('should return default styles', () => {
      const styles = getStyles('default');
      expect(styles).toContain('--evidence-');
      expect(styles).toContain('.evidence-report');
    });

    it('should return minimal styles', () => {
      const styles = getStyles('minimal');
      expect(styles).not.toContain('--evidence-');
      expect(styles).toContain('.evidence-report');
    });
  });

  describe('snapshot tests', () => {
    it('should match SHIP report snapshot', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, { includeStyles: false });
      expect(html).toMatchSnapshot('ship-report');
    });

    it('should match NO_SHIP report snapshot', () => {
      const report = loadFixture('no-ship-report.json');
      const html = render(report, { includeStyles: false });
      expect(html).toMatchSnapshot('no-ship-report');
    });

    it('should match full document snapshot', () => {
      const report = loadFixture('ship-report.json');
      const html = render(report, {
        fullDocument: true,
        includeStyles: false,
        title: 'Test Report',
      });
      expect(html).toMatchSnapshot('full-document');
    });
  });
});
