/**
 * EvidenceStorageService
 * 
 * Manages persistence of evidence reports to the .shipgate/reports/ directory.
 * Evidence reports capture the results of spec verification, build outcomes,
 * and trust score calculations.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface VerificationResult {
  passed: boolean;
  scenarioName: string;
  duration: number;
  error?: string;
  stackTrace?: string;
}

export interface TrustScore {
  overall: number;
  breakdown: {
    preconditions: number;
    postconditions: number;
    invariants: number;
    scenarios: number;
  };
}

export interface BuildResult {
  success: boolean;
  generatedFiles: string[];
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface EvidenceReport {
  fingerprint: string;
  specFingerprint: string;
  specName: string;
  timestamp: string;
  source: 'generate-and-build' | 'manual-verify' | 'ci' | 'watch';
  prompt?: string;
  
  // Build results
  build?: BuildResult;
  
  // Verification results
  verification?: {
    results: VerificationResult[];
    passedCount: number;
    failedCount: number;
    totalCount: number;
    coverage: number;
  };
  
  // Trust score
  trustScore?: TrustScore;
  
  // Additional context
  context?: {
    workspaceRoot: string;
    islVersion: string;
    nodeVersion: string;
    platform: string;
  };
  
  // Raw MCP responses for debugging
  mcpResponses?: Record<string, unknown>;
}

export interface EvidenceStorageOptions {
  workspaceRoot: string;
}

export interface EvidenceQuery {
  specFingerprint?: string;
  source?: EvidenceReport['source'];
  fromDate?: Date;
  toDate?: Date;
  passedOnly?: boolean;
  limit?: number;
}

// ============================================================================
// EvidenceStorageService
// ============================================================================

export class EvidenceStorageService {
  private readonly reportsDir: string;
  private readonly indexFile: string;
  private indexCache: Map<string, EvidenceReportIndex> = new Map();

  constructor(options: EvidenceStorageOptions) {
    this.reportsDir = path.join(options.workspaceRoot, '.shipgate', 'reports');
    this.indexFile = path.join(this.reportsDir, '_index.json');
    this.ensureDirectoryExists();
    this.loadIndexCache();
  }

  /**
   * Create service from VSCode workspace
   */
  static fromWorkspace(): EvidenceStorageService | null {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return null;
    }
    return new EvidenceStorageService({ workspaceRoot });
  }

  /**
   * Save an evidence report
   */
  async saveReport(report: Omit<EvidenceReport, 'fingerprint' | 'timestamp'>): Promise<EvidenceReport> {
    const timestamp = new Date().toISOString();
    const fingerprint = this.generateFingerprint(report.specFingerprint, timestamp);

    const fullReport: EvidenceReport = {
      ...report,
      fingerprint,
      timestamp,
      context: {
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        islVersion: '0.1.0', // TODO: Get from package
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    const fileName = `${fingerprint}.json`;
    const filePath = path.join(this.reportsDir, fileName);

    // Write the report file
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(fullReport, null, 2),
      'utf-8'
    );

    // Update index
    const index: EvidenceReportIndex = {
      fingerprint,
      specFingerprint: report.specFingerprint,
      specName: report.specName,
      timestamp,
      source: report.source,
      passed: this.calculatePassed(fullReport),
      trustScore: fullReport.trustScore?.overall,
    };
    this.indexCache.set(fingerprint, index);
    await this.persistIndexCache();

    return fullReport;
  }

  /**
   * Load a report by fingerprint
   */
  async loadReport(fingerprint: string): Promise<EvidenceReport | null> {
    const fileName = `${fingerprint}.json`;
    const filePath = path.join(this.reportsDir, fileName);

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as EvidenceReport;
    } catch {
      return null;
    }
  }

  /**
   * Query reports with filters
   */
  async queryReports(query: EvidenceQuery = {}): Promise<EvidenceReportIndex[]> {
    let results = Array.from(this.indexCache.values());

    // Apply filters
    if (query.specFingerprint) {
      results = results.filter(r => r.specFingerprint === query.specFingerprint);
    }

    if (query.source) {
      results = results.filter(r => r.source === query.source);
    }

    if (query.fromDate) {
      results = results.filter(r => new Date(r.timestamp) >= query.fromDate!);
    }

    if (query.toDate) {
      results = results.filter(r => new Date(r.timestamp) <= query.toDate!);
    }

    if (query.passedOnly) {
      results = results.filter(r => r.passed === true);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get the latest report for a spec
   */
  async getLatestReport(specFingerprint: string): Promise<EvidenceReport | null> {
    const indices = await this.queryReports({
      specFingerprint,
      limit: 1,
    });

    if (indices.length === 0) {
      return null;
    }

    return this.loadReport(indices[0]!.fingerprint);
  }

  /**
   * Delete a report by fingerprint
   */
  async deleteReport(fingerprint: string): Promise<boolean> {
    const fileName = `${fingerprint}.json`;
    const filePath = path.join(this.reportsDir, fileName);

    try {
      await fs.promises.unlink(filePath);
      this.indexCache.delete(fingerprint);
      await this.persistIndexCache();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete old reports to manage disk space
   */
  async pruneReports(options: { maxAge?: number; maxCount?: number } = {}): Promise<number> {
    const maxAge = options.maxAge ?? 30 * 24 * 60 * 60 * 1000; // 30 days default
    const maxCount = options.maxCount ?? 1000;

    let pruned = 0;
    const now = Date.now();
    const sortedReports = Array.from(this.indexCache.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    for (let i = 0; i < sortedReports.length; i++) {
      const report = sortedReports[i]!;
      const age = now - new Date(report.timestamp).getTime();

      // Delete if older than maxAge or beyond maxCount
      if (age > maxAge || i >= maxCount) {
        const deleted = await this.deleteReport(report.fingerprint);
        if (deleted) {
          pruned++;
        }
      }
    }

    return pruned;
  }

  /**
   * Get the reports directory path
   */
  getReportsDirectory(): string {
    return this.reportsDir;
  }

  /**
   * Get aggregate statistics for a spec
   */
  async getSpecStats(specFingerprint: string): Promise<SpecStats> {
    const reports = await this.queryReports({ specFingerprint });

    if (reports.length === 0) {
      return {
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        averageTrustScore: 0,
        lastRun: null,
      };
    }

    const passedRuns = reports.filter(r => r.passed).length;
    const scoresWithValues = reports.filter(r => r.trustScore !== undefined);
    const averageTrustScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((sum, r) => sum + (r.trustScore || 0), 0) / scoresWithValues.length
      : 0;

    return {
      totalRuns: reports.length,
      passedRuns,
      failedRuns: reports.length - passedRuns,
      averageTrustScore,
      lastRun: reports[0]!.timestamp,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  private loadIndexCache(): void {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, EvidenceReportIndex>;
        this.indexCache = new Map(Object.entries(parsed));
      }
    } catch {
      // Start with empty cache if file is corrupted
      this.indexCache = new Map();
    }
  }

  private async persistIndexCache(): Promise<void> {
    const data: Record<string, EvidenceReportIndex> = {};
    for (const [key, value] of this.indexCache) {
      data[key] = value;
    }
    await fs.promises.writeFile(
      this.indexFile,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  private generateFingerprint(specFingerprint: string, timestamp: string): string {
    return crypto
      .createHash('sha256')
      .update(`${specFingerprint}:${timestamp}`)
      .digest('hex')
      .substring(0, 16);
  }

  private calculatePassed(report: EvidenceReport): boolean {
    // Consider passed if build succeeded and verification passed (if present)
    if (report.build && !report.build.success) {
      return false;
    }
    if (report.verification && report.verification.failedCount > 0) {
      return false;
    }
    return true;
  }
}

// ============================================================================
// Additional Types
// ============================================================================

interface EvidenceReportIndex {
  fingerprint: string;
  specFingerprint: string;
  specName: string;
  timestamp: string;
  source: EvidenceReport['source'];
  passed: boolean;
  trustScore?: number;
}

interface SpecStats {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  averageTrustScore: number;
  lastRun: string | null;
}
