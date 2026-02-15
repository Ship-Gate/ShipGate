# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: WorkerSandbox
# dependencies: worker_threads, os, path, fs/promises, fs, util, ${scriptPath}, child_process

domain WorkerSandbox {
  version: "1.0.0"

  type WorkerSandbox = String

  invariants exports_present {
    - true
  }
}
