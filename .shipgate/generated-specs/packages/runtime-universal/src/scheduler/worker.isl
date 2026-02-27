# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createWorkerPool, WorkerPoolConfig, WorkerState, WorkerExecutor, WorkerPool, WorkerPoolStats
# dependencies: 

domain Worker {
  version: "1.0.0"

  type WorkerPoolConfig = String
  type WorkerState = String
  type WorkerExecutor = String
  type WorkerPool = String
  type WorkerPoolStats = String

  invariants exports_present {
    - true
  }
}
