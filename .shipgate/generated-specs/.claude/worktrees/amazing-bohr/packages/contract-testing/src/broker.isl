# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: BrokerOptions, ContractVersion, ContractQuery, ContractBroker, Contract, ContractDiff, compareContracts
# dependencies: fs, path

domain Broker {
  version: "1.0.0"

  type BrokerOptions = String
  type ContractVersion = String
  type ContractQuery = String
  type ContractBroker = String

  invariants exports_present {
    - true
  }
}
