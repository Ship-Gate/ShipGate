/**
 * Consensus Implementation
 * Raft consensus algorithm for ISL distributed execution
 */

import {
  ClusterNode,
  NodeRole,
  LogEntry,
  RaftState,
  ClusterConfig,
} from './types';

/**
 * Raft consensus implementation
 */
export class RaftConsensus<T = unknown> {
  private state: RaftState;
  private config: ClusterConfig;
  private nodes: Map<string, ClusterNode> = new Map();
  private electionTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private onApply?: (entry: LogEntry<T>) => void;
  private transport?: RaftTransport;

  // Leader state
  private nextIndex: Map<string, number> = new Map();
  private matchIndex: Map<string, number> = new Map();

  constructor(config: ClusterConfig) {
    this.config = config;
    this.state = {
      currentTerm: 0,
      votedFor: null,
      log: [],
      commitIndex: 0,
      lastApplied: 0,
      role: 'follower',
      leader: null,
    };
  }

  /**
   * Start the consensus module
   */
  start(transport: RaftTransport, onApply: (entry: LogEntry<T>) => void): void {
    this.transport = transport;
    this.onApply = onApply;
    this.resetElectionTimer();
  }

  /**
   * Stop the consensus module
   */
  stop(): void {
    if (this.electionTimer) clearTimeout(this.electionTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  /**
   * Get current state
   */
  getState(): Readonly<RaftState> {
    return this.state;
  }

  /**
   * Check if this node is leader
   */
  isLeader(): boolean {
    return this.state.role === 'leader';
  }

  /**
   * Get current leader
   */
  getLeader(): string | null {
    return this.state.leader;
  }

  /**
   * Propose a command (leader only)
   */
  async propose(command: T): Promise<boolean> {
    if (!this.isLeader()) {
      return false;
    }

    const entry: LogEntry<T> = {
      index: this.state.log.length,
      term: this.state.currentTerm,
      command,
      timestamp: Date.now(),
    };

    this.state.log.push(entry);

    // Replicate to followers
    await this.replicateEntries();

    return true;
  }

  /**
   * Handle RequestVote RPC
   */
  handleRequestVote(request: RequestVoteRequest): RequestVoteResponse {
    const { term, candidateId, lastLogIndex, lastLogTerm } = request;

    // Update term if needed
    if (term > this.state.currentTerm) {
      this.stepDown(term);
    }

    let voteGranted = false;

    if (term < this.state.currentTerm) {
      // Reject if candidate's term is stale
      voteGranted = false;
    } else if (
      (this.state.votedFor === null || this.state.votedFor === candidateId) &&
      this.isLogUpToDate(lastLogIndex, lastLogTerm)
    ) {
      // Grant vote
      this.state.votedFor = candidateId;
      voteGranted = true;
      this.resetElectionTimer();
    }

    return {
      term: this.state.currentTerm,
      voteGranted,
    };
  }

  /**
   * Handle AppendEntries RPC
   */
  handleAppendEntries(request: AppendEntriesRequest<T>): AppendEntriesResponse {
    const { term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = request;

    // Update term if needed
    if (term > this.state.currentTerm) {
      this.stepDown(term);
    }

    if (term < this.state.currentTerm) {
      return { term: this.state.currentTerm, success: false };
    }

    // Valid leader heartbeat
    this.state.leader = leaderId;
    this.state.role = 'follower';
    this.resetElectionTimer();

    // Check log consistency
    if (prevLogIndex > 0) {
      const prevEntry = this.state.log[prevLogIndex - 1];
      if (!prevEntry || prevEntry.term !== prevLogTerm) {
        return { term: this.state.currentTerm, success: false };
      }
    }

    // Append new entries
    if (entries.length > 0) {
      // Remove conflicting entries
      this.state.log = this.state.log.slice(0, prevLogIndex);
      // Append new entries
      this.state.log.push(...entries);
    }

    // Update commit index
    if (leaderCommit > this.state.commitIndex) {
      this.state.commitIndex = Math.min(leaderCommit, this.state.log.length);
      this.applyEntries();
    }

    return { term: this.state.currentTerm, success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  private resetElectionTimer(): void {
    if (this.electionTimer) clearTimeout(this.electionTimer);

    const timeout =
      this.config.electionTimeout +
      Math.random() * this.config.electionTimeout;

    this.electionTimer = setTimeout(() => this.startElection(), timeout);
  }

  private async startElection(): Promise<void> {
    this.state.currentTerm++;
    this.state.role = 'candidate';
    this.state.votedFor = this.config.nodeId;

    const lastLogIndex = this.state.log.length;
    const lastLogTerm = this.state.log[lastLogIndex - 1]?.term ?? 0;

    let votesReceived = 1; // Vote for self
    const votesNeeded = Math.floor(this.nodes.size / 2) + 1;

    // Request votes from all nodes
    const votePromises = Array.from(this.nodes.keys()).map(async (nodeId) => {
      if (nodeId === this.config.nodeId) return;

      try {
        const response = await this.transport!.requestVote(nodeId, {
          term: this.state.currentTerm,
          candidateId: this.config.nodeId,
          lastLogIndex,
          lastLogTerm,
        });

        if (response.voteGranted) {
          votesReceived++;
        } else if (response.term > this.state.currentTerm) {
          this.stepDown(response.term);
        }
      } catch {
        // Node unreachable
      }
    });

    await Promise.all(votePromises);

    // Check if we won
    if (this.state.role === 'candidate' && votesReceived >= votesNeeded) {
      this.becomeLeader();
    } else {
      this.resetElectionTimer();
    }
  }

  private becomeLeader(): void {
    this.state.role = 'leader';
    this.state.leader = this.config.nodeId;

    // Initialize leader state
    for (const nodeId of this.nodes.keys()) {
      this.nextIndex.set(nodeId, this.state.log.length + 1);
      this.matchIndex.set(nodeId, 0);
    }

    // Start heartbeats
    this.startHeartbeats();
  }

  private startHeartbeats(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      if (this.isLeader()) {
        this.replicateEntries();
      }
    }, this.config.heartbeatInterval);
  }

  private async replicateEntries(): Promise<void> {
    const replicationPromises = Array.from(this.nodes.keys()).map(async (nodeId) => {
      if (nodeId === this.config.nodeId) return;

      const nextIdx = this.nextIndex.get(nodeId) ?? 1;
      const prevLogIndex = nextIdx - 1;
      const prevLogTerm = this.state.log[prevLogIndex - 1]?.term ?? 0;
      const entries = this.state.log.slice(prevLogIndex);

      try {
        const response = await this.transport!.appendEntries(nodeId, {
          term: this.state.currentTerm,
          leaderId: this.config.nodeId,
          prevLogIndex,
          prevLogTerm,
          entries,
          leaderCommit: this.state.commitIndex,
        });

        if (response.success) {
          this.nextIndex.set(nodeId, nextIdx + entries.length);
          this.matchIndex.set(nodeId, prevLogIndex + entries.length);
          this.updateCommitIndex();
        } else if (response.term > this.state.currentTerm) {
          this.stepDown(response.term);
        } else {
          // Decrement nextIndex and retry
          this.nextIndex.set(nodeId, Math.max(1, nextIdx - 1));
        }
      } catch {
        // Node unreachable
      }
    });

    await Promise.all(replicationPromises);
  }

  private updateCommitIndex(): void {
    const matchIndexes = Array.from(this.matchIndex.values()).sort((a, b) => b - a);
    const majority = Math.floor(this.nodes.size / 2);

    if (matchIndexes.length > majority) {
      const newCommitIndex = matchIndexes[majority]!;
      if (
        newCommitIndex > this.state.commitIndex &&
        this.state.log[newCommitIndex - 1]?.term === this.state.currentTerm
      ) {
        this.state.commitIndex = newCommitIndex;
        this.applyEntries();
      }
    }
  }

  private applyEntries(): void {
    while (this.state.lastApplied < this.state.commitIndex) {
      this.state.lastApplied++;
      const entry = this.state.log[this.state.lastApplied - 1];
      if (entry && this.onApply) {
        this.onApply(entry);
      }
    }
  }

  private stepDown(term: number): void {
    this.state.currentTerm = term;
    this.state.role = 'follower';
    this.state.votedFor = null;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.resetElectionTimer();
  }

  private isLogUpToDate(lastLogIndex: number, lastLogTerm: number): boolean {
    const myLastIndex = this.state.log.length;
    const myLastTerm = this.state.log[myLastIndex - 1]?.term ?? 0;

    if (lastLogTerm !== myLastTerm) {
      return lastLogTerm > myLastTerm;
    }
    return lastLogIndex >= myLastIndex;
  }
}

/**
 * RequestVote request
 */
export interface RequestVoteRequest {
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

/**
 * RequestVote response
 */
export interface RequestVoteResponse {
  term: number;
  voteGranted: boolean;
}

/**
 * AppendEntries request
 */
export interface AppendEntriesRequest<T> {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry<T>[];
  leaderCommit: number;
}

/**
 * AppendEntries response
 */
export interface AppendEntriesResponse {
  term: number;
  success: boolean;
}

/**
 * Transport interface for Raft RPCs
 */
export interface RaftTransport {
  requestVote(nodeId: string, request: RequestVoteRequest): Promise<RequestVoteResponse>;
  appendEntries<T>(nodeId: string, request: AppendEntriesRequest<T>): Promise<AppendEntriesResponse>;
}

/**
 * Create Raft consensus instance
 */
export function createRaftConsensus<T>(config: ClusterConfig): RaftConsensus<T> {
  return new RaftConsensus<T>(config);
}
