# Validate MIME Module
# Provides MIME type validation behaviors

module ValidateMime version "1.0.0"

# ============================================
# Types
# ============================================

type MimeType = String { max_length: 127 }

type FileCategory = enum {
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  ARCHIVE
  TEXT
  APPLICATION
  UNKNOWN
}

type ValidationResult = enum {
  VALID
  INVALID_MAGIC_BYTES
  MIME_MISMATCH
  EXTENSION_MISMATCH
  POTENTIALLY_DANGEROUS
  UNSUPPORTED
}

# ============================================
# Entities
# ============================================

entity MimeTypeDefinition {
  mime_type: MimeType [unique]
  category: FileCategory
  extensions: List<String>
  magic_bytes: List<String>?  # Hex patterns
  is_dangerous: Boolean [default: false]
  max_allowed_size: Int?  # Bytes
  description: String?
}

entity ValidationLog {
  id: UUID [immutable, unique]
  filename: String
  claimed_mime: MimeType?
  detected_mime: MimeType?
  result: ValidationResult
  details: String?
  ip_address: String?
  user_id: UUID?
  created_at: Timestamp [immutable]
}

# ============================================
# Behaviors
# ============================================

behavior ValidateMimeType {
  description: "Validate file MIME type by magic bytes"

  input {
    data: Bytes { max_size: 8192 }  # Only need header bytes
    claimed_mime: MimeType?
    filename: String?
  }

  output {
    success: {
      detected_mime: MimeType
      category: FileCategory
      is_valid: Boolean
      result: ValidationResult
      confidence: Int { min: 0, max: 100 }
    }

    errors {
      EMPTY_DATA {
        when: "No data provided"
        retriable: false
      }
      DETECTION_FAILED {
        when: "Could not detect MIME type"
        retriable: false
      }
    }
  }

  pre {
    input.data.size > 0
  }

  post success {
    result.detected_mime.length > 0
    result.confidence >= 0
    result.confidence <= 100
    result.is_valid == (result.result == VALID)
  }

  invariants {
    detection based on magic bytes, not extension
    claimed_mime checked against detected
  }

  temporal {
    within 50ms (p99): response returned
  }
}

behavior CheckFileSafety {
  description: "Check if file type is safe for upload"

  input {
    data: Bytes { max_size: 8192 }
    filename: String
    allowed_categories: List<FileCategory>? [default: [IMAGE, DOCUMENT]]
    block_executables: Boolean [default: true]
    block_archives: Boolean [default: false]
  }

  output {
    success: {
      is_safe: Boolean
      detected_mime: MimeType
      category: FileCategory
      risk_level: enum { NONE, LOW, MEDIUM, HIGH, CRITICAL }
      warnings: List<String>
    }

    errors {
      EMPTY_DATA {
        when: "No data provided"
        retriable: false
      }
    }
  }

  pre {
    input.data.size > 0
    filename.length > 0
  }

  post success {
    result.risk_level == CRITICAL implies result.is_safe == false
    input.block_executables and result.category == APPLICATION implies 
      result.is_safe == false
    input.block_archives and result.category == ARCHIVE implies 
      result.is_safe == false
    input.allowed_categories != null and 
      result.category not in input.allowed_categories implies 
      result.is_safe == false
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ValidateImageMime {
  description: "Validate that file is a valid image"

  input {
    data: Bytes { max_size: 8192 }
    allowed_formats: List<String>? [default: ["image/jpeg", "image/png", "image/gif", "image/webp"]]
    max_dimensions: { width: Int, height: Int }?
  }

  output {
    success: {
      is_valid_image: Boolean
      detected_mime: MimeType
      format: String?  # e.g., "JPEG", "PNG"
      dimensions: { width: Int, height: Int }?
    }

    errors {
      NOT_AN_IMAGE {
        when: "File is not an image"
        retriable: false
      }
      FORMAT_NOT_ALLOWED {
        when: "Image format not in allowed list"
        retriable: false
      }
      DIMENSIONS_EXCEEDED {
        when: "Image dimensions exceed maximum"
        retriable: false
      }
      CORRUPTED {
        when: "Image appears corrupted"
        retriable: false
      }
    }
  }

  pre {
    input.data.size > 0
  }

  post success {
    result.is_valid_image == true
    result.detected_mime.starts_with("image/")
    input.allowed_formats != null implies 
      result.detected_mime in input.allowed_formats
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ValidateDocumentMime {
  description: "Validate that file is a valid document"

  input {
    data: Bytes { max_size: 8192 }
    allowed_formats: List<String>? [default: ["application/pdf", "text/plain"]]
  }

  output {
    success: {
      is_valid_document: Boolean
      detected_mime: MimeType
      format: String?
      has_macros: Boolean?  # For Office docs
    }

    errors {
      NOT_A_DOCUMENT {
        when: "File is not a document"
        retriable: false
      }
      FORMAT_NOT_ALLOWED {
        when: "Document format not allowed"
        retriable: false
      }
      MACROS_DETECTED {
        when: "Document contains macros"
        retriable: false
      }
    }
  }

  pre {
    input.data.size > 0
  }

  post success {
    result.is_valid_document == true
    input.allowed_formats != null implies 
      result.detected_mime in input.allowed_formats
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior GetMimeTypeInfo {
  description: "Get information about a MIME type"

  input {
    mime_type: MimeType
  }

  output {
    success: MimeTypeDefinition

    errors {
      UNKNOWN_MIME_TYPE {
        when: "MIME type not recognized"
        retriable: false
      }
    }
  }

  post success {
    result.mime_type == input.mime_type
  }

  temporal {
    within 20ms (p99): response returned
  }
}

behavior DetectMimeFromExtension {
  description: "Detect MIME type from file extension"

  input {
    filename: String
  }

  output {
    success: {
      mime_type: MimeType
      category: FileCategory
      alternatives: List<MimeType>?  # Other possible MIME types
    }

    errors {
      NO_EXTENSION {
        when: "File has no extension"
        retriable: false
      }
      UNKNOWN_EXTENSION {
        when: "Extension not recognized"
        retriable: false
      }
    }
  }

  pre {
    filename.contains(".")
  }

  post success {
    result.mime_type.length > 0
  }

  temporal {
    within 10ms (p99): response returned
  }
}

behavior ValidateMimeConsistency {
  description: "Check consistency between claimed MIME, detected MIME, and extension"

  input {
    data: Bytes { max_size: 8192 }
    filename: String
    claimed_mime: MimeType
  }

  output {
    success: {
      is_consistent: Boolean
      detected_mime: MimeType
      extension_mime: MimeType?
      discrepancies: List<String>
    }

    errors {
      DETECTION_FAILED {
        when: "Could not detect MIME type"
        retriable: false
      }
    }
  }

  pre {
    input.data.size > 0
  }

  post success {
    result.is_consistent implies result.discrepancies.length == 0
    not result.is_consistent implies result.discrepancies.length > 0
  }

  temporal {
    within 50ms (p99): response returned
  }

  security {
    log_discrepancies for security analysis
  }
}
