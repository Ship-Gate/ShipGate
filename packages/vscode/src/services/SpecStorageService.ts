/**
 * SpecStorageService
 * 
 * Manages persistence of ISL specifications to the .shipgate/specs/ directory.
 * Handles saving, loading, and querying specs with fingerprint-based identification.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface SpecMetadata {
  fingerprint: string;
  name: string;
  source: 'prompt' | 'file' | 'clipboard';
  createdAt: string;
  updatedAt: string;
  prompt?: string;
  version: string;
}

export interface StoredSpec {
  metadata: SpecMetadata;
  content: string;
  filePath: string;
}

export interface SpecStorageOptions {
  workspaceRoot: string;
}

// ============================================================================
// SpecStorageService
// ============================================================================

export class SpecStorageService {
  private readonly specsDir: string;
  private readonly metadataFile: string;
  private metadataCache: Map<string, SpecMetadata> = new Map();

  constructor(options: SpecStorageOptions) {
    this.specsDir = path.join(options.workspaceRoot, '.shipgate', 'specs');
    this.metadataFile = path.join(this.specsDir, '_metadata.json');
    this.ensureDirectoryExists();
    this.loadMetadataCache();
  }

  /**
   * Create service from VSCode workspace
   */
  static fromWorkspace(): SpecStorageService | null {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return null;
    }
    return new SpecStorageService({ workspaceRoot });
  }

  /**
   * Save a spec to the storage
   */
  async saveSpec(
    content: string,
    options: {
      name?: string;
      source: 'prompt' | 'file' | 'clipboard';
      prompt?: string;
    }
  ): Promise<StoredSpec> {
    const fingerprint = this.generateFingerprint(content);
    const name = options.name || this.extractSpecName(content) || `spec-${fingerprint.substring(0, 8)}`;
    const fileName = `${this.sanitizeFileName(name)}.isl`;
    const filePath = path.join(this.specsDir, fileName);

    const now = new Date().toISOString();
    const existingMetadata = this.metadataCache.get(fingerprint);

    const metadata: SpecMetadata = {
      fingerprint,
      name,
      source: options.source,
      createdAt: existingMetadata?.createdAt || now,
      updatedAt: now,
      prompt: options.prompt,
      version: '1.0.0',
    };

    // Write the spec file
    await fs.promises.writeFile(filePath, content, 'utf-8');

    // Update metadata
    this.metadataCache.set(fingerprint, metadata);
    await this.persistMetadataCache();

    return {
      metadata,
      content,
      filePath,
    };
  }

  /**
   * Load a spec by fingerprint
   */
  async loadSpec(fingerprint: string): Promise<StoredSpec | null> {
    const metadata = this.metadataCache.get(fingerprint);
    if (!metadata) {
      return null;
    }

    const fileName = `${this.sanitizeFileName(metadata.name)}.isl`;
    const filePath = path.join(this.specsDir, fileName);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return {
        metadata,
        content,
        filePath,
      };
    } catch {
      // File may have been deleted, remove from cache
      this.metadataCache.delete(fingerprint);
      await this.persistMetadataCache();
      return null;
    }
  }

  /**
   * Load a spec by name
   */
  async loadSpecByName(name: string): Promise<StoredSpec | null> {
    const fileName = `${this.sanitizeFileName(name)}.isl`;
    const filePath = path.join(this.specsDir, fileName);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fingerprint = this.generateFingerprint(content);
      const metadata = this.metadataCache.get(fingerprint);

      return {
        metadata: metadata || {
          fingerprint,
          name,
          source: 'file',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
        },
        content,
        filePath,
      };
    } catch {
      return null;
    }
  }

  /**
   * List all stored specs
   */
  async listSpecs(): Promise<SpecMetadata[]> {
    return Array.from(this.metadataCache.values());
  }

  /**
   * Delete a spec by fingerprint
   */
  async deleteSpec(fingerprint: string): Promise<boolean> {
    const metadata = this.metadataCache.get(fingerprint);
    if (!metadata) {
      return false;
    }

    const fileName = `${this.sanitizeFileName(metadata.name)}.isl`;
    const filePath = path.join(this.specsDir, fileName);

    try {
      await fs.promises.unlink(filePath);
      this.metadataCache.delete(fingerprint);
      await this.persistMetadataCache();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a spec exists
   */
  hasSpec(fingerprint: string): boolean {
    return this.metadataCache.has(fingerprint);
  }

  /**
   * Get the specs directory path
   */
  getSpecsDirectory(): string {
    return this.specsDir;
  }

  /**
   * Generate a fingerprint for spec content
   */
  generateFingerprint(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content.trim())
      .digest('hex')
      .substring(0, 16);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.specsDir)) {
      fs.mkdirSync(this.specsDir, { recursive: true });
    }
  }

  private loadMetadataCache(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, SpecMetadata>;
        this.metadataCache = new Map(Object.entries(parsed));
      }
    } catch {
      // Start with empty cache if file is corrupted
      this.metadataCache = new Map();
    }
  }

  private async persistMetadataCache(): Promise<void> {
    const data: Record<string, SpecMetadata> = {};
    for (const [key, value] of this.metadataCache) {
      data[key] = value;
    }
    await fs.promises.writeFile(
      this.metadataFile,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  private extractSpecName(content: string): string | null {
    // Try to extract domain name from the spec
    const domainMatch = content.match(/domain\s+(\w+)/);
    if (domainMatch && domainMatch[1]) {
      return domainMatch[1].toLowerCase();
    }
    return null;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
