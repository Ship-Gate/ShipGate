# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRaftConsensus, RaftConsensus, RequestVoteRequest, RequestVoteResponse, AppendEntriesRequest, AppendEntriesResponse, RaftTransport
# dependencies: 

domain Consensus {
  version: "1.0.0"

  type RaftConsensus = String
  type RequestVoteRequest = String
  type RequestVoteResponse = String
  type AppendEntriesRequest = String
  type AppendEntriesResponse = String
  type RaftTransport = String

  invariants exports_present {
    - true
  }
}
