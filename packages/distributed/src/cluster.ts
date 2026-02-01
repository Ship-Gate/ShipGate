/**
 * Cluster Management
 * Node membership and cluster coordination
 */

import { ClusterNode, NodeStatus, NodeRole, ClusterConfig } from './types';

/**
 * Cluster manager
 */
export class ClusterManager {
  private nodes: Map<string, ClusterNode> = new Map();
  private config: ClusterConfig;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private failureDetector: FailureDetector;
  private listeners: Map<ClusterEvent, Set<(node: ClusterNode) => void>> = new Map();

  constructor(config: ClusterConfig) {
    this.config = config;
    this.failureDetector = new FailureDetector(config.heartbeatInterval * 3);

    // Register self
    this.nodes.set(config.nodeId, {
      id: config.nodeId,
      address: config.address,
      port: config.port,
      status: 'healthy',
      role: 'follower',
      metadata: {},
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });
  }

  /**
   * Start cluster management
   */
  start(): void {
    // Connect to seed nodes
    this.connectToSeeds();

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
      this.checkFailures();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop cluster management
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  /**
   * Get all nodes
   */
  getNodes(): ClusterNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get healthy nodes
   */
  getHealthyNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.status === 'healthy'
    );
  }

  /**
   * Get node by ID
   */
  getNode(id: string): ClusterNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get current node
   */
  getSelf(): ClusterNode {
    return this.nodes.get(this.config.nodeId)!;
  }

  /**
   * Get leader node
   */
  getLeader(): ClusterNode | undefined {
    return Array.from(this.nodes.values()).find((n) => n.role === 'leader');
  }

  /**
   * Handle heartbeat from another node
   */
  handleHeartbeat(nodeId: string, nodeInfo: Partial<ClusterNode>): void {
    const existing = this.nodes.get(nodeId);

    if (existing) {
      existing.lastHeartbeat = Date.now();
      existing.status = 'healthy';
      Object.assign(existing, nodeInfo);
    } else {
      // New node discovered
      const newNode: ClusterNode = {
        id: nodeId,
        address: nodeInfo.address ?? 'unknown',
        port: nodeInfo.port ?? 0,
        status: 'healthy',
        role: nodeInfo.role ?? 'follower',
        metadata: nodeInfo.metadata ?? {},
        lastHeartbeat: Date.now(),
        joinedAt: Date.now(),
      };
      this.nodes.set(nodeId, newNode);
      this.emit('join', newNode);
    }

    this.failureDetector.recordHeartbeat(nodeId);
  }

  /**
   * Mark node as leaving
   */
  markLeaving(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'leaving';
      this.emit('leaving', node);
    }
  }

  /**
   * Remove node from cluster
   */
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.nodes.delete(nodeId);
      this.emit('leave', node);
    }
  }

  /**
   * Subscribe to cluster events
   */
  on(event: ClusterEvent, listener: (node: ClusterNode) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  /**
   * Update node role
   */
  setRole(role: NodeRole): void {
    const self = this.getSelf();
    self.role = role;
  }

  /**
   * Update node metadata
   */
  setMetadata(metadata: Record<string, unknown>): void {
    const self = this.getSelf();
    self.metadata = { ...self.metadata, ...metadata };
  }

  private async connectToSeeds(): Promise<void> {
    for (const seed of this.config.seeds) {
      try {
        // In production, actually connect and exchange info
        const [address, portStr] = seed.split(':');
        const port = parseInt(portStr ?? '0', 10);

        const seedNode: ClusterNode = {
          id: `seed_${seed}`,
          address: address ?? seed,
          port,
          status: 'unknown',
          role: 'follower',
          metadata: {},
          lastHeartbeat: 0,
          joinedAt: Date.now(),
        };

        this.nodes.set(seedNode.id, seedNode);
      } catch {
        // Seed unavailable, continue
      }
    }
  }

  private async sendHeartbeats(): Promise<void> {
    const self = this.getSelf();
    self.lastHeartbeat = Date.now();

    // In production, send heartbeats to all nodes
    // For now, just update local state
  }

  private checkFailures(): void {
    for (const node of this.nodes.values()) {
      if (node.id === this.config.nodeId) continue;

      if (this.failureDetector.isFailed(node.id)) {
        node.status = 'unhealthy';
        this.emit('failure', node);
      }
    }
  }

  private emit(event: ClusterEvent, node: ClusterNode): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(node);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }
}

/**
 * Cluster events
 */
export type ClusterEvent = 'join' | 'leave' | 'leaving' | 'failure' | 'recovery';

/**
 * Failure detector using phi-accrual algorithm (simplified)
 */
class FailureDetector {
  private heartbeatHistory: Map<string, number[]> = new Map();
  private threshold: number;

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  recordHeartbeat(nodeId: string): void {
    if (!this.heartbeatHistory.has(nodeId)) {
      this.heartbeatHistory.set(nodeId, []);
    }
    const history = this.heartbeatHistory.get(nodeId)!;
    history.push(Date.now());

    // Keep only last 100 heartbeats
    if (history.length > 100) {
      history.shift();
    }
  }

  isFailed(nodeId: string): boolean {
    const history = this.heartbeatHistory.get(nodeId);
    if (!history || history.length === 0) return true;

    const lastHeartbeat = history[history.length - 1]!;
    const elapsed = Date.now() - lastHeartbeat;

    return elapsed > this.threshold;
  }

  getPhiValue(nodeId: string): number {
    const history = this.heartbeatHistory.get(nodeId);
    if (!history || history.length < 2) return Infinity;

    // Calculate mean interval
    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
      intervals.push(history[i]! - history[i - 1]!);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Calculate elapsed time since last heartbeat
    const lastHeartbeat = history[history.length - 1]!;
    const elapsed = Date.now() - lastHeartbeat;

    // Simplified phi calculation
    return elapsed / mean;
  }
}

/**
 * Create cluster manager
 */
export function createClusterManager(config: ClusterConfig): ClusterManager {
  return new ClusterManager(config);
}
