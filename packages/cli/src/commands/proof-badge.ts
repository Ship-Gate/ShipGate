/**
 * Proof Badge & Attestation Commands
 * 
 * Generate badges and attestations from proof bundles.
 * 
 * Usage:
 *   shipgate proof badge <bundle-path>        # Generate badge SVG
 *   shipgate proof attest <bundle-path>        # Generate attestation JSON
 *   shipgate proof comment <bundle-path>       # Generate GitHub PR comment
 */

import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { resolve, join, extname } from 'path';
import chalk from 'chalk';
import type { ProofBundleManifest } from '@isl-lang/proof';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput } from '../output.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofBadgeOptions {
  /** Output format: 'svg' | 'url' */
  format?: 'svg' | 'url';
  /** Output file path (for SVG) */
  output?: string;
  /** Badge service URL base (for URL format) */
  badgeUrlBase?: string;
  /** Bundle URL (for linking from badge) */
  bundleUrl?: string;
  /** Output format */
  outputFormat?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
}

export interface ProofAttestOptions {
  /** Output file path */
  output?: string;
  /** Include full manifest in attestation */
  includeManifest?: boolean;
  /** Output format */
  outputFormat?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
}

export interface ProofCommentOptions {
  /** Output file path (optional, defaults to stdout) */
  output?: string;
  /** Output format */
  outputFormat?: 'pretty' | 'json' | 'quiet';
  /** Verbose output */
  verbose?: boolean;
}

export interface ProofBadgeResult {
  success: boolean;
  badge?: string;
  badgeUrl?: string;
  svgPath?: string;
  error?: string;
}

export interface ProofAttestResult {
  success: boolean;
  attestation?: Record<string, unknown>;
  attestationPath?: string;
  error?: string;
}

export interface ProofCommentResult {
  success: boolean;
  comment?: string;
  commentPath?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load proof bundle manifest
 */
async function loadManifest(bundlePath: string): Promise<ProofBundleManifest> {
  const resolvedPath = resolve(bundlePath);
  
  // Check if it's a ZIP file
  const isZip = extname(resolvedPath).toLowerCase() === '.zip';
  
  if (isZip) {
    throw new Error('ZIP bundles not yet supported for badge/attestation generation');
  }
  
  const manifestPath = join(resolvedPath, 'manifest.json');
  
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content) as ProofBundleManifest;
}

/**
 * Get badge color based on verdict
 */
function getBadgeColor(verdict: string): string {
  switch (verdict) {
    case 'PROVEN':
      return '4c1'; // green
    case 'INCOMPLETE_PROOF':
      return 'dfb317'; // yellow
    case 'VIOLATED':
      return 'e05d44'; // red
    case 'UNPROVEN':
      return '9f9f9f'; // grey
    default:
      return '9f9f9f';
  }
}

/**
 * Get badge label based on verdict
 */
function getBadgeLabel(verdict: string): string {
  switch (verdict) {
    case 'PROVEN':
      return 'PROVEN';
    case 'INCOMPLETE_PROOF':
      return 'INCOMPLETE';
    case 'VIOLATED':
      return 'VIOLATED';
    case 'UNPROVEN':
      return 'UNPROVEN';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Generate badge SVG
 */
function generateBadgeSVG(manifest: ProofBundleManifest, bundleUrl?: string): string {
  const verdict = manifest.verdict;
  const color = getBadgeColor(verdict);
  const label = getBadgeLabel(verdict);
  const bundleId = manifest.bundleId.slice(0, 8);
  
  // SVG badge (shields.io style)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="20" role="img" aria-label="Proof: ${label}">
  <title>Proof: ${label}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="120" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="60" height="20" fill="#555"/>
    <rect x="60" width="60" height="20" fill="#${color}"/>
    <rect width="120" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="305" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="500">proof</text>
    <text x="305" y="140" transform="scale(.1)" textLength="500">proof</text>
    <text aria-hidden="true" x="905" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="400">${label}</text>
    <text x="905" y="140" transform="scale(.1)" textLength="400">${label}</text>
  </g>
  ${bundleUrl ? `<a href="${bundleUrl}" target="_blank"><rect width="120" height="20" fill="transparent"/></a>` : ''}
</svg>`;
  
  return svg;
}

/**
 * Generate badge URL (shields.io style)
 */
function generateBadgeURL(manifest: ProofBundleManifest, badgeUrlBase?: string, bundleUrl?: string): string {
  const verdict = manifest.verdict;
  const color = getBadgeColor(verdict);
  const label = getBadgeLabel(verdict);
  
  const base = badgeUrlBase || 'https://img.shields.io/badge';
  const encodedLabel = encodeURIComponent(label);
  const encodedColor = encodeURIComponent(color);
  
  let url = `${base}/proof-${encodedLabel}-${encodedColor}`;
  
  if (bundleUrl) {
    url += `?link=${encodeURIComponent(bundleUrl)}`;
  }
  
  return url;
}

/**
 * Generate badge from proof bundle
 */
export async function generateBadge(
  bundlePath: string,
  options: ProofBadgeOptions = {}
): Promise<ProofBadgeResult> {
  try {
    const manifest = await loadManifest(bundlePath);
    const format = options.format || 'svg';
    
    if (format === 'url') {
      const badgeUrl = generateBadgeURL(manifest, options.badgeUrlBase, options.bundleUrl);
      return {
        success: true,
        badgeUrl,
      };
    } else {
      // SVG format
      const svg = generateBadgeSVG(manifest, options.bundleUrl);
      
      if (options.output) {
        await writeFile(options.output, svg, 'utf-8');
        return {
          success: true,
          badge: svg,
          svgPath: options.output,
        };
      } else {
        return {
          success: true,
          badge: svg,
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attestation Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate SLSA-style attestation JSON
 */
function generateAttestationJSON(manifest: ProofBundleManifest, includeManifest = false): Record<string, unknown> {
  const attestation: Record<string, unknown> = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      {
        name: `proof-bundle-${manifest.bundleId}`,
        digest: {
          sha256: manifest.bundleId,
        },
      },
    ],
    predicateType: 'https://isl-lang.dev/proof-bundle/v1',
    predicate: {
      verdict: manifest.verdict,
      verdictReason: manifest.verdictReason,
      spec: {
        domain: manifest.spec.domain,
        version: manifest.spec.version,
        specHash: manifest.spec.specHash,
      },
      gate: {
        verdict: manifest.gateResult.verdict,
        score: manifest.gateResult.score,
        fingerprint: manifest.gateResult.fingerprint,
      },
      build: {
        status: manifest.buildResult.status,
        tool: manifest.buildResult.tool,
        toolVersion: manifest.buildResult.toolVersion,
      },
      tests: {
        status: manifest.testResult.status,
        totalTests: manifest.testResult.totalTests,
        passedTests: manifest.testResult.passedTests,
        framework: manifest.testResult.framework,
        frameworkVersion: manifest.testResult.frameworkVersion,
      },
      toolchain: {
        islStudioVersion: manifest.policyVersion.islStudioVersion,
        bundleVersion: manifest.policyVersion.bundleVersion,
        packs: manifest.policyVersion.packs.map(p => ({
          id: p.id,
          version: p.version,
          rulesCount: p.rulesCount,
        })),
      },
      generatedAt: manifest.generatedAt,
      bundleId: manifest.bundleId,
    },
  };
  
  // Add tool versions if available
  if (manifest.toolVersions) {
    attestation.predicate.toolchain = {
      ...attestation.predicate.toolchain,
      ...manifest.toolVersions,
    };
  }
  
  // Add verification results if available
  if (manifest.verifyResults) {
    attestation.predicate.verification = {
      verdict: manifest.verifyResults.verdict,
      summary: manifest.verifyResults.summary,
    };
  }
  
  // Include full manifest if requested
  if (includeManifest) {
    attestation.predicate.manifest = manifest;
  }
  
  return attestation;
}

/**
 * Generate attestation from proof bundle
 */
export async function generateAttestation(
  bundlePath: string,
  options: ProofAttestOptions = {}
): Promise<ProofAttestResult> {
  try {
    const manifest = await loadManifest(bundlePath);
    const attestation = generateAttestationJSON(manifest, options.includeManifest);
    
    const attestationJson = JSON.stringify(attestation, null, 2);
    
    if (options.output) {
      await writeFile(options.output, attestationJson, 'utf-8');
      return {
        success: true,
        attestation,
        attestationPath: options.output,
      };
    } else {
      return {
        success: true,
        attestation,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub PR Comment Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format proof bundle as GitHub PR comment markdown
 */
function formatPRCommentBody(manifest: ProofBundleManifest): string {
  const verdict = manifest.verdict;
  const verdictEmoji = verdict === 'PROVEN' ? '✅' : verdict === 'VIOLATED' ? '❌' : '⚠️';
  
  const comment = `## ${verdictEmoji} Proof Bundle Verification

**Bundle ID:** \`${manifest.bundleId}\`  
**Generated:** ${new Date(manifest.generatedAt).toLocaleString()}

### Verdict: **${verdict}**

${manifest.verdictReason}

---

### Summary

| Phase | Status | Details |
|-------|--------|---------|
| **Gate** | ${manifest.gateResult.verdict === 'SHIP' ? '✅ SHIP' : '❌ NO_SHIP'} | Score: ${manifest.gateResult.score}/100, Blockers: ${manifest.gateResult.blockers} |
| **Build** | ${manifest.buildResult.status === 'pass' ? '✅ PASS' : manifest.buildResult.status === 'fail' ? '❌ FAIL' : '⏭️ SKIP'} | ${manifest.buildResult.tool} ${manifest.buildResult.toolVersion} |
| **Tests** | ${manifest.testResult.status === 'pass' ? '✅ PASS' : manifest.testResult.status === 'fail' ? '❌ FAIL' : '⏭️ SKIP'} | ${manifest.testResult.passedTests}/${manifest.testResult.totalTests} passed |
${manifest.verifyResults ? `| **Verify** | ${manifest.verifyResults.verdict === 'PROVEN' ? '✅ PROVEN' : '⚠️ INCOMPLETE'} | ${manifest.verifyResults.summary.provenClauses}/${manifest.verifyResults.summary.totalClauses} clauses proven |` : ''}

### Spec

- **Domain:** \`${manifest.spec.domain}\`
- **Version:** \`${manifest.spec.version}\`
- **Spec Hash:** \`${manifest.spec.specHash.slice(0, 16)}...\`

### Toolchain

- **ISL Studio:** ${manifest.policyVersion.islStudioVersion}
- **Policy Bundle:** ${manifest.policyVersion.bundleVersion}
- **Packs:** ${manifest.policyVersion.packs.map(p => `${p.id}@${p.version}`).join(', ')}

---

*Generated by ShipGate Proof Bundle System*`;

  return comment;
}

/**
 * Generate GitHub PR comment from proof bundle
 */
export async function generatePRComment(
  bundlePath: string,
  options: ProofCommentOptions = {}
): Promise<ProofCommentResult> {
  try {
    const manifest = await loadManifest(bundlePath);
    const comment = formatPRCommentBody(manifest);
    
    if (options.output) {
      await writeFile(options.output, comment, 'utf-8');
      return {
        success: true,
        comment,
        commentPath: options.output,
      };
    } else {
      return {
        success: true,
        comment,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print badge result
 */
export function printBadgeResult(result: ProofBadgeResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const isJson = options.format === 'json' || isJsonOutput();
  
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    return;
  }
  
  if (result.badgeUrl) {
    console.log(chalk.green('Badge URL:'));
    console.log(result.badgeUrl);
    console.log('');
    console.log(chalk.gray('Markdown:'));
    console.log(`![Proof](${result.badgeUrl})`);
  } else if (result.badge) {
    if (result.svgPath) {
      console.log(chalk.green(`Badge SVG written to: ${result.svgPath}`));
    } else {
      console.log(result.badge);
    }
  }
}

/**
 * Print attestation result
 */
export function printAttestationResult(result: ProofAttestResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const isJson = options.format === 'json' || isJsonOutput();
  
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    return;
  }
  
  if (result.attestationPath) {
    console.log(chalk.green(`Attestation written to: ${result.attestationPath}`));
  } else if (result.attestation) {
    console.log(JSON.stringify(result.attestation, null, 2));
  }
}

/**
 * Print PR comment result
 */
export function printCommentResult(result: ProofCommentResult, options: { format?: 'pretty' | 'json' | 'quiet' } = {}): void {
  const isJson = options.format === 'json' || isJsonOutput();
  
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    return;
  }
  
  if (result.commentPath) {
    console.log(chalk.green(`PR comment written to: ${result.commentPath}`));
  } else if (result.comment) {
    console.log(result.comment);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit Codes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get exit code for badge result
 */
export function getBadgeExitCode(result: ProofBadgeResult): number {
  return result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR;
}

/**
 * Get exit code for attestation result
 */
export function getAttestationExitCode(result: ProofAttestResult): number {
  return result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR;
}

/**
 * Get exit code for comment result
 */
export function getCommentExitCode(result: ProofCommentResult): number {
  return result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR;
}
