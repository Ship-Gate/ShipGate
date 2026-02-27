# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRaftNode, NodeId, ConsensusConfig, NodeState, LogEntry, ConsensusState, RaftNode, RequestVoteRequest, RequestVoteResponse, AppendEntriesRequest, AppendEntriesResponse, ProposalResult
# dependencies: 

domain Consensus {
  version: "1.0.0"

  type NodeId = String
  type ConsensusConfig = String
  type NodeState = String
  type LogEntry = String
  type ConsensusState = String
  type RaftNode = String
  type RequestVoteRequest = String
  type RequestVoteResponse = String
  type AppendEntriesRequest = String
  type AppendEntriesResponse = String
  type ProposalResult = String

  invariants exports_present {
    - true
  }
}
