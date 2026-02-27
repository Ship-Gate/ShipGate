/**
 * PDF Report Generator
 *
 * Converts Markdown to PDF using the lightweight md-to-pdf library.
 * Falls back to HTML if md-to-pdf is not installed.
 */

import { writeFile } from 'fs/promises';
import { generateMarkdownReport } from './markdownReport.js';
import { generateHtmlReport, DEFAULT_REPORT_CSS } from './htmlReport.js';
import type { ReportData, ReportScope, ReportResult } from './reportTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// PDF-specific Styles (used by md-to-pdf for Markdown rendering)
// ─────────────────────────────────────────────────────────────────────────────

const PDF_CSS = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    max-width: 780px;
    margin: 0 auto;
    padding: 2rem;
    font-size: 11pt;
  }

  h1 {
    font-size: 1.5rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
    margin-bottom: 0.5rem;
  }

  h2 {
    font-size: 1.15rem;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: #1e293b;
  }

  h3 {
    font-size: 0.95rem;
    margin-top: 1rem;
    margin-bottom: 0.25rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  th, td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
  }

  code {
    background: #f8fafc;
    padding: 0.1rem 0.25rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  hr {
    margin-top: 2rem;
    border: none;
    border-top: 1px solid #e2e8f0;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a PDF verification report.
 *
 * Strategy:
 * 1. Try md-to-pdf (lightweight Markdown-to-PDF via Chromium/Puppeteer).
 * 2. If md-to-pdf is unavailable, fall back to writing an HTML file with
 *    print-friendly styles that can be saved as PDF from a browser.
 */
export async function generatePdfReport(
  data: ReportData,
  outputPath: string,
  scope: ReportScope = 'full',
  options?: {
    includeRecommendations?: boolean;
    includeTrends?: boolean;
    title?: string;
    customCss?: string;
  },
): Promise<ReportResult> {
  const markdown = generateMarkdownReport(data, scope, options);

  // Attempt md-to-pdf
  try {
    const { mdToPdf } = await import('md-to-pdf');
    const pdf = await mdToPdf(
      { content: markdown },
      {
        dest: outputPath,
        css: options?.customCss ?? PDF_CSS,
        pdf_options: {
          format: 'A4',
          margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
          printBackground: true,
        },
        launch_options: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    );

    const sizeBytes = pdf.content?.length ?? 0;

    return {
      success: true,
      format: 'pdf',
      outputPath,
      sizeBytes,
    };
  } catch {
    // md-to-pdf not available — fall back to HTML with print styles
    return await generateHtmlFallback(data, outputPath, scope, options);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Fallback (print-friendly)
// ─────────────────────────────────────────────────────────────────────────────

async function generateHtmlFallback(
  data: ReportData,
  outputPath: string,
  scope: ReportScope,
  options?: {
    includeRecommendations?: boolean;
    includeTrends?: boolean;
    title?: string;
    customCss?: string;
  },
): Promise<ReportResult> {
  const printCss = `
    ${DEFAULT_REPORT_CSS}

    @media print {
      body { padding: 0; max-width: none; }
      .file-detail { break-inside: avoid; }
    }
  `;

  const html = generateHtmlReport(data, scope, {
    ...options,
    customCss: printCss,
  });

  // Write as .html (user can open in browser and print to PDF)
  const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
  const buffer = Buffer.from(html, 'utf-8');
  await writeFile(htmlPath, buffer);

  return {
    success: true,
    format: 'pdf',
    outputPath: htmlPath,
    content: html,
    sizeBytes: buffer.length,
    error: htmlPath !== outputPath
      ? 'md-to-pdf not installed; generated print-friendly HTML instead. Install md-to-pdf for native PDF output.'
      : undefined,
  };
}
