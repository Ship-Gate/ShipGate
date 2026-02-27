/**
 * Marketplace API – Domain types
 *
 * Maps 1-to-1 to the Postgres schema in db/schema.sql.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type PackCategory =
  | 'AUTH'
  | 'PAYMENT'
  | 'DATA'
  | 'WORKFLOW'
  | 'INTEGRATION'
  | 'SECURITY'
  | 'GENERAL';

export const PACK_CATEGORIES: PackCategory[] = [
  'AUTH', 'PAYMENT', 'DATA', 'WORKFLOW', 'INTEGRATION', 'SECURITY', 'GENERAL',
];

// ---------------------------------------------------------------------------
// Core domain models
// ---------------------------------------------------------------------------

export interface Author {
  id: string;
  username: string;
  displayName: string;
  email: string;
  apiKeyHash: string;
  publicKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Pack {
  id: string;
  name: string;
  displayName: string;
  description: string;
  authorId: string;
  repository: string | null;
  license: string;
  keywords: string[];
  category: PackCategory;
  downloads: number;
  stars: number;
  isVerified: boolean;
  isDeprecated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PackVersion {
  id: string;
  packId: string;
  version: string;
  contract: string;
  readme: string | null;
  changelog: string | null;
  isLatest: boolean;
  downloads: number;
  publishedAt: Date;
}

export interface Signature {
  id: string;
  versionId: string;
  algorithm: string;
  digest: string;
  signature: string | null;
  signerId: string | null;
  verified: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Composite / response helpers
// ---------------------------------------------------------------------------

export interface PackWithLatest extends Pack {
  latestVersion?: PackVersion | null;
  authorUsername?: string;
}

export interface PackVersionWithSignatures extends PackVersion {
  signatures?: Signature[];
}
