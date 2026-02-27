# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createLockManager, createMutex, LockManager, LockHandle, InMemoryLockManager, LockAcquisitionError, DistributedMutex, ReadWriteLock, DistributedSemaphore
# dependencies: 

domain Lock {
  version: "1.0.0"

  type LockManager = String
  type LockHandle = String
  type InMemoryLockManager = String
  type LockAcquisitionError = String
  type DistributedMutex = String
  type ReadWriteLock = String
  type DistributedSemaphore = String

  invariants exports_present {
    - true
  }
}
