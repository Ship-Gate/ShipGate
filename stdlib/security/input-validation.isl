# Input Validation Module
# Provides input sanitization and validation patterns

module SecurityInputValidation version "1.0.0"

# ============================================
# Types
# ============================================

type SanitizationMode = enum {
  STRIP_HTML
  ESCAPE_HTML
  STRIP_SCRIPTS
  WHITELIST_TAGS
  NONE
}

type ValidationSeverity = enum {
  ERROR
  WARNING
  INFO
}

type XSSVector = enum {
  SCRIPT_TAG
  EVENT_HANDLER
  JAVASCRIPT_URI
  DATA_URI
  EXPRESSION_CSS
  EMBEDDED_OBJECT
}

type InjectionType = enum {
  SQL
  NOSQL
  LDAP
  XPATH
  COMMAND
  HEADER
  LOG
}

# ============================================
# Entities
# ============================================

entity ValidationError {
  field: String { max_length: 128 }
  message: String { max_length: 512 }
  code: String { max_length: 64 }
  severity: ValidationSeverity [default: ERROR]
  value_snippet: String? { max_length: 100 }

  invariants {
    field.length > 0
    message.length > 0
    code.length > 0
  }
}

entity ValidationResult {
  valid: Boolean
  errors: List<ValidationError>
  warnings: List<ValidationError>
  sanitized_values: Map<String, String>?

  invariants {
    not valid implies errors.length > 0
    valid implies errors.length == 0
  }
}

entity SanitizationConfig {
  mode: SanitizationMode [default: ESCAPE_HTML]
  allowed_tags: List<String>?
  max_length: Int? { min: 1 }
  trim_whitespace: Boolean [default: true]
  normalize_unicode: Boolean [default: true]
  strip_null_bytes: Boolean [default: true]
}

# ============================================
# Behaviors
# ============================================

behavior ValidateInput {
  description: "Validate input data against constraints"
  deterministic: true

  input {
    data: Map<String, String>
    rules: Map<String, String>
  }

  output {
    success: ValidationResult
  }

  pre {
    data != null
    rules != null
  }

  post success {
    result.valid implies result.errors.length == 0
    not result.valid implies result.errors.length > 0
    forall err in result.errors:
      err.field.length > 0
      err.message.length > 0
  }
}

behavior SanitizeString {
  description: "Sanitize a string value to prevent XSS"
  deterministic: true

  input {
    value: String
    config: SanitizationConfig?
  }

  output {
    success: {
      sanitized: String
      was_modified: Boolean
      threats_detected: List<XSSVector>
    }
  }

  post success {
    result.sanitized.length <= input.value.length + 100
    result.was_modified implies result.threats_detected.length > 0
    not result.sanitized.contains("<script")
    not result.sanitized.contains("javascript:")
  }
}

behavior DetectInjection {
  description: "Detect potential injection attacks in input"
  deterministic: true

  input {
    value: String
    check_types: List<InjectionType>?
  }

  output {
    success: {
      safe: Boolean
      detected_types: List<InjectionType>
      risk_score: Decimal { min: 0, max: 1 }
    }
  }

  pre {
    value.length > 0
  }

  post success {
    result.safe implies result.detected_types.length == 0
    not result.safe implies result.detected_types.length > 0
    result.risk_score >= 0 and result.risk_score <= 1
    result.safe implies result.risk_score == 0
  }
}

behavior ValidateEmail {
  description: "Validate email address format and deliverability"
  deterministic: true

  input {
    email: String
    check_mx: Boolean [default: false]
    check_disposable: Boolean [default: false]
  }

  output {
    success: {
      valid: Boolean
      normalized: String?
      is_disposable: Boolean?
      has_mx_record: Boolean?
    }

    errors {
      INVALID_FORMAT {
        when: "Email does not match valid format"
        retriable: false
      }
    }
  }

  pre {
    email.length > 0
    email.length <= 254
  }

  post success {
    result.valid implies result.normalized != null
    result.valid implies result.normalized.contains("@")
    result.normalized != null implies result.normalized.length <= 254
  }
}

behavior ValidateURL {
  description: "Validate URL format and safety"
  deterministic: true

  input {
    url: String
    allowed_schemes: List<String> [default: ["https"]]
    check_ssrf: Boolean [default: true]
  }

  output {
    success: {
      valid: Boolean
      normalized: String?
      scheme: String?
      host: String?
      is_internal: Boolean?
    }

    errors {
      INVALID_FORMAT {
        when: "URL is malformed"
        retriable: false
      }
      BLOCKED_SCHEME {
        when: "URL scheme not in allowed list"
        retriable: false
      }
      SSRF_DETECTED {
        when: "URL points to internal network (SSRF attempt)"
        retriable: false
      }
    }
  }

  pre {
    url.length > 0
    url.length <= 2048
  }

  post success {
    result.valid implies result.normalized != null
    result.valid implies result.scheme in input.allowed_schemes
    input.check_ssrf and result.valid implies result.is_internal == false
  }

  invariants {
    localhost and private IPs blocked when check_ssrf enabled
    data: and javascript: schemes always blocked
  }
}

behavior SanitizeBatch {
  description: "Sanitize multiple input fields at once"
  deterministic: true

  input {
    fields: Map<String, String>
    config: SanitizationConfig?
  }

  output {
    success: {
      sanitized: Map<String, String>
      modified_fields: List<String>
      total_threats: Int
    }
  }

  post success {
    result.total_threats >= 0
    result.modified_fields.length <= input.fields.length
    result.total_threats == 0 implies result.modified_fields.length == 0
  }
}
