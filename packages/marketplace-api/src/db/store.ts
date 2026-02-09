/**
 * In-memory data store for the Marketplace API.
 *
 * Mirrors the Postgres schema (see schema.sql) so that the API can run
 * and be tested without a real database.  A production adapter would swap
 * this for pg queries.
 */

import crypto from 'node:crypto';
import type {
  Author,
  Pack,
  PackVersion,
  Signature,
  PackCategory,
  PackWithLatest,
} from '../types.js';

function uid(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface StoreState {
  authors: Author[];
  packs: Pack[];
  versions: PackVersion[];
  signatures: Signature[];
}

export function createEmptyState(): StoreState {
  return { authors: [], packs: [], versions: [], signatures: [] };
}

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

export class MarketplaceStore {
  private state: StoreState;

  constructor(initial?: StoreState) {
    this.state = initial ?? createEmptyState();
  }

  /** Reset – useful in tests */
  reset(state?: StoreState): void {
    this.state = state ?? createEmptyState();
  }

  // -----------------------------------------------------------------------
  // Authors
  // -----------------------------------------------------------------------

  addAuthor(input: {
    username: string;
    displayName: string;
    email: string;
    apiKeyHash: string;
    publicKey?: string | null;
  }): Author {
    const author: Author = {
      id: uid(),
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      apiKeyHash: input.apiKeyHash,
      publicKey: input.publicKey ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.state.authors.push(author);
    return author;
  }

  getAuthorByApiKeyHash(hash: string): Author | undefined {
    return this.state.authors.find(a => a.apiKeyHash === hash);
  }

  getAuthorById(id: string): Author | undefined {
    return this.state.authors.find(a => a.id === id);
  }

  getAuthorByUsername(username: string): Author | undefined {
    return this.state.authors.find(a => a.username === username);
  }

  // -----------------------------------------------------------------------
  // Packs
  // -----------------------------------------------------------------------

  addPack(input: {
    name: string;
    displayName: string;
    description: string;
    authorId: string;
    repository?: string | null;
    license?: string;
    keywords?: string[];
    category?: PackCategory;
  }): Pack {
    const pack: Pack = {
      id: uid(),
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      authorId: input.authorId,
      repository: input.repository ?? null,
      license: input.license ?? 'MIT',
      keywords: input.keywords ?? [],
      category: input.category ?? 'GENERAL',
      downloads: 0,
      stars: 0,
      isVerified: false,
      isDeprecated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.state.packs.push(pack);
    return pack;
  }

  getPackByName(name: string): Pack | undefined {
    return this.state.packs.find(p => p.name === name);
  }

  getPackById(id: string): Pack | undefined {
    return this.state.packs.find(p => p.id === id);
  }

  listPacks(opts: {
    limit?: number;
    offset?: number;
    category?: PackCategory;
    author?: string;
    verified?: boolean;
    sortBy?: 'downloads' | 'stars' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): { packs: PackWithLatest[]; total: number } {
    const {
      limit = 20,
      offset = 0,
      category,
      author,
      verified,
      sortBy = 'downloads',
      sortOrder = 'desc',
    } = opts;

    let filtered = this.state.packs.filter(p => !p.isDeprecated);
    if (category) filtered = filtered.filter(p => p.category === category);
    if (author) {
      const authorObj = this.state.authors.find(a => a.username === author);
      if (authorObj) filtered = filtered.filter(p => p.authorId === authorObj.id);
      else filtered = [];
    }
    if (verified !== undefined) filtered = filtered.filter(p => p.isVerified === verified);

    const dir = sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const va = a[sortBy] instanceof Date ? (a[sortBy] as Date).getTime() : (a[sortBy] as number);
      const vb = b[sortBy] instanceof Date ? (b[sortBy] as Date).getTime() : (b[sortBy] as number);
      return (va - vb) * dir;
    });

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

    const result: PackWithLatest[] = page.map(p => {
      const latest = this.state.versions.find(v => v.packId === p.id && v.isLatest) ?? null;
      const authorObj = this.state.authors.find(a => a.id === p.authorId);
      return { ...p, latestVersion: latest, authorUsername: authorObj?.username };
    });

    return { packs: result, total };
  }

  incrementDownloads(packId: string): void {
    const p = this.state.packs.find(pk => pk.id === packId);
    if (p) p.downloads++;
  }

  // -----------------------------------------------------------------------
  // Versions
  // -----------------------------------------------------------------------

  addVersion(input: {
    packId: string;
    version: string;
    contract: string;
    readme?: string | null;
    changelog?: string | null;
  }): PackVersion {
    // Un-mark previous latest
    for (const v of this.state.versions) {
      if (v.packId === input.packId) v.isLatest = false;
    }

    const ver: PackVersion = {
      id: uid(),
      packId: input.packId,
      version: input.version,
      contract: input.contract,
      readme: input.readme ?? null,
      changelog: input.changelog ?? null,
      isLatest: true,
      downloads: 0,
      publishedAt: new Date(),
    };
    this.state.versions.push(ver);

    // Bump pack updatedAt
    const pack = this.state.packs.find(p => p.id === input.packId);
    if (pack) pack.updatedAt = new Date();

    return ver;
  }

  getVersionsByPack(packId: string): PackVersion[] {
    return this.state.versions
      .filter(v => v.packId === packId)
      .sort((a, b) => {
        const dt = b.publishedAt.getTime() - a.publishedAt.getTime();
        if (dt !== 0) return dt;
        // Stable tiebreaker: newer semver first
        return b.version.localeCompare(a.version);
      });
  }

  getVersion(packId: string, version: string): PackVersion | undefined {
    if (version === 'latest') {
      return this.state.versions.find(v => v.packId === packId && v.isLatest);
    }
    return this.state.versions.find(v => v.packId === packId && v.version === version);
  }

  getLatestVersion(packId: string): PackVersion | undefined {
    return this.state.versions.find(v => v.packId === packId && v.isLatest);
  }

  // -----------------------------------------------------------------------
  // Signatures
  // -----------------------------------------------------------------------

  addSignature(input: {
    versionId: string;
    algorithm?: string;
    digest: string;
    signature?: string | null;
    signerId?: string | null;
    verified?: boolean;
  }): Signature {
    const sig: Signature = {
      id: uid(),
      versionId: input.versionId,
      algorithm: input.algorithm ?? 'sha256',
      digest: input.digest,
      signature: input.signature ?? null,
      signerId: input.signerId ?? null,
      verified: input.verified ?? false,
      createdAt: new Date(),
    };
    this.state.signatures.push(sig);
    return sig;
  }

  getSignaturesByVersion(versionId: string): Signature[] {
    return this.state.signatures.filter(s => s.versionId === versionId);
  }

  markSignatureVerified(signatureId: string): void {
    const sig = this.state.signatures.find(s => s.id === signatureId);
    if (sig) sig.verified = true;
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  searchPacks(query: string, opts: {
    category?: PackCategory;
    limit?: number;
    offset?: number;
  } = {}): { results: PackWithLatest[]; total: number; query: string } {
    const { category, limit = 20, offset = 0 } = opts;
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);

    let candidates = this.state.packs.filter(p => !p.isDeprecated);
    if (category) candidates = candidates.filter(p => p.category === category);

    const scored = candidates.map(p => {
      let score = 0;
      const nl = p.name.toLowerCase();
      const dl = p.description.toLowerCase();
      const kl = p.keywords.map(k => k.toLowerCase());

      if (nl === q) score += 100;
      else if (nl.includes(q)) score += 50;
      else if (words.some(w => nl.includes(w))) score += 25;

      if (dl.includes(q)) score += 20;
      else if (words.some(w => w.length > 2 && dl.includes(w))) score += 10;

      if (kl.includes(q)) score += 40;
      else if (kl.some(k => k.includes(q))) score += 20;

      const latest = this.state.versions.find(v => v.packId === p.id && v.isLatest) ?? null;
      const authorObj = this.state.authors.find(a => a.id === p.authorId);

      return { ...p, latestVersion: latest, authorUsername: authorObj?.username, _score: score };
    }).filter(r => r._score > 0)
      .sort((a, b) => b._score - a._score);

    const total = scored.length;
    const page = scored.slice(offset, offset + limit).map(({ _score, ...rest }) => rest);

    return { results: page as PackWithLatest[], total, query };
  }
}
