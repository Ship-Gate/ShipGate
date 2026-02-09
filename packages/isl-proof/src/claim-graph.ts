/**
 * Unified Claim Graph
 * 
 * Unifies all scanners/verifiers into a single claim graph so engines stop
 * operating in isolation. Multiple engines referencing the same route/env/symbol
 * collapse into one graph node.
 * 
 * @module @isl-lang/proof/claim-graph
 */

import * as crypto from 'crypto';

// ============================================================================
// Unified Claim Schema
// ============================================================================

/**
 * Claim kind - what type of assertion this is
 */
export type ClaimKind =
  | 'route'              // API route claim
  | 'env'                // Environment variable claim
  | 'symbol'             // Code symbol (function/type/class) claim
  | 'type'                // Type definition claim
  | 'postcondition'       // Postcondition verification claim
  | 'precondition'        // Precondition verification claim
  | 'invariant'          // Invariant verification claim
  | 'security'           // Security policy claim
  | 'temporal'           // Temporal property claim
  | 'import'             // Import/export claim
  | 'file'               // File existence claim
  | 'package'            // Package dependency claim
  | 'documentation'      // Documentation claim
  | 'test'               // Test coverage claim
  | 'gate'               // Gate check claim
  | 'build'              // Build artifact claim
  | 'other';             // Other claim types

/**
 * Claim status - verification outcome
 */
export type ClaimStatus =
  | 'proven'             // Claim is verified/proven
  | 'not_proven'         // Claim not yet proven
  | 'violated'           // Claim is violated
  | 'unknown'            // Status unknown
  | 'partial'            // Partially proven
  | 'skipped';           // Claim was skipped

/**
 * Subject identifier - what the claim is about
 * Normalized identifier for deduplication
 */
export interface ClaimSubject {
  /** Subject type */
  type: 'route' | 'env' | 'symbol' | 'type' | 'file' | 'package' | 'clause' | 'other';
  /** Normalized identifier (e.g., "GET /api/users", "DATABASE_URL", "UserService.login") */
  identifier: string;
  /** Optional namespace/domain */
  namespace?: string;
}

/**
 * Location where claim appears or applies
 */
export interface ClaimLocation {
  /** File path (relative to project root) */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed, optional) */
  column?: number;
  /** End line for range claims */
  endLine?: number;
  /** End column for range claims */
  endColumn?: number;
}

/**
 * Evidence supporting or refuting the claim
 */
export interface ClaimEvidence {
  /** Evidence type */
  type: 'test' | 'trace' | 'static_analysis' | 'smt' | 'runtime' | 'manual' | 'filesystem' | 'truthpack' | 'other';
  /** Whether evidence supports the claim */
  supports: boolean;
  /** Confidence 0-1 */
  confidence: number;
  /** Evidence description */
  description: string;
  /** Source location */
  location?: ClaimLocation;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Relationship to other claims
 */
export interface ClaimRelationship {
  /** Target claim ID */
  targetId: string;
  /** Relationship type */
  type: 'depends_on' | 'conflicts_with' | 'supports' | 'refutes' | 'related_to' | 'derived_from';
  /** Relationship strength 0-1 */
  strength?: number;
}

/**
 * Unified Claim - single schema for all engines
 */
export interface UnifiedClaim {
  /** Unique claim identifier */
  id: string;
  
  /** Claim kind */
  kind: ClaimKind;
  
  /** Subject this claim is about (for deduplication) */
  subject: ClaimSubject;
  
  /** Locations where this claim appears/applies */
  locations: ClaimLocation[];
  
  /** Evidence supporting/refuting this claim */
  evidence: ClaimEvidence[];
  
  /** Confidence score 0-1 */
  confidence: number;
  
  /** Engine that produced this claim */
  engine: string;
  
  /** Relationships to other claims */
  relationships: ClaimRelationship[];
  
  /** Claim status */
  status: ClaimStatus;
  
  /** Human-readable description */
  description?: string;
  
  /** Original claim data (engine-specific, preserved for compatibility) */
  original?: Record<string, unknown>;
  
  /** Timestamp when claim was created (ISO 8601) */
  createdAt: string;
}

/**
 * Claim Graph - unified graph of all claims
 */
export interface ClaimGraph {
  /** Graph schema version */
  schemaVersion: '1.0.0';
  
  /** All claims in the graph */
  claims: UnifiedClaim[];
  
  /** Graph metadata */
  metadata: {
    /** Total number of claims */
    totalClaims: number;
    /** Number of unique subjects */
    uniqueSubjects: number;
    /** Engines that contributed claims */
    engines: string[];
    /** Created timestamp */
    createdAt: string;
    /** Graph hash (deterministic) */
    graphHash: string;
  };
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Options for building the claim graph
 */
export interface GraphBuilderOptions {
  /** Whether to deduplicate claims by subject */
  deduplicate?: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Whether to link related claims */
  linkRelated?: boolean;
  /** Custom deduplication key generator */
  dedupeKeyFn?: (claim: UnifiedClaim) => string;
}

/**
 * Claim Graph Builder
 * 
 * Builds a unified claim graph from multiple engines, deduplicating
 * and linking related claims.
 */
export class ClaimGraphBuilder {
  private claims: Map<string, UnifiedClaim> = new Map();
  private subjectIndex: Map<string, Set<string>> = new Map();
  private options: Required<GraphBuilderOptions>;

  constructor(options: GraphBuilderOptions = {}) {
    this.options = {
      deduplicate: options.deduplicate ?? true,
      minConfidence: options.minConfidence ?? 0,
      linkRelated: options.linkRelated ?? true,
      dedupeKeyFn: options.dedupeKeyFn ?? this.defaultDedupeKey,
    };
  }

  /**
   * Add a claim to the graph
   */
  addClaim(claim: UnifiedClaim): void {
    // Filter by confidence threshold
    if (claim.confidence < this.options.minConfidence) {
      return;
    }

    const dedupeKey = this.options.dedupeKeyFn(claim);

    if (this.options.deduplicate) {
      const existing = this.findExistingClaim(dedupeKey, claim);
      
      if (existing) {
        // Merge with existing claim
        this.mergeClaim(existing, claim);
        return;
      }
    }

    // Add new claim
    this.claims.set(claim.id, claim);
    
    // Index by subject for linking
    const subjectKey = this.getSubjectKey(claim.subject);
    if (!this.subjectIndex.has(subjectKey)) {
      this.subjectIndex.set(subjectKey, new Set());
    }
    this.subjectIndex.get(subjectKey)!.add(claim.id);
  }

  /**
   * Add multiple claims at once
   */
  addClaims(claims: UnifiedClaim[]): void {
    for (const claim of claims) {
      this.addClaim(claim);
    }
  }

  /**
   * Build the final graph
   */
  build(): ClaimGraph {
    const claims = Array.from(this.claims.values());

    // Link related claims if enabled
    if (this.options.linkRelated) {
      this.linkRelatedClaims(claims);
    }

    // Sort claims for deterministic output
    claims.sort((a, b) => {
      // Sort by subject type, then identifier, then engine
      const subjectCompare = a.subject.type.localeCompare(b.subject.type);
      if (subjectCompare !== 0) return subjectCompare;
      
      const idCompare = a.subject.identifier.localeCompare(b.subject.identifier);
      if (idCompare !== 0) return idCompare;
      
      return a.engine.localeCompare(b.engine);
    });

    // Calculate metadata
    const uniqueSubjects = new Set(claims.map(c => this.getSubjectKey(c.subject))).size;
    const engines = Array.from(new Set(claims.map(c => c.engine))).sort();
    const graphHash = this.computeGraphHash(claims);

    return {
      schemaVersion: '1.0.0',
      claims,
      metadata: {
        totalClaims: claims.length,
        uniqueSubjects,
        engines,
        createdAt: new Date().toISOString(),
        graphHash,
      },
    };
  }

  /**
   * Get current claims (for inspection)
   */
  getClaims(): UnifiedClaim[] {
    return Array.from(this.claims.values());
  }

  /**
   * Clear all claims
   */
  clear(): void {
    this.claims.clear();
    this.subjectIndex.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private defaultDedupeKey(claim: UnifiedClaim): string {
    // Deduplicate by subject + kind
    return `${claim.subject.type}:${claim.subject.identifier}:${claim.kind}`;
  }

  private getSubjectKey(subject: ClaimSubject): string {
    const ns = subject.namespace ? `${subject.namespace}:` : '';
    return `${subject.type}:${ns}${subject.identifier}`;
  }

  private findExistingClaim(dedupeKey: string, newClaim: UnifiedClaim): UnifiedClaim | undefined {
    // Find claims with same dedupe key
    for (const claim of this.claims.values()) {
      if (this.options.dedupeKeyFn(claim) === dedupeKey) {
        return claim;
      }
    }
    return undefined;
  }

  private mergeClaim(existing: UnifiedClaim, newClaim: UnifiedClaim): void {
    // Merge locations (deduplicate)
    const locationKeys = new Set(
      existing.locations.map(l => `${l.file}:${l.line}:${l.column ?? ''}`)
    );
    
    for (const loc of newClaim.locations) {
      const key = `${loc.file}:${loc.line}:${loc.column ?? ''}`;
      if (!locationKeys.has(key)) {
        existing.locations.push(loc);
        locationKeys.add(key);
      }
    }

    // Merge evidence
    existing.evidence.push(...newClaim.evidence);

    // Update confidence (take max)
    existing.confidence = Math.max(existing.confidence, newClaim.confidence);

    // Update status (prefer proven > partial > not_proven > unknown)
    const statusPriority: Record<ClaimStatus, number> = {
      proven: 5,
      partial: 4,
      not_proven: 3,
      unknown: 2,
      skipped: 1,
      violated: 0,
    };
    
    if (statusPriority[newClaim.status] > statusPriority[existing.status]) {
      existing.status = newClaim.status;
    }

    // Merge engines (track all engines that contributed)
    if (!existing.original) {
      existing.original = {};
    }
    existing.original.engines = [
      ...(existing.original.engines as string[] || [existing.engine]),
      newClaim.engine,
    ];
    existing.engine = `${existing.engine},${newClaim.engine}`;

    // Preserve original data
    if (newClaim.original) {
      existing.original = { ...existing.original, ...newClaim.original };
    }
  }

  private linkRelatedClaims(claims: UnifiedClaim[]): void {
    // Link claims with same subject
    for (const claim of claims) {
      const subjectKey = this.getSubjectKey(claim.subject);
      const relatedIds = this.subjectIndex.get(subjectKey) || new Set();
      
      for (const relatedId of relatedIds) {
        if (relatedId !== claim.id) {
          // Check if relationship already exists
          const exists = claim.relationships.some(r => r.targetId === relatedId);
          if (!exists) {
            claim.relationships.push({
              targetId: relatedId,
              type: 'related_to',
              strength: 0.8,
            });
          }
        }
      }

      // Link claims with conflicting statuses
      for (const other of claims) {
        if (other.id === claim.id) continue;
        
        const sameSubject = this.getSubjectKey(claim.subject) === this.getSubjectKey(other.subject);
        const conflicting = (
          (claim.status === 'proven' && other.status === 'violated') ||
          (claim.status === 'violated' && other.status === 'proven')
        );

        if (sameSubject && conflicting) {
          const exists = claim.relationships.some(r => r.targetId === other.id && r.type === 'conflicts_with');
          if (!exists) {
            claim.relationships.push({
              targetId: other.id,
              type: 'conflicts_with',
              strength: 1.0,
            });
          }
        }
      }
    }
  }

  private computeGraphHash(claims: UnifiedClaim[]): string {
    // Create deterministic hash of claims (excluding timestamps)
    const hashable = claims.map(c => ({
      id: c.id,
      kind: c.kind,
      subject: c.subject,
      status: c.status,
      confidence: c.confidence,
      engine: c.engine,
    }));
    
    const json = JSON.stringify(hashable, Object.keys(hashable[0] || {}).sort());
    return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new claim graph builder
 */
export function createClaimGraphBuilder(options?: GraphBuilderOptions): ClaimGraphBuilder {
  return new ClaimGraphBuilder(options);
}

/**
 * Build a claim graph from claims
 */
export function buildClaimGraph(
  claims: UnifiedClaim[],
  options?: GraphBuilderOptions
): ClaimGraph {
  const builder = createClaimGraphBuilder(options);
  builder.addClaims(claims);
  return builder.build();
}
