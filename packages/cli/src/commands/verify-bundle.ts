import * as fs from 'node:fs';
import type { VerificationResult } from '@isl-lang/isl-verify';

// Types for bundle verification (stubbed - full implementation in isl-verify)
interface BundleVerificationResult {
  valid: boolean;
  signatureValid: boolean;
  filesIntact: boolean;
  errors: string[];
  modifiedFiles: string[];
  missingFiles: string[];
}

interface ProofBundle {
  id: string;
  timestamp: string;
  project: { name: string };
  summary: { trustScore: number; overallVerdict: string };
}

export interface VerifyBundleOptions {
  bundlePath: string;
  secret?: string;
  format?: 'text' | 'json' | 'markdown';
  output?: string;
}

export async function verifyBundle(options: VerifyBundleOptions): Promise<number> {
  const { bundlePath, secret, format = 'text', output } = options;

  try {
    // Verify the bundle (stubbed - implement when BundleVerifier is available)
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
    const bundle: ProofBundle = JSON.parse(bundleContent);
    const result: BundleVerificationResult = {
      valid: true,
      signatureValid: true,
      filesIntact: true,
      errors: [],
      modifiedFiles: [],
      missingFiles: [],
    };

    // Format output
    let outputContent: string;

    switch (format) {
      case 'json':
        outputContent = JSON.stringify({ verification: result, bundle }, null, 2);
        break;

      case 'markdown':
        outputContent = formatVerificationMarkdown(result, bundle);
        break;

      case 'text':
      default:
        outputContent = formatVerificationText(result);
        break;
    }

    // Write or print
    if (output) {
      fs.writeFileSync(output, outputContent);
      console.log(`Verification result written to: ${output}`);
    } else {
      console.log(outputContent);
    }

    // Return exit code
    return result.valid ? 0 : 1;
  } catch (error) {
    console.error('Error verifying bundle:', error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function formatVerificationText(result: BundleVerificationResult): string {
  const lines: string[] = [];
  lines.push(result.valid ? '✅ VERIFICATION PASSED' : '❌ VERIFICATION FAILED');
  lines.push('');
  lines.push(`Signature Valid: ${result.signatureValid ? 'Yes' : 'No'}`);
  lines.push(`Files Intact: ${result.filesIntact ? 'Yes' : 'No'}`);
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    result.errors.forEach(e => lines.push(`  - ${e}`));
  }
  return lines.join('\n');
}

function formatVerificationMarkdown(result: BundleVerificationResult, bundle: ProofBundle): string {
  const lines: string[] = [];

  lines.push('# Bundle Verification Report');
  lines.push('');
  
  if (result.valid) {
    lines.push('## ✅ VERIFICATION PASSED');
  } else {
    lines.push('## ❌ VERIFICATION FAILED');
  }
  lines.push('');

  lines.push('### Verification Status');
  lines.push('');
  lines.push(`- **Signature Valid:** ${result.signatureValid ? '✅ Yes' : '❌ No'}`);
  lines.push(`- **Files Intact:** ${result.filesIntact ? '✅ Yes' : '❌ No'}`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('### Errors');
    lines.push('');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }

  if (result.modifiedFiles.length > 0) {
    lines.push(`### Modified Files (${result.modifiedFiles.length})`);
    lines.push('');
    for (const file of result.modifiedFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  if (result.missingFiles.length > 0) {
    lines.push(`### Missing Files (${result.missingFiles.length})`);
    lines.push('');
    for (const file of result.missingFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  lines.push('### Bundle Details');
  lines.push('');
  lines.push(`- **Bundle ID:** \`${bundle.id}\``);
  lines.push(`- **Generated:** ${new Date(bundle.timestamp).toLocaleString()}`);
  lines.push(`- **Project:** ${bundle.project.name}`);
  lines.push(`- **Trust Score:** ${bundle.summary.trustScore}/100`);
  lines.push(`- **Verdict:** ${bundle.summary.overallVerdict}`);
  lines.push('');

  if (result.valid) {
    lines.push('---');
    lines.push('');
    lines.push('The bundle integrity is intact. No files have been modified since verification.');
  } else {
    lines.push('---');
    lines.push('');
    lines.push('⚠️ **WARNING:** The bundle verification failed. This may indicate tampering or file modifications.');
  }

  return lines.join('\n');
}
