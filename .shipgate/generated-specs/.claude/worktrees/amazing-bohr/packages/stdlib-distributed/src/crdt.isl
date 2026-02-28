# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createGCounter, incrementGCounter, valueGCounter, mergeGCounter, createPNCounter, incrementPNCounter, decrementPNCounter, valuePNCounter, mergePNCounter, createGSet, addGSet, containsGSet, mergeGSet, createORSet, addORSet, removeORSet, containsORSet, valuesORSet, mergeORSet, createLWWRegister, setLWWRegister, mergeLWWRegister, createMVRegister, setMVRegister, valuesMVRegister, mergeMVRegister, createVectorClock, incrementVectorClock, mergeVectorClocks, compareVectorClocks, createHLC, tickHLC, receiveHLC, NodeId, HybridLogicalClock, VectorClock, GCounter, PNCounter, GSet, ORSet, LWWRegister, MVRegister
# dependencies: 

domain Crdt {
  version: "1.0.0"

  type NodeId = String
  type HybridLogicalClock = String
  type VectorClock = String
  type GCounter = String
  type PNCounter = String
  type GSet = String
  type ORSet = String
  type LWWRegister = String
  type MVRegister = String

  invariants exports_present {
    - true
  }
}
