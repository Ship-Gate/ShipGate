// ============================================================================
// ISL Standard Library - Event Hashing & Chain Verification
// @stdlib/audit/utils/hashing
// ============================================================================

import { createHash } from 'crypto';
import type { AuditEvent } from '../types';

// ============================================================================
// HASH GENERATION
// ============================================================================

/**
 * Generate a cryptographic hash for an audit event
 * This provides integrity verification for individual events
 */
export function hashEvent(event: AuditEvent): string {
  const content = getHashContent(event);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get the content to be hashed for an event
 * Excludes the hash field itself to allow verification
 */
function getHashContent(event: AuditEvent): string {
  return JSON.stringify({
    id: event.id,
    action: event.action,
    category: event.category,
    outcome: event.outcome,
    actor: {
      id: event.actor.id,
      type: event.actor.type,
    },
    resource: event.resource ? {
      type: event.resource.type,
      id: event.resource.id,
    } : null,
    source: {
      service: event.source.service,
      request_id: event.source.request_id,
    },
    timestamp: event.timestamp instanceof Date 
      ? event.timestamp.toISOString() 
      : event.timestamp,
    previous_hash: event.previous_hash ?? null,
  });
}

// ============================================================================
// HASH VERIFICATION
// ============================================================================

/**
 * Verify the integrity of a single event
 */
export function verifyEventHash(event: AuditEvent): boolean {
  if (!event.hash) return false;
  
  const expectedHash = hashEvent(event);
  return event.hash === expectedHash;
}

/**
 * Verify the integrity of an event chain
 * Checks that each event's previous_hash matches the hash of the previous event
 */
export function verifyEventChain(events: AuditEvent[]): ChainVerificationResult {
  if (events.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors: ChainError[] = [];
  let lastHash: string | null = null;

  // Sort events by timestamp
  const sorted = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    if (!event) continue;

    // Verify individual event hash
    if (event.hash && !verifyEventHash(event)) {
      errors.push({
        type: 'INVALID_HASH',
        eventId: event.id,
        index: i,
        message: 'Event hash does not match computed hash',
      });
    }

    // Verify chain link (if not first event)
    if (i > 0 && event.previous_hash !== lastHash) {
      errors.push({
        type: 'BROKEN_CHAIN',
        eventId: event.id,
        index: i,
        message: `Expected previous_hash ${lastHash}, got ${event.previous_hash}`,
      });
    }

    lastHash = event.hash ?? null;
  }

  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];

  return {
    valid: errors.length === 0,
    errors,
    chainLength: sorted.length,
    firstEventId: firstEvent?.id,
    lastEventId: lastEvent?.id,
  };
}

// ============================================================================
// MERKLE TREE FOR BATCH VERIFICATION
// ============================================================================

/**
 * Build a Merkle tree from event hashes
 * Useful for efficient verification of large batches
 */
export function buildMerkleTree(events: AuditEvent[]): MerkleTree {
  if (events.length === 0) {
    return { root: '', levels: [], leaves: [] };
  }

  // Get leaf hashes
  const leaves = events.map(e => e.hash ?? hashEvent(e));
  const levels: string[][] = [leaves];

  // Build tree levels
  let currentLevel = leaves;
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i] ?? '';
      const right = currentLevel[i + 1] ?? left; // Duplicate last if odd
      const combined = createHash('sha256')
        .update(left + right)
        .digest('hex');
      nextLevel.push(combined);
    }
    
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0] ?? '',
    levels,
    leaves,
  };
}

/**
 * Generate a Merkle proof for an event at a given index
 */
export function getMerkleProof(tree: MerkleTree, index: number): MerkleProof {
  const proof: ProofNode[] = [];
  let currentIndex = index;

  for (let level = 0; level < tree.levels.length - 1; level++) {
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    const currentLevelArray = tree.levels[level];
    
    if (currentLevelArray && siblingIndex < currentLevelArray.length) {
      const siblingHash = currentLevelArray[siblingIndex];
      if (siblingHash) {
        proof.push({
          hash: siblingHash,
          position: isRight ? 'left' : 'right',
        });
      }
    }
    
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    root: tree.root,
    proof,
    leafHash: tree.leaves[index] ?? '',
    leafIndex: index,
  };
}

/**
 * Verify a Merkle proof
 */
export function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leafHash;

  for (const node of proof.proof) {
    const combined = node.position === 'left'
      ? node.hash + currentHash
      : currentHash + node.hash;
    currentHash = createHash('sha256').update(combined).digest('hex');
  }

  return currentHash === proof.root;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ChainVerificationResult {
  valid: boolean;
  errors: ChainError[];
  chainLength?: number;
  firstEventId?: string;
  lastEventId?: string;
}

export interface ChainError {
  type: 'INVALID_HASH' | 'BROKEN_CHAIN' | 'MISSING_HASH';
  eventId: string;
  index: number;
  message: string;
}

export interface MerkleTree {
  root: string;
  levels: string[][];
  leaves: string[];
}

export interface MerkleProof {
  root: string;
  proof: ProofNode[];
  leafHash: string;
  leafIndex: number;
}

export interface ProofNode {
  hash: string;
  position: 'left' | 'right';
}
