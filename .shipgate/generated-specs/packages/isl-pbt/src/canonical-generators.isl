# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: userEntity, sessionEntity, accountEntity, transactionEntity, loginBehaviorInput, invalidLoginInput, registerBehaviorInput, transferBehaviorInput, edgeCaseString, edgeCaseNumber, edgeCaseEmail, edgeCaseMoney, edgeCaseArray, edgeCaseInputs, UserEntity, SessionEntity, AccountEntity, TransactionEntity, LoginInput, RegisterInput, TransferInput, EdgeCaseConfig, DEFAULT_EDGE_CASE_CONFIG
# dependencies: 

domain CanonicalGenerators {
  version: "1.0.0"

  type UserEntity = String
  type SessionEntity = String
  type AccountEntity = String
  type TransactionEntity = String
  type LoginInput = String
  type RegisterInput = String
  type TransferInput = String
  type EdgeCaseConfig = String

  invariants exports_present {
    - true
  }
}
