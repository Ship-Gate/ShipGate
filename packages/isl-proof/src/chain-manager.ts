/**
 * Proof Chain Manager
 *
 * Manages a persistent chain of proof bundles for a project, enabling
 * continuous trust across versions.  The chain is stored as a JSON
 * index file inside the chain directory (default: `.shipgate/proof-chain/`).
 *
 * Chain index structure:
 *   .shipgate/proof-chain/
 *   └── chain-index.json     # ordered list of ProofChainInfo entries
 *
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  ProofBundleManifest,
  ProofRegression,
} from './manifest.js';

// ============================================================================
// Types
// ============================================================================

export interface ProofChainInfo {
  bundleId: string;
  bundlePath: string;
  sequenceNumber: number;
  chainId: string;
  verdict: string;
  generatedAt: string;
  specDomain: string;
  specVersion: string;
  manifestHash: string;
  revoked?: {
    at: string;
    reason: string;
  };
}

interface ChainIndex {
  version: '1.0.0';
  chainId: string;
  entries: ProofChainInfo[];
}

// ============================================================================
// Chain Manager
// ============================================================================

export class ProofChainManager {
  private readonly chainDir: string;
  private readonly indexPath: string;

  constructor(projectRoot: string, chainDir?: string) {
    this.chainDir = chainDir ?? path.join(projectRoot, '.shipgate', 'proof-chain');
    this.indexPath = path.join(this.chainDir, 'chain-index.json');
  }

  /**
   * Return the latest non-revoked bundle in the chain, or null if the
   * chain is empty or has not been initialised yet.
   */
  async getLatestBundle(): Promise<ProofChainInfo | null> {
    const index = await this.readIndex();
    if (!index) return null;

    for (let i = index.entries.length - 1; i >= 0; i--) {
      if (!index.entries[i].revoked) {
        return index.entries[i];
      }
    }
    return null;
  }

  /**
   * Register a new bundle in the chain.
   *
   * Reads the bundle's manifest.json, extracts metadata, and appends a
   * new entry to the chain index.
   */
  async registerBundle(bundleId: string, bundlePath: string): Promise<void> {
    const manifestPath = path.join(bundlePath, 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw) as ProofBundleManifest;
    const manifestHash = crypto.createHash('sha256').update(manifestRaw).digest('hex');

    const chainId = manifest.chain?.chainId ?? manifest.spec.domain;
    const sequenceNumber = manifest.chain?.sequenceNumber ?? 1;

    let index = await this.readIndex();
    if (!index) {
      index = { version: '1.0.0', chainId, entries: [] };
    }

    const entry: ProofChainInfo = {
      bundleId,
      bundlePath: path.resolve(bundlePath),
      sequenceNumber,
      chainId,
      verdict: manifest.verdict,
      generatedAt: manifest.generatedAt,
      specDomain: manifest.spec.domain,
      specVersion: manifest.spec.version,
      manifestHash,
    };

    index.entries.push(entry);
    await this.writeIndex(index);
  }

  /**
   * Return the last `limit` entries from the chain (most recent last).
   * If limit is omitted, all entries are returned.
   */
  async getChainHistory(limit?: number): Promise<ProofChainInfo[]> {
    const index = await this.readIndex();
    if (!index) return [];

    if (limit !== undefined && limit > 0) {
      return index.entries.slice(-limit);
    }
    return [...index.entries];
  }

  /**
   * Compare two manifests and return regressions — claims whose
   * verification strength decreased between versions.
   */
  detectRegressions(
    current: ProofBundleManifest,
    previous: ProofBundleManifest,
  ): ProofRegression[] {
    const regressions: ProofRegression[] = [];

    if (!current.verifyResults?.clauses || !previous.verifyResults?.clauses) {
      return regressions;
    }

    const statusStrength: Record<string, number> = {
      'proven': 3,
      'not_proven': 1,
      'unknown': 0,
      'violated': -1,
    };

    const methodStrength: Record<string, number> = {
      'smt-proof': 5,
      'pbt-exhaustive': 4,
      'static-analysis': 3,
      'runtime-trace': 2,
      'heuristic': 1,
    };

    for (const prevClause of previous.verifyResults.clauses) {
      const curClause = current.verifyResults.clauses.find(
        c => c.clauseId === prevClause.clauseId,
      );
      if (!curClause) continue;

      const prevS = statusStrength[prevClause.status] ?? 0;
      const curS = statusStrength[curClause.status] ?? 0;
      const prevM = methodStrength[prevClause.proofMethod ?? 'heuristic'] ?? 0;
      const curM = methodStrength[curClause.proofMethod ?? 'heuristic'] ?? 0;

      if (curS < prevS || (curS === prevS && curM < prevM)) {
        regressions.push({
          claimId: curClause.clauseId,
          property: curClause.clauseType,
          previousStatus: prevClause.status,
          currentStatus: curClause.status,
          previousMethod: prevClause.proofMethod ?? 'heuristic',
          currentMethod: curClause.proofMethod ?? 'heuristic',
        });
      }
    }

    return regressions;
  }

  /**
   * Mark a bundle as revoked.  Revocation cascades: every bundle whose
   * sequenceNumber is greater than or equal to the revoked bundle is also
   * marked as revoked (downstream trust is invalidated).
   */
  async revokeBundle(bundleId: string, reason: string): Promise<void> {
    const index = await this.readIndex();
    if (!index) return;

    const target = index.entries.find(e => e.bundleId === bundleId);
    if (!target) return;

    const revokedAt = new Date().toISOString();

    for (const entry of index.entries) {
      if (entry.sequenceNumber >= target.sequenceNumber && !entry.revoked) {
        entry.revoked = { at: revokedAt, reason };
      }
    }

    await this.writeIndex(index);
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private async readIndex(): Promise<ChainIndex | null> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(raw) as ChainIndex;
    } catch {
      return null;
    }
  }

  private async writeIndex(index: ChainIndex): Promise<void> {
    await fs.mkdir(this.chainDir, { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }
}
