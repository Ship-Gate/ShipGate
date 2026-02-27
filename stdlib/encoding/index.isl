# Encoding Standard Library Module
# Provides encoding and decoding operations
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC

module Encoding version "1.0.0"

# ============================================
# Types
# ============================================

type Base64String = String {
  pattern: "^[A-Za-z0-9+/]*={0,2}$"
  description: "Standard Base64 encoded string"
}

type Base64UrlString = String {
  pattern: "^[A-Za-z0-9_-]*$"
  description: "URL-safe Base64 encoded string (no padding)"
}

type HexString = String {
  pattern: "^[0-9a-fA-F]*$"
  description: "Hexadecimal encoded string"
}

type UrlEncodedString = String {
  description: "URL-encoded string"
}

type HtmlEncodedString = String {
  description: "HTML entity encoded string"
}

type Encoding = enum {
  UTF8
  UTF16
  ASCII
  LATIN1
  BASE64
  BASE64URL
  HEX
}

# ============================================
# Entities
# ============================================

entity EncodingResult {
  success: Boolean
  value: String?
  error_message: String?
  bytes_processed: Int?
  
  invariants {
    success implies value != null
    not success implies error_message != null
  }
}

entity DecodingResult {
  success: Boolean
  value: String?
  error_message: String?
  error_position: Int?
  
  invariants {
    success implies value != null
    not success implies error_message != null
  }
}

# ============================================
# Behaviors - Base64 Encoding
# ============================================

behavior EncodeBase64 {
  description: "Encode string to Base64 (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Base64String
  }

  post success {
    result.matches("^[A-Za-z0-9+/]*={0,2}$")
    DecodeBase64(result) == input.value
  }
}

behavior DecodeBase64 {
  description: "Decode Base64 string (DETERMINISTIC)"
  deterministic: true

  input {
    value: Base64String
  }

  output {
    success: String

    errors {
      INVALID_BASE64 {
        when: "Input is not valid Base64"
        retriable: false
      }
      INVALID_PADDING {
        when: "Base64 padding is incorrect"
        retriable: false
      }
    }
  }

  pre {
    value.matches("^[A-Za-z0-9+/]*={0,2}$")
  }
}

behavior TryDecodeBase64 {
  description: "Try to decode Base64, returning result object (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: DecodingResult
  }

  post success {
    # Never throws, always returns result
  }
}

behavior EncodeBase64Url {
  description: "Encode string to URL-safe Base64 (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    include_padding: Boolean [default: false]
  }

  output {
    success: Base64UrlString
  }

  post success {
    result.matches("^[A-Za-z0-9_-]*$")
    not result.contains("+")
    not result.contains("/")
  }
}

behavior DecodeBase64Url {
  description: "Decode URL-safe Base64 string (DETERMINISTIC)"
  deterministic: true

  input {
    value: Base64UrlString
  }

  output {
    success: String

    errors {
      INVALID_BASE64URL {
        when: "Input is not valid URL-safe Base64"
        retriable: false
      }
    }
  }

  pre {
    value.matches("^[A-Za-z0-9_-]*$")
  }
}

behavior IsValidBase64 {
  description: "Check if string is valid Base64 (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == value.matches("^[A-Za-z0-9+/]*={0,2}$")
  }
}

behavior IsValidBase64Url {
  description: "Check if string is valid URL-safe Base64 (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == value.matches("^[A-Za-z0-9_-]*$")
  }
}

# ============================================
# Behaviors - URL Encoding
# ============================================

behavior EncodeUrl {
  description: "URL-encode a string (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: UrlEncodedString
  }

  post success {
    DecodeUrl(result) == input.value
  }
}

behavior DecodeUrl {
  description: "URL-decode a string (DETERMINISTIC)"
  deterministic: true

  input {
    value: UrlEncodedString
  }

  output {
    success: String

    errors {
      INVALID_ENCODING {
        when: "Input contains invalid URL encoding"
        retriable: false
      }
      INCOMPLETE_ESCAPE {
        when: "Incomplete percent-escape sequence"
        retriable: false
      }
    }
  }
}

behavior TryDecodeUrl {
  description: "Try to URL-decode, returning result object (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: DecodingResult
  }
}

behavior EncodeUrlComponent {
  description: "Encode URL component (stricter than EncodeUrl) (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: UrlEncodedString
  }

  post success {
    # Encodes more characters than EncodeUrl
    not result.contains("!")
    not result.contains("'")
    not result.contains("(")
    not result.contains(")")
    not result.contains("*")
  }
}

behavior DecodeUrlComponent {
  description: "Decode URL component (DETERMINISTIC)"
  deterministic: true

  input {
    value: UrlEncodedString
  }

  output {
    success: String

    errors {
      INVALID_ENCODING {
        when: "Input contains invalid URL encoding"
        retriable: false
      }
    }
  }
}

behavior BuildQueryString {
  description: "Build URL query string from parameters (DETERMINISTIC)"
  deterministic: true

  input {
    params: Map<String, String | List<String>>
    encode: Boolean [default: true]
  }

  output {
    success: String
  }

  post success {
    input.params.length == 0 implies result == ""
  }
}

behavior ParseQueryString {
  description: "Parse URL query string to parameters (DETERMINISTIC)"
  deterministic: true

  input {
    query: String
    decode: Boolean [default: true]
  }

  output {
    success: Map<String, String | List<String>>
  }
}

# ============================================
# Behaviors - HTML Encoding
# ============================================

behavior EscapeHtml {
  description: "Escape HTML special characters (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: HtmlEncodedString
  }

  post success {
    not result.contains("<") or input.value.contains("&lt;")
    not result.contains(">") or input.value.contains("&gt;")
    not result.contains("&") or result.contains("&amp;") or result.contains("&#")
    not result.contains("\"") or result.contains("&quot;")
    not result.contains("'") or result.contains("&#39;")
  }
}

behavior UnescapeHtml {
  description: "Unescape HTML entities (DETERMINISTIC)"
  deterministic: true

  input {
    value: HtmlEncodedString
  }

  output {
    success: String

    errors {
      INVALID_ENTITY {
        when: "Invalid HTML entity encountered"
        retriable: false
      }
    }
  }
}

behavior EscapeHtmlAttribute {
  description: "Escape string for use in HTML attribute (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: HtmlEncodedString
  }

  post success {
    # More aggressive escaping for attributes
    not result.contains("\"")
    not result.contains("'")
    not result.contains("<")
    not result.contains(">")
  }
}

# ============================================
# Behaviors - Hex Encoding
# ============================================

behavior EncodeHex {
  description: "Encode string/bytes to hexadecimal (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    uppercase: Boolean [default: false]
  }

  output {
    success: HexString
  }

  post success {
    result.length == input.value.length * 2
    input.uppercase implies result.matches("^[0-9A-F]*$")
    not input.uppercase implies result.matches("^[0-9a-f]*$")
  }
}

behavior DecodeHex {
  description: "Decode hexadecimal string to bytes (DETERMINISTIC)"
  deterministic: true

  input {
    value: HexString
  }

  output {
    success: String

    errors {
      INVALID_HEX {
        when: "Input is not valid hexadecimal"
        retriable: false
      }
      ODD_LENGTH {
        when: "Hex string has odd length"
        retriable: false
      }
    }
  }

  pre {
    value.matches("^[0-9a-fA-F]*$")
    value.length % 2 == 0
  }

  post success {
    result.length == input.value.length / 2
  }
}

behavior IsValidHex {
  description: "Check if string is valid hexadecimal (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == (value.matches("^[0-9a-fA-F]*$") and value.length % 2 == 0)
  }
}

# ============================================
# Behaviors - Unicode/UTF Encoding
# ============================================

behavior EncodeUtf8 {
  description: "Encode string to UTF-8 byte representation (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: HexString  # Hex-encoded bytes
  }
}

behavior DecodeUtf8 {
  description: "Decode UTF-8 bytes to string (DETERMINISTIC)"
  deterministic: true

  input {
    bytes: HexString
  }

  output {
    success: String

    errors {
      INVALID_UTF8 {
        when: "Invalid UTF-8 byte sequence"
        retriable: false
      }
      INCOMPLETE_SEQUENCE {
        when: "Incomplete UTF-8 byte sequence"
        retriable: false
      }
    }
  }
}

behavior GetByteLength {
  description: "Get UTF-8 byte length of string (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Int { min: 0 }
  }

  post success {
    result >= input.value.length
  }
}

behavior StringToCodePoints {
  description: "Convert string to Unicode code points (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: List<Int>
  }

  post success {
    forall cp in result: cp >= 0
  }
}

behavior CodePointsToString {
  description: "Convert Unicode code points to string (DETERMINISTIC)"
  deterministic: true

  input {
    code_points: List<Int>
  }

  output {
    success: String

    errors {
      INVALID_CODE_POINT {
        when: "Invalid Unicode code point"
        retriable: false
      }
    }
  }

  pre {
    forall cp in code_points: cp >= 0 and cp <= 1114111
  }
}

# ============================================
# Behaviors - JSON String Encoding
# ============================================

behavior EscapeJsonString {
  description: "Escape string for use in JSON (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    not result.contains("\"") or result.contains("\\\"")
    not result.contains("\\n") or result.contains("\\\\n") or result.contains("\\n")
  }
}

behavior UnescapeJsonString {
  description: "Unescape JSON string escapes (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String

    errors {
      INVALID_ESCAPE {
        when: "Invalid escape sequence"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Utility
# ============================================

behavior Convert {
  description: "Convert between encodings (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    from_encoding: Encoding
    to_encoding: Encoding
  }

  output {
    success: String

    errors {
      UNSUPPORTED_CONVERSION {
        when: "Conversion between these encodings not supported"
        retriable: false
      }
      INVALID_INPUT {
        when: "Input is not valid in source encoding"
        retriable: false
      }
    }
  }
}

behavior DetectEncoding {
  description: "Detect likely encoding of byte sequence (DETERMINISTIC)"
  deterministic: true

  input {
    bytes: HexString
  }

  output {
    success: {
      encoding: Encoding
      confidence: Number { min: 0, max: 1 }
    }
  }
}

# ============================================
# Constants
# ============================================

const BASE64_ALPHABET: String = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const BASE64URL_ALPHABET: String = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
const HEX_ALPHABET_LOWER: String = "0123456789abcdef"
const HEX_ALPHABET_UPPER: String = "0123456789ABCDEF"
