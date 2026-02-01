// ============================================================================
// ISL Standard Library - Distributed Consensus
// @isl-lang/stdlib-distributed/consensus
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export type NodeId = string;

export interface ConsensusConfig {
  electionTimeoutMin: number;
  electionTimeoutMax: number;
  heartbeatInterval: number;
  maxLogEntries: number;
  snapshotThreshold: number;
}

export type NodeState = 'follower' | 'candidate' | 'leader';

export interface LogEntry<V> {
  index: number;
  term: number;
  command: V;
}

export interface ConsensusState<V> {
  // Persistent state
  currentTerm: number;
  votedFor: NodeId | null;
  log: LogEntry<V>[];
  
  // Volatile state (all nodes)
  commitIndex: number;
  lastApplied: number;
  
  // Volatile state (leaders)
  nextIndex: Map<NodeId, number>;
  matchIndex: Map<NodeId, number>;
}

// ============================================================================
// RAFT CONSENSUS
// ============================================================================

export class RaftNode<V> {
  private nodeId: NodeId;
  private config: ConsensusConfig;
  private state: ConsensusState<V>;
  private nodeState: NodeState;
  private peers: NodeId[];
  private electionTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private onApply: (command: V) => void;

  constructor(
    nodeId: NodeId,
    peers: NodeId[],
    config: Partial<ConsensusConfig>,
    onApply: (command: V) => void
  ) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.onApply = onApply;
    this.config = {
      electionTimeoutMin: config.electionTimeoutMin ?? 150,
      electionTimeoutMax: config.electionTimeoutMax ?? 300,
      heartbeatInterval: config.heartbeatInterval ?? 50,
      maxLogEntries: config.maxLogEntries ?? 10000,
      snapshotThreshold: config.snapshotThreshold ?? 1000,
    };

    this.state = {
      currentTerm: 0,
      votedFor: null,
      log: [],
      commitIndex: 0,
      lastApplied: 0,
      nextIndex: new Map(),
      matchIndex: new Map(),
    };

    this.nodeState = 'follower';
  }

  /**
   * Start the Raft node.
   */
  start(): void {
    this.resetElectionTimer();
  }

  /**
   * Stop the Raft node.
   */
  stop(): void {
    if (this.electionTimer) clearTimeout(this.electionTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  /**
   * Propose a value to the consensus group.
   */
  async propose(command: V): Promise<ProposalResult<V>> {
    if (this.nodeState !== 'leader') {
      return {
        success: false,
        error: 'not_leader',
        leaderId: this.state.votedFor,
      };
    }

    const entry: LogEntry<V> = {
      index: this.state.log.length + 1,
      term: this.state.currentTerm,
      command,
    };

    this.state.log.push(entry);

    // Replicate to followers
    const replicated = await this.replicateToFollowers();

    if (replicated) {
      return {
        success: true,
        index: entry.index,
        term: entry.term,
      };
    }

    return {
      success: false,
      error: 'replication_failed',
    };
  }

  /**
   * Handle RequestVote RPC.
   */
  handleRequestVote(request: RequestVoteRequest): RequestVoteResponse {
    // Update term if necessary
    if (request.term > this.state.currentTerm) {
      this.state.currentTerm = request.term;
      this.state.votedFor = null;
      this.becomeFollower();
    }

    // Check if we can grant vote
    const canVote =
      request.term >= this.state.currentTerm &&
      (this.state.votedFor === null || this.state.votedFor === request.candidateId) &&
      this.isLogUpToDate(request.lastLogIndex, request.lastLogTerm);

    if (canVote) {
      this.state.votedFor = request.candidateId;
      this.resetElectionTimer();
    }

    return {
      term: this.state.currentTerm,
      voteGranted: canVote,
    };
  }

  /**
   * Handle AppendEntries RPC.
   */
  handleAppendEntries(request: AppendEntriesRequest<V>): AppendEntriesResponse {
    // Update term if necessary
    if (request.term > this.state.currentTerm) {
      this.state.currentTerm = request.term;
      this.state.votedFor = null;
      this.becomeFollower();
    }

    // Reject if term is old
    if (request.term < this.state.currentTerm) {
      return { term: this.state.currentTerm, success: false };
    }

    // Valid leader - reset election timer
    this.resetElectionTimer();

    // Check log consistency
    if (request.prevLogIndex > 0) {
      const prevEntry = this.state.log[request.prevLogIndex - 1];
      if (!prevEntry || prevEntry.term !== request.prevLogTerm) {
        return { term: this.state.currentTerm, success: false };
      }
    }

    // Append new entries
    let index = request.prevLogIndex;
    for (const entry of request.entries) {
      index++;
      if (index <= this.state.log.length) {
        if (this.state.log[index - 1].term !== entry.term) {
          // Conflict - remove this and all following entries
          this.state.log = this.state.log.slice(0, index - 1);
          this.state.log.push(entry);
        }
      } else {
        this.state.log.push(entry);
      }
    }

    // Update commit index
    if (request.leaderCommit > this.state.commitIndex) {
      this.state.commitIndex = Math.min(
        request.leaderCommit,
        this.state.log.length
      );
      this.applyCommittedEntries();
    }

    return { term: this.state.currentTerm, success: true };
  }

  /**
   * Get current node state.
   */
  getNodeState(): NodeState {
    return this.nodeState;
  }

  /**
   * Get current term.
   */
  getCurrentTerm(): number {
    return this.state.currentTerm;
  }

  /**
   * Check if this node is the leader.
   */
  isLeader(): boolean {
    return this.nodeState === 'leader';
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private resetElectionTimer(): void {
    if (this.electionTimer) clearTimeout(this.electionTimer);

    const timeout =
      this.config.electionTimeoutMin +
      Math.random() * (this.config.electionTimeoutMax - this.config.electionTimeoutMin);

    this.electionTimer = setTimeout(() => this.startElection(), timeout);
  }

  private startElection(): void {
    this.nodeState = 'candidate';
    this.state.currentTerm++;
    this.state.votedFor = this.nodeId;

    let votesReceived = 1; // Vote for self
    const votesNeeded = Math.floor((this.peers.length + 1) / 2) + 1;

    const lastLogIndex = this.state.log.length;
    const lastLogTerm = lastLogIndex > 0 ? this.state.log[lastLogIndex - 1].term : 0;

    // Request votes from all peers
    for (const peer of this.peers) {
      // In a real implementation, this would be an RPC
      // For now, we simulate with a simple callback pattern
      this.sendRequestVote(peer, {
        term: this.state.currentTerm,
        candidateId: this.nodeId,
        lastLogIndex,
        lastLogTerm,
      }).then((response) => {
        if (response.term > this.state.currentTerm) {
          this.state.currentTerm = response.term;
          this.becomeFollower();
          return;
        }

        if (response.voteGranted && this.nodeState === 'candidate') {
          votesReceived++;
          if (votesReceived >= votesNeeded) {
            this.becomeLeader();
          }
        }
      });
    }

    this.resetElectionTimer();
  }

  private becomeFollower(): void {
    this.nodeState = 'follower';
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.resetElectionTimer();
  }

  private becomeLeader(): void {
    this.nodeState = 'leader';
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = undefined;
    }

    // Initialize leader state
    const nextIndex = this.state.log.length + 1;
    for (const peer of this.peers) {
      this.state.nextIndex.set(peer, nextIndex);
      this.state.matchIndex.set(peer, 0);
    }

    // Start sending heartbeats
    this.sendHeartbeats();
    this.heartbeatTimer = setInterval(
      () => this.sendHeartbeats(),
      this.config.heartbeatInterval
    );
  }

  private sendHeartbeats(): void {
    for (const peer of this.peers) {
      const nextIndex = this.state.nextIndex.get(peer) ?? 1;
      const prevLogIndex = nextIndex - 1;
      const prevLogTerm =
        prevLogIndex > 0 ? this.state.log[prevLogIndex - 1]?.term ?? 0 : 0;

      const entries = this.state.log.slice(nextIndex - 1);

      this.sendAppendEntries(peer, {
        term: this.state.currentTerm,
        leaderId: this.nodeId,
        prevLogIndex,
        prevLogTerm,
        entries,
        leaderCommit: this.state.commitIndex,
      }).then((response) => {
        if (response.term > this.state.currentTerm) {
          this.state.currentTerm = response.term;
          this.becomeFollower();
          return;
        }

        if (response.success) {
          this.state.nextIndex.set(peer, nextIndex + entries.length);
          this.state.matchIndex.set(peer, nextIndex + entries.length - 1);
          this.updateCommitIndex();
        } else {
          // Decrement nextIndex and retry
          this.state.nextIndex.set(peer, Math.max(1, nextIndex - 1));
        }
      });
    }
  }

  private async replicateToFollowers(): Promise<boolean> {
    // In a real implementation, this would wait for majority acknowledgment
    // For simplicity, we just send heartbeats
    this.sendHeartbeats();
    return true;
  }

  private updateCommitIndex(): void {
    for (let n = this.state.log.length; n > this.state.commitIndex; n--) {
      if (this.state.log[n - 1].term !== this.state.currentTerm) continue;

      let matchCount = 1; // Count self
      for (const peer of this.peers) {
        if ((this.state.matchIndex.get(peer) ?? 0) >= n) {
          matchCount++;
        }
      }

      if (matchCount > (this.peers.length + 1) / 2) {
        this.state.commitIndex = n;
        this.applyCommittedEntries();
        break;
      }
    }
  }

  private applyCommittedEntries(): void {
    while (this.state.lastApplied < this.state.commitIndex) {
      this.state.lastApplied++;
      const entry = this.state.log[this.state.lastApplied - 1];
      this.onApply(entry.command);
    }
  }

  private isLogUpToDate(lastLogIndex: number, lastLogTerm: number): boolean {
    const myLastIndex = this.state.log.length;
    const myLastTerm = myLastIndex > 0 ? this.state.log[myLastIndex - 1].term : 0;

    if (lastLogTerm !== myLastTerm) {
      return lastLogTerm > myLastTerm;
    }
    return lastLogIndex >= myLastIndex;
  }

  // Stub RPC methods - in real implementation these would be network calls
  private async sendRequestVote(
    _peer: NodeId,
    _request: RequestVoteRequest
  ): Promise<RequestVoteResponse> {
    return { term: this.state.currentTerm, voteGranted: false };
  }

  private async sendAppendEntries(
    _peer: NodeId,
    _request: AppendEntriesRequest<V>
  ): Promise<AppendEntriesResponse> {
    return { term: this.state.currentTerm, success: true };
  }
}

// ============================================================================
// RPC TYPES
// ============================================================================

export interface RequestVoteRequest {
  term: number;
  candidateId: NodeId;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface RequestVoteResponse {
  term: number;
  voteGranted: boolean;
}

export interface AppendEntriesRequest<V> {
  term: number;
  leaderId: NodeId;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry<V>[];
  leaderCommit: number;
}

export interface AppendEntriesResponse {
  term: number;
  success: boolean;
}

export type ProposalResult<V> =
  | { success: true; index: number; term: number }
  | { success: false; error: string; leaderId?: NodeId | null };

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createRaftNode<V>(
  nodeId: NodeId,
  peers: NodeId[],
  config: Partial<ConsensusConfig>,
  onApply: (command: V) => void
): RaftNode<V> {
  return new RaftNode(nodeId, peers, config, onApply);
}
