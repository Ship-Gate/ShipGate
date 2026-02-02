// Webhooks: Signature verification
domain WebhooksSignature {
  version: "1.0.0"

  enum SignatureAlgorithm {
    HMAC_SHA256
    HMAC_SHA512
    ED25519
  }

  behavior SignPayload {
    description: "Sign webhook payload"

    actors {
      System { }
    }

    input {
      payload: String
      secret: String [sensitive]
      algorithm: SignatureAlgorithm?
      timestamp: Timestamp?
    }

    output {
      success: {
        signature: String
        timestamp: Int
        algorithm: SignatureAlgorithm
      }
    }

    pre {
      input.payload.length > 0
      input.secret.length >= 32
    }

    post success {
      - result.signature.length > 0
      - result.timestamp > 0
    }

    invariants {
      - signature is deterministic for same inputs
      - uses constant-time comparison internally
    }
  }

  behavior VerifySignature {
    description: "Verify webhook signature"

    actors {
      System { }
    }

    input {
      payload: String
      signature: String
      secret: String [sensitive]
      algorithm: SignatureAlgorithm?
      timestamp: Int?
      tolerance_seconds: Int?
    }

    output {
      success: { valid: Boolean, reason: String? }

      errors {
        INVALID_SIGNATURE_FORMAT {
          when: "Signature format is invalid"
          retriable: false
        }
        TIMESTAMP_TOO_OLD {
          when: "Timestamp is too old"
          retriable: false
        }
        TIMESTAMP_TOO_NEW {
          when: "Timestamp is in future"
          retriable: false
        }
      }
    }

    pre {
      input.payload.length > 0
      input.signature.length > 0
      input.secret.length >= 32
    }

    post success {
      // Valid or invalid determined by signature match
    }

    invariants {
      - uses constant-time comparison
      - timing attack resistant
    }

    temporal {
      - within 1ms (p99): verification complete
    }
  }

  behavior ParseSignatureHeader {
    description: "Parse webhook signature header"

    actors {
      System { }
    }

    input {
      header: String
    }

    output {
      success: {
        timestamp: Int
        signatures: List<String>
        version: String?
      }

      errors {
        INVALID_HEADER {
          when: "Header format is invalid"
          retriable: false
        }
        MISSING_TIMESTAMP {
          when: "Timestamp missing from header"
          retriable: false
        }
        MISSING_SIGNATURE {
          when: "No signatures in header"
          retriable: false
        }
      }
    }

    pre {
      input.header.length > 0
    }

    post success {
      - result.signatures.length > 0
      - result.timestamp > 0
    }
  }

  behavior ConstructSignedPayload {
    description: "Construct payload for signing"

    actors {
      System { }
    }

    input {
      timestamp: Int
      payload: String
    }

    output {
      success: String
    }

    pre {
      input.timestamp > 0
      input.payload.length > 0
    }

    post success {
      - result contains input.timestamp
      - result contains input.payload
    }
  }

  behavior GenerateSigningHeaders {
    description: "Generate all signing headers"

    actors {
      System { }
    }

    input {
      payload: String
      secret: String [sensitive]
      event_id: UUID?
      event_type: String?
    }

    output {
      success: Map<String, String>
    }

    pre {
      input.payload.length > 0
      input.secret.length >= 32
    }

    post success {
      - "X-Webhook-Signature" in result or "Webhook-Signature" in result
      - "X-Webhook-Timestamp" in result or result contains timestamp
    }
  }

  scenarios VerifySignature {
    scenario "valid signature" {
      given {
        payload = "{\"event\": \"test\"}"
        secret = "whsec_1234567890abcdef1234567890abcdef"
        signature = SignPayload(payload, secret)
      }

      when {
        result = VerifySignature(
          payload: payload,
          signature: signature.signature,
          secret: secret,
          timestamp: signature.timestamp
        )
      }

      then {
        result is success
        result.valid == true
      }
    }

    scenario "invalid signature" {
      when {
        result = VerifySignature(
          payload: "{\"event\": \"test\"}",
          signature: "invalid_signature",
          secret: "whsec_1234567890abcdef1234567890abcdef"
        )
      }

      then {
        result is success
        result.valid == false
      }
    }

    scenario "timestamp too old" {
      when {
        result = VerifySignature(
          payload: "{\"event\": \"test\"}",
          signature: "v1=abc123",
          secret: "whsec_1234567890abcdef1234567890abcdef",
          timestamp: 1000000,
          tolerance_seconds: 300
        )
      }

      then {
        result is TIMESTAMP_TOO_OLD
      }
    }
  }
}
