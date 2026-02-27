# CORS and CSRF Protection Module
# Provides cross-origin security patterns

module SecurityCORS version "1.0.0"

# ============================================
# Types
# ============================================

type CORSMethod = enum {
  GET
  POST
  PUT
  PATCH
  DELETE
  OPTIONS
}

type SameSitePolicy = enum {
  STRICT
  LAX
  NONE
}

type CSRFTokenPlacement = enum {
  HEADER
  COOKIE
  FORM_FIELD
  QUERY_PARAM
}

# ============================================
# Entities
# ============================================

entity CORSConfig {
  allowed_origins: List<String>
  allowed_methods: List<CORSMethod>
  allowed_headers: List<String>
  exposed_headers: List<String>?
  allow_credentials: Boolean [default: false]
  max_age_seconds: Int { min: 0, max: 86400, default: 3600 }
  allow_wildcard: Boolean [default: false]

  invariants {
    allowed_origins.length > 0
    allowed_methods.length > 0
    allow_credentials implies not allow_wildcard
    allow_wildcard implies allowed_origins == ["*"]
  }
}

entity CORSResult {
  allowed: Boolean
  origin: String?
  vary_headers: List<String>
  response_headers: Map<String, String>
}

entity CSRFConfig {
  token_length: Int { min: 32, max: 256, default: 64 }
  token_placement: CSRFTokenPlacement [default: HEADER]
  header_name: String [default: "X-CSRF-Token"]
  cookie_name: String [default: "__csrf"]
  same_site: SameSitePolicy [default: STRICT]
  token_expiry_ms: Int { min: 300000, default: 3600000 }
  double_submit: Boolean [default: true]

  invariants {
    token_length >= 32
    token_expiry_ms >= 300000
  }
}

entity CSRFToken {
  token: String [secret]
  created_at: Timestamp [immutable]
  expires_at: Timestamp
  session_id: String?

  invariants {
    expires_at > created_at
    token.length >= 32
  }
}

# ============================================
# Behaviors
# ============================================

behavior CheckCORS {
  description: "Validate CORS preflight or simple request"
  deterministic: true

  input {
    origin: String
    method: CORSMethod
    request_headers: List<String>?
    config: CORSConfig
  }

  output {
    success: CORSResult
  }

  pre {
    origin.length > 0
  }

  post success {
    result.allowed implies result.origin == input.origin
    not result.allowed implies result.origin == null
    result.vary_headers.length > 0
  }
}

behavior HandlePreflight {
  description: "Handle CORS preflight OPTIONS request"
  deterministic: true

  input {
    origin: String
    method: CORSMethod
    request_headers: List<String>
    config: CORSConfig
  }

  output {
    success: {
      status_code: Int
      headers: Map<String, String>
    }

    errors {
      ORIGIN_NOT_ALLOWED {
        when: "Origin not in allowed list"
        retriable: false
      }
      METHOD_NOT_ALLOWED {
        when: "Request method not permitted"
        retriable: false
      }
      HEADERS_NOT_ALLOWED {
        when: "Requested headers not permitted"
        retriable: false
      }
    }
  }

  post success {
    result.status_code == 204 or result.status_code == 200
    result.headers != null
  }
}

behavior GenerateCSRFToken {
  description: "Generate a new CSRF protection token"

  input {
    config: CSRFConfig
    session_id: String?
  }

  output {
    success: CSRFToken
  }

  post success {
    result.token.length >= input.config.token_length
    result.expires_at > result.created_at
    input.session_id != null implies result.session_id == input.session_id
  }

  invariants {
    uses cryptographically secure random source
  }
}

behavior ValidateCSRFToken {
  description: "Validate a submitted CSRF token"
  deterministic: true

  input {
    token: String
    expected_token: String [secret]
    session_id: String?
    config: CSRFConfig
  }

  output {
    success: {
      valid: Boolean
      reason: String?
    }

    errors {
      TOKEN_MISSING {
        when: "CSRF token not provided"
        retriable: false
      }
      TOKEN_EXPIRED {
        when: "CSRF token has expired"
        retriable: false
      }
      TOKEN_MISMATCH {
        when: "CSRF token does not match"
        retriable: false
      }
      SESSION_MISMATCH {
        when: "Token does not belong to current session"
        retriable: false
      }
    }
  }

  pre {
    token.length > 0
    expected_token.length > 0
  }

  post success {
    result.valid implies result.reason == null
    not result.valid implies result.reason != null
  }

  invariants {
    comparison is constant-time
    token never logged
  }
}
