/**
 * CLI Commands for Compliance Report Generation
 * 
 * Provides commands for generating SOC 2, HIPAA, PCI-DSS, and EU AI Act reports
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { ComplianceReportGenerator } from './compliance-report-generator.js';
import { formatMarkdownReport, formatHtmlReport, formatJsonReport } from './report-formatter.js';
import { generatePdfReport, generateEnhancedPdf } from './pdf-generator.js';
import type { ProofBundle } from '../proof/types.js';
import type { ProofBundleV1 } from '@isl-lang/proof';
import type { ComplianceFramework, ComplianceReport } from './compliance-report-generator.js';

export interface ComplianceCommandOptions {
  /** Path to proof bundle JSON file */
  bundle: string;
  /** Output directory for reports */
  output?: string;
  /** Output format */
  format?: 'markdown' | 'html' | 'pdf' | 'json' | 'all';
  /** Project name */
  project?: string;
  /** Include enhanced PDF features */
  enhanced?: boolean;
  /** Organization name for PDF header */
  organization?: string;
  /** Logo URL for PDF */
  logo?: string;
}

export interface ComplianceCommandResult {
  success: boolean;
  framework: ComplianceFramework;
  report?: ComplianceReport;
  outputFiles?: string[];
  errors?: string[];
}

/**
 * Generate SOC 2 compliance report
 */
export async function generateSoc2Report(
  options: ComplianceCommandOptions
): Promise<ComplianceCommandResult> {
  return generateComplianceReport('soc2', options);
}

/**
 * Generate HIPAA compliance report
 */
export async function generateHipaaReport(
  options: ComplianceCommandOptions
): Promise<ComplianceCommandResult> {
  return generateComplianceReport('hipaa', options);
}

/**
 * Generate PCI-DSS compliance report
 */
export async function generatePciDssReport(
  options: ComplianceCommandOptions
): Promise<ComplianceCommandResult> {
  return generateComplianceReport('pci-dss', options);
}

/**
 * Generate EU AI Act compliance report
 */
export async function generateEuAiActReport(
  options: ComplianceCommandOptions
): Promise<ComplianceCommandResult> {
  return generateComplianceReport('eu-ai-act', options);
}

/**
 * Core compliance report generation logic
 */
async function generateComplianceReport(
  framework: ComplianceFramework,
  options: ComplianceCommandOptions
): Promise<ComplianceCommandResult> {
  const errors: string[] = [];
  const outputFiles: string[] = [];

  try {
    // Load proof bundle
    const bundlePath = resolve(options.bundle);
    if (!existsSync(bundlePath)) {
      return {
        success: false,
        framework,
        errors: [`Proof bundle not found: ${options.bundle}`],
      };
    }

    const bundleContent = readFileSync(bundlePath, 'utf-8');
    let proofBundle: ProofBundle;
    let legacyBundle: ProofBundleV1 | undefined;

    try {
      const parsed = JSON.parse(bundleContent);
      
      // Check if it's a legacy bundle (ProofBundleV1) or new format
      if (parsed.properties && Array.isArray(parsed.properties)) {
        proofBundle = parsed as ProofBundle;
      } else if (parsed.bundleHash || parsed.verdicts) {
        // Legacy format - need to convert
        legacyBundle = parsed as ProofBundleV1;
        proofBundle = convertLegacyBundle(legacyBundle);
      } else {
        return {
          success: false,
          framework,
          errors: ['Invalid proof bundle format: expected properties array or legacy bundle format'],
        };
      }
    } catch (parseError) {
      return {
        success: false,
        framework,
        errors: [`Failed to parse proof bundle: ${parseError instanceof Error ? parseError.message : String(parseError)}`],
      };
    }

    // Generate report
    const projectName = options.project || extractProjectName(bundlePath);
    const generator = new ComplianceReportGenerator(proofBundle, projectName);
    
    if (legacyBundle) {
      generator.setLegacyBundle(legacyBundle);
    }

    const report = generator.generateReport(framework);

    // Determine output directory
    const outputDir = options.output ? resolve(options.output) : dirname(bundlePath);
    const frameworkSlug = framework.toLowerCase().replace(/\s+/g, '-');

    // Generate requested formats
    const format = options.format || 'markdown';

    if (format === 'markdown' || format === 'all') {
      const markdownPath = join(outputDir, `${frameworkSlug}-compliance-report.md`);
      const markdown = formatMarkdownReport(report);
      writeFileSync(markdownPath, markdown, 'utf-8');
      outputFiles.push(markdownPath);
    }

    if (format === 'html' || format === 'all') {
      const htmlPath = join(outputDir, `${frameworkSlug}-compliance-report.html`);
      const html = formatHtmlReport(report);
      writeFileSync(htmlPath, html, 'utf-8');
      outputFiles.push(htmlPath);
    }

    if (format === 'json' || format === 'all') {
      const jsonPath = join(outputDir, `${frameworkSlug}-compliance-report.json`);
      const json = formatJsonReport(report);
      writeFileSync(jsonPath, json, 'utf-8');
      outputFiles.push(jsonPath);
    }

    if (format === 'pdf' || format === 'all') {
      const pdfPath = join(outputDir, `${frameworkSlug}-compliance-report.html`);
      
      if (options.enhanced) {
        await generateEnhancedPdf(report, {
          outputPath: pdfPath,
          format: 'A4',
          includeTableOfContents: true,
          includePageNumbers: true,
          headerText: options.organization || projectName,
          footerText: `${framework.toUpperCase()} Compliance Evidence | Generated by ISL Verify`,
          logoUrl: options.logo,
        });
      } else {
        await generatePdfReport(report, {
          outputPath: pdfPath,
          format: 'A4',
        });
      }
      
      outputFiles.push(pdfPath);
    }

    return {
      success: true,
      framework,
      report,
      outputFiles,
    };

  } catch (error) {
    errors.push(`Failed to generate compliance report: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      framework,
      errors,
    };
  }
}

/**
 * Convert legacy ProofBundleV1 to new ProofBundle format
 */
function convertLegacyBundle(legacy: ProofBundleV1): ProofBundle {
  // Extract properties from legacy format
  // This is a simplified conversion - in production, you'd map all legacy fields
  const properties = [];

  // Try to extract property data from verdicts/evidence
  if (legacy.verdicts) {
    for (const verdict of legacy.verdicts) {
      // Map verdict details to properties
      // This is a placeholder - real implementation would parse verdict details
    }
  }

  return {
    version: '2.0',
    projectName: 'Legacy Project',
    timestamp: new Date().toISOString(),
    properties: properties,
    metadata: {
      bundleHash: legacy.bundleHash,
      signature: legacy.signature,
    },
  };
}

/**
 * Extract project name from bundle path
 */
function extractProjectName(bundlePath: string): string {
  const parts = bundlePath.split(/[/\\]/);
  const projectIndex = parts.findIndex(p => p === '.isl-verify' || p === 'proof-bundles');
  
  if (projectIndex > 0) {
    return parts[projectIndex - 1];
  }
  
  return 'ISL-Verified-Project';
}

/**
 * Print compliance report result to console
 */
export function printComplianceResult(result: ComplianceCommandResult): void {
  if (!result.success) {
    console.error(`\n❌ ${result.framework.toUpperCase()} compliance report generation failed:\n`);
    result.errors?.forEach(err => console.error(`  • ${err}`));
    console.error('');
    return;
  }

  console.log(`\n✅ ${result.framework.toUpperCase()} compliance report generated successfully\n`);
  
  if (result.report) {
    const { executiveSummary } = result.report;
    const statusEmoji = executiveSummary.overallStatus === 'compliant' ? '✅' : 
                       executiveSummary.overallStatus === 'partial' ? '⚠️' : '❌';
    
    console.log(`${statusEmoji} Overall Status: ${executiveSummary.overallStatus.toUpperCase()}`);
    console.log(`\nControls: ${executiveSummary.compliantControls}/${executiveSummary.totalControls} compliant`);
    
    if (executiveSummary.criticalGaps > 0) {
      console.log(`\n⚠️  ${executiveSummary.criticalGaps} critical gap(s) require immediate attention`);
    }
    
    if (executiveSummary.highPriorityGaps > 0) {
      console.log(`   ${executiveSummary.highPriorityGaps} high priority gap(s) need remediation`);
    }
  }

  if (result.outputFiles && result.outputFiles.length > 0) {
    console.log(`\nGenerated files:`);
    result.outputFiles.forEach(file => console.log(`  📄 ${file}`));
  }

  console.log('');
}

/**
 * Get exit code from compliance result
 */
export function getComplianceExitCode(result: ComplianceCommandResult): number {
  if (!result.success) {
    return 1;
  }

  if (!result.report) {
    return 1;
  }

  // Exit with error if critical gaps exist
  if (result.report.executiveSummary.criticalGaps > 0) {
    return 1;
  }

  // Exit with error if non-compliant
  if (result.report.executiveSummary.overallStatus === 'non-compliant') {
    return 1;
  }

  return 0;
}
