import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { ProofBundle, FileHash } from './types.js';
import { verifySignature } from './signature.js';

export interface BundleVerificationResult {
  valid: boolean;
  signatureValid: boolean;
  filesIntact: boolean;
  modifiedFiles: string[];
  missingFiles: string[];
  errors: string[];
}

export class BundleVerifier {
  private bundlePath: string;
  private bundle: ProofBundle;
  private projectPath: string;

  constructor(bundlePath: string) {
    this.bundlePath = path.resolve(bundlePath);
    
    if (!fs.existsSync(this.bundlePath)) {
      throw new Error(`Bundle file not found: ${this.bundlePath}`);
    }

    try {
      const content = fs.readFileSync(this.bundlePath, 'utf-8');
      this.bundle = JSON.parse(content) as ProofBundle;
    } catch (error) {
      throw new Error(`Invalid bundle file: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.projectPath = this.bundle.project.path;
  }

  async verify(options?: { secret?: string }): Promise<BundleVerificationResult> {
    const errors: string[] = [];
    const modifiedFiles: string[] = [];
    const missingFiles: string[] = [];

    // Verify bundle structure
    if (!this.validateBundleStructure()) {
      errors.push('Invalid bundle structure');
      return {
        valid: false,
        signatureValid: false,
        filesIntact: false,
        modifiedFiles,
        missingFiles,
        errors,
      };
    }

    // Verify signature
    const signatureValid = await verifySignature(this.bundle, {
      projectPath: this.projectPath,
      secret: options?.secret,
    });

    if (!signatureValid) {
      errors.push('Signature verification failed - bundle may have been tampered with');
    }

    // Verify file hashes
    const fileVerification = await this.verifyFileHashes();
    modifiedFiles.push(...fileVerification.modifiedFiles);
    missingFiles.push(...fileVerification.missingFiles);

    const filesIntact = modifiedFiles.length === 0 && missingFiles.length === 0;

    if (!filesIntact) {
      if (modifiedFiles.length > 0) {
        errors.push(`${modifiedFiles.length} file(s) modified since verification`);
      }
      if (missingFiles.length > 0) {
        errors.push(`${missingFiles.length} file(s) missing since verification`);
      }
    }

    const valid = signatureValid && filesIntact;

    return {
      valid,
      signatureValid,
      filesIntact,
      modifiedFiles,
      missingFiles,
      errors,
    };
  }

  private validateBundleStructure(): boolean {
    if (this.bundle.version !== '1.0') {
      return false;
    }

    if (!this.bundle.id || !this.bundle.timestamp || !this.bundle.project) {
      return false;
    }

    if (!Array.isArray(this.bundle.properties) || !Array.isArray(this.bundle.fileHashes)) {
      return false;
    }

    if (!this.bundle.summary || !this.bundle.metadata || !this.bundle.signature) {
      return false;
    }

    return true;
  }

  private async verifyFileHashes(): Promise<{
    modifiedFiles: string[];
    missingFiles: string[];
  }> {
    const modifiedFiles: string[] = [];
    const missingFiles: string[] = [];

    for (const fileHash of this.bundle.fileHashes) {
      const fullPath = path.join(this.projectPath, fileHash.path);

      if (!fs.existsSync(fullPath)) {
        missingFiles.push(fileHash.path);
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const currentHash = createHash('sha256').update(content).digest('hex');

        if (currentHash !== fileHash.hash && fileHash.hash !== 'error') {
          modifiedFiles.push(fileHash.path);
        }
      } catch {
        // File might be binary or unreadable - skip
        missingFiles.push(fileHash.path);
      }
    }

    return { modifiedFiles, missingFiles };
  }

  getBundle(): ProofBundle {
    return this.bundle;
  }

  static formatVerificationResult(result: BundleVerificationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✅ Bundle verification PASSED');
      lines.push('');
      lines.push('- Signature: Valid');
      lines.push('- File integrity: Intact');
      lines.push('');
      lines.push('All files match their original hashes. No tampering detected.');
    } else {
      lines.push('❌ Bundle verification FAILED');
      lines.push('');
      lines.push(`- Signature: ${result.signatureValid ? 'Valid' : 'INVALID'}`);
      lines.push(`- File integrity: ${result.filesIntact ? 'Intact' : 'COMPROMISED'}`);
      lines.push('');

      if (result.errors.length > 0) {
        lines.push('Errors:');
        for (const error of result.errors) {
          lines.push(`  - ${error}`);
        }
        lines.push('');
      }

      if (result.modifiedFiles.length > 0) {
        lines.push(`Modified files (${result.modifiedFiles.length}):`);
        for (const file of result.modifiedFiles.slice(0, 10)) {
          lines.push(`  - ${file}`);
        }
        if (result.modifiedFiles.length > 10) {
          lines.push(`  ... and ${result.modifiedFiles.length - 10} more`);
        }
        lines.push('');
      }

      if (result.missingFiles.length > 0) {
        lines.push(`Missing files (${result.missingFiles.length}):`);
        for (const file of result.missingFiles.slice(0, 10)) {
          lines.push(`  - ${file}`);
        }
        if (result.missingFiles.length > 10) {
          lines.push(`  ... and ${result.missingFiles.length - 10} more`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
