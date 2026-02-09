# MevGuard — MEV Protection Service
# Minimal ISL spec for Shipgate. Expand with behaviors/policies as needed.

domain MevGuard {
  version: "1.0.0"

  entity ProtectionResult {
    level: String
    threatDetected: Boolean
    relayStatus: String
  }

  behavior AssessMEVProtection {
    input {}
    output { success: ProtectionResult }
  }
}
