/**
 * Sharding
 * Data partitioning for horizontal scaling
 */

import { ShardConfig, ShardRange } from './types';

/**
 * Shard manager
 */
export class ShardManager {
  private shards: Map<string, ShardConfig> = new Map();
  private hashRing: ConsistentHashRing;

  constructor(private replicationFactor: number = 3) {
    this.hashRing = new ConsistentHashRing();
  }

  /**
   * Add a shard
   */
  addShard(shard: ShardConfig): void {
    this.shards.set(shard.id, shard);
    this.hashRing.addNode(shard.id);
  }

  /**
   * Remove a shard
   */
  removeShard(shardId: string): void {
    this.shards.delete(shardId);
    this.hashRing.removeNode(shardId);
  }

  /**
   * Get shard for a key
   */
  getShard(key: string): ShardConfig | undefined {
    const shardId = this.hashRing.getNode(key);
    return shardId ? this.shards.get(shardId) : undefined;
  }

  /**
   * Get all shards for a key (including replicas)
   */
  getShardsForKey(key: string): ShardConfig[] {
    const shardIds = this.hashRing.getNodes(key, this.replicationFactor);
    return shardIds
      .map((id) => this.shards.get(id))
      .filter((s): s is ShardConfig => s !== undefined);
  }

  /**
   * Get all shards
   */
  getShards(): ShardConfig[] {
    return Array.from(this.shards.values());
  }

  /**
   * Get shard by ID
   */
  getShardById(id: string): ShardConfig | undefined {
    return this.shards.get(id);
  }

  /**
   * Rebalance shards
   */
  async rebalance(): Promise<ShardMigration[]> {
    const migrations: ShardMigration[] = [];

    // Calculate ideal distribution
    const keysPerShard = this.hashRing.getDistribution();
    const avgKeys = Array.from(keysPerShard.values()).reduce((a, b) => a + b, 0) / keysPerShard.size;

    for (const [shardId, keyCount] of keysPerShard) {
      if (keyCount > avgKeys * 1.2) {
        // This shard has too many keys, find a recipient
        const underloaded = Array.from(keysPerShard.entries())
          .filter(([_, count]) => count < avgKeys * 0.8)
          .map(([id]) => id);

        if (underloaded.length > 0) {
          migrations.push({
            sourceShardId: shardId,
            targetShardId: underloaded[0]!,
            keyRange: this.calculateMigrationRange(shardId, keyCount - avgKeys),
          });
        }
      }
    }

    return migrations;
  }

  /**
   * Split a shard
   */
  splitShard(shardId: string): { left: ShardConfig; right: ShardConfig } | undefined {
    const shard = this.shards.get(shardId);
    if (!shard) return undefined;

    const midpoint = this.calculateMidpoint(shard.range);

    const leftShard: ShardConfig = {
      id: `${shardId}_left`,
      range: { start: shard.range.start, end: midpoint },
      replicas: [...shard.replicas],
      primary: shard.primary,
      status: 'splitting',
    };

    const rightShard: ShardConfig = {
      id: `${shardId}_right`,
      range: { start: midpoint, end: shard.range.end },
      replicas: [...shard.replicas],
      primary: shard.primary,
      status: 'splitting',
    };

    this.removeShard(shardId);
    this.addShard(leftShard);
    this.addShard(rightShard);

    return { left: leftShard, right: rightShard };
  }

  /**
   * Merge shards
   */
  mergeShards(leftId: string, rightId: string): ShardConfig | undefined {
    const left = this.shards.get(leftId);
    const right = this.shards.get(rightId);

    if (!left || !right) return undefined;

    const merged: ShardConfig = {
      id: `${leftId}_${rightId}_merged`,
      range: { start: left.range.start, end: right.range.end },
      replicas: [...new Set([...left.replicas, ...right.replicas])],
      primary: left.primary,
      status: 'merging',
    };

    this.removeShard(leftId);
    this.removeShard(rightId);
    this.addShard(merged);

    return merged;
  }

  private calculateMidpoint(range: ShardRange): string {
    // Simple string midpoint calculation
    const start = range.start;
    const end = range.end;

    // Use first differing character
    for (let i = 0; i < Math.max(start.length, end.length); i++) {
      const startChar = start.charCodeAt(i) || 0;
      const endChar = end.charCodeAt(i) || 127;

      if (startChar !== endChar) {
        const midChar = Math.floor((startChar + endChar) / 2);
        return start.substring(0, i) + String.fromCharCode(midChar);
      }
    }

    return start;
  }

  private calculateMigrationRange(shardId: string, _keyCount: number): ShardRange {
    const shard = this.shards.get(shardId)!;
    // Simplified - in production would need to analyze actual key distribution
    return {
      start: shard.range.start,
      end: this.calculateMidpoint(shard.range),
    };
  }
}

/**
 * Shard migration plan
 */
export interface ShardMigration {
  sourceShardId: string;
  targetShardId: string;
  keyRange: ShardRange;
}

/**
 * Consistent hash ring for shard distribution
 */
export class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedHashes: number[] = [];
  private virtualNodes = 150;

  /**
   * Add a node to the ring
   */
  addNode(nodeId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${nodeId}:${i}`);
      this.ring.set(hash, nodeId);
    }
    this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  /**
   * Remove a node from the ring
   */
  removeNode(nodeId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${nodeId}:${i}`);
      this.ring.delete(hash);
    }
    this.sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  /**
   * Get node for a key
   */
  getNode(key: string): string | undefined {
    if (this.ring.size === 0) return undefined;

    const hash = this.hash(key);
    const index = this.findIndex(hash);
    const nodeHash = this.sortedHashes[index];
    return nodeHash !== undefined ? this.ring.get(nodeHash) : undefined;
  }

  /**
   * Get multiple nodes for a key (for replication)
   */
  getNodes(key: string, count: number): string[] {
    if (this.ring.size === 0) return [];

    const nodes: string[] = [];
    const seen = new Set<string>();
    const hash = this.hash(key);
    let index = this.findIndex(hash);

    while (nodes.length < count && nodes.length < this.ring.size / this.virtualNodes) {
      const nodeHash = this.sortedHashes[index];
      const nodeId = nodeHash !== undefined ? this.ring.get(nodeHash) : undefined;

      if (nodeId && !seen.has(nodeId)) {
        nodes.push(nodeId);
        seen.add(nodeId);
      }

      index = (index + 1) % this.sortedHashes.length;
    }

    return nodes;
  }

  /**
   * Get key distribution across nodes
   */
  getDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();

    // Sample keys to estimate distribution
    for (let i = 0; i < 10000; i++) {
      const key = `sample_${i}`;
      const node = this.getNode(key);
      if (node) {
        distribution.set(node, (distribution.get(node) ?? 0) + 1);
      }
    }

    return distribution;
  }

  private hash(key: string): number {
    // Simple hash function - use better one in production
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private findIndex(hash: number): number {
    let low = 0;
    let high = this.sortedHashes.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midHash = this.sortedHashes[mid]!;

      if (midHash === hash) {
        return mid;
      } else if (midHash < hash) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return low % this.sortedHashes.length;
  }
}

/**
 * Create shard manager
 */
export function createShardManager(replicationFactor?: number): ShardManager {
  return new ShardManager(replicationFactor);
}
