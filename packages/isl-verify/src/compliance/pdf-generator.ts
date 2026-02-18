/**
 * PDF Report Generator
 * 
 * Converts HTML compliance reports to PDF using puppeteer
 */

import { writeFileSync } from 'fs';
import { formatHtmlReport } from './report-formatter.js';
import type { ComplianceReport } from './compliance-report-generator.js';

export interface PdfGeneratorOptions {
  outputPath: string;
  format?: 'A4' | 'Letter';
  landscape?: boolean;
}

/**
 * Generate PDF report from compliance report
 * 
 * Note: This is a placeholder. In production, you would use puppeteer or similar:
 * 
 * ```typescript
 * import puppeteer from 'puppeteer';
 * 
 * const browser = await puppeteer.launch();
 * const page = await browser.newPage();
 * await page.setContent(html);
 * await page.pdf({ path: outputPath, format: 'A4' });
 * await browser.close();
 * ```
 */
export async function generatePdfReport(
  report: ComplianceReport,
  options: PdfGeneratorOptions
): Promise<void> {
  const html = formatHtmlReport(report);

  // For now, save as HTML with instructions
  // In production, integrate puppeteer for real PDF generation
  const htmlWithPdfInstructions = `
<!-- 
  PDF GENERATION PLACEHOLDER
  
  To generate a PDF from this HTML:
  1. Open this file in a browser
  2. Use Print > Save as PDF
  3. Or integrate puppeteer in production:
  
  npm install puppeteer
  
  import puppeteer from 'puppeteer';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent);
  await page.pdf({ 
    path: '${options.outputPath}', 
    format: '${options.format || 'A4'}',
    landscape: ${options.landscape || false}
  });
  await browser.close();
-->
${html}
`;

  writeFileSync(options.outputPath, htmlWithPdfInstructions, 'utf-8');
}

/**
 * Generate PDF using markdown-pdf (lightweight alternative)
 * 
 * This is a simpler approach that doesn't require puppeteer:
 * 
 * ```typescript
 * import markdownPdf from 'markdown-pdf';
 * 
 * markdownPdf()
 *   .from.string(markdownContent)
 *   .to(outputPath, callback);
 * ```
 */
export function generatePdfFromMarkdown(
  markdownContent: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Placeholder implementation
    // In production, use markdown-pdf or similar library
    writeFileSync(
      outputPath.replace('.pdf', '.md'),
      markdownContent,
      'utf-8'
    );
    
    console.warn('PDF generation placeholder: saved as .md file instead');
    console.warn('Install markdown-pdf or puppeteer for real PDF generation');
    
    resolve();
  });
}

/**
 * Enhanced PDF generation with custom styling
 */
export interface EnhancedPdfOptions extends PdfGeneratorOptions {
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
}

export async function generateEnhancedPdf(
  report: ComplianceReport,
  options: EnhancedPdfOptions
): Promise<void> {
  let html = formatHtmlReport(report);

  // Add header
  if (options.headerText || options.logoUrl) {
    const header = `
      <div style="text-align: center; padding: 20px; border-bottom: 2px solid #3498db;">
        ${options.logoUrl ? `<img src="${options.logoUrl}" alt="Logo" style="max-height: 50px; margin-bottom: 10px;">` : ''}
        ${options.headerText ? `<p style="margin: 0; color: #7f8c8d;">${options.headerText}</p>` : ''}
      </div>
    `;
    html = html.replace('<div class="container">', `<div class="container">${header}`);
  }

  // Add footer
  if (options.footerText) {
    const footer = `
      <div style="text-align: center; padding: 20px; margin-top: 40px; border-top: 2px solid #ecf0f1; color: #7f8c8d;">
        <p>${options.footerText}</p>
        ${options.includePageNumbers ? '<p>Page <span class="pageNumber"></span> of <span class="totalPages"></span></p>' : ''}
      </div>
    `;
    html = html.replace('</div>\n  <div class="footer">', `${footer}</div>\n  <div class="footer">`);
  }

  // Add table of contents
  if (options.includeTableOfContents) {
    const toc = generateTableOfContents(report);
    html = html.replace('<h2>Executive Summary</h2>', `${toc}<h2>Executive Summary</h2>`);
  }

  writeFileSync(options.outputPath, html, 'utf-8');
}

/**
 * Generate table of contents from report
 */
function generateTableOfContents(report: ComplianceReport): string {
  const items: string[] = [];

  items.push('<h2>Table of Contents</h2>');
  items.push('<ul style="list-style: none; padding-left: 0;">');
  items.push('  <li><a href="#executive-summary">Executive Summary</a></li>');
  items.push('  <li><a href="#control-evidence">Control Evidence</a>');
  items.push('    <ul>');

  const categories = new Set(report.controls.map(c => c.category));
  categories.forEach(category => {
    items.push(`      <li><a href="#${category.toLowerCase().replace(/\s+/g, '-')}">${category}</a></li>`);
  });

  items.push('    </ul>');
  items.push('  </li>');
  items.push('</ul>');
  items.push('<hr>');
  items.push('');

  return items.join('\n');
}
