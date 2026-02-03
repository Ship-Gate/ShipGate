# String Standard Library Module
# Provides string manipulation and validation operations
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC

module String version "1.0.0"

# ============================================
# Types
# ============================================

type StringCase = enum {
  LOWER
  UPPER
  TITLE
  SENTENCE
  CAMEL
  PASCAL
  SNAKE
  KEBAB
}

type TrimMode = enum {
  BOTH       # Trim both ends
  START      # Trim start only
  END        # Trim end only
}

type EmailFormat = String {
  format: "email"
  max_length: 254
}

type UrlFormat = String {
  format: "uri"
  max_length: 2048
}

type PhoneFormat = String {
  pattern: "^\\+?[1-9]\\d{1,14}$"
  description: "E.164 phone number format"
}

# ============================================
# Entities
# ============================================

entity StringValidationResult {
  is_valid: Boolean
  error_message: String?
  position: Int?  # Position of first error, if any
}

entity SplitResult {
  parts: List<String>
  count: Int

  invariants {
    count == parts.length
    count >= 1
  }
}

# ============================================
# Behaviors - Length Operations
# ============================================

behavior Length {
  description: "Get the length of a string (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Int { min: 0 }
  }

  post success {
    result >= 0
  }
}

behavior IsEmpty {
  description: "Check if string is empty (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.value.length == 0)
  }
}

behavior IsBlank {
  description: "Check if string is empty or whitespace only (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == (Trim(input.value).length == 0)
  }
}

# ============================================
# Behaviors - Case Operations
# ============================================

behavior ToLowerCase {
  description: "Convert string to lowercase (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length == input.value.length
    result.matches("^[^A-Z]*$")
  }
}

behavior ToUpperCase {
  description: "Convert string to uppercase (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length == input.value.length
    result.matches("^[^a-z]*$")
  }
}

behavior ToTitleCase {
  description: "Convert string to title case (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length == input.value.length
  }
}

behavior ToCamelCase {
  description: "Convert string to camelCase (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }
}

behavior ToPascalCase {
  description: "Convert string to PascalCase (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }
}

behavior ToSnakeCase {
  description: "Convert string to snake_case (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }
}

behavior ToKebabCase {
  description: "Convert string to kebab-case (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }
}

behavior ChangeCase {
  description: "Convert string to specified case (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    case: StringCase
  }

  output {
    success: String
  }

  post success {
    input.case == LOWER implies result == ToLowerCase(input.value)
    input.case == UPPER implies result == ToUpperCase(input.value)
  }
}

# ============================================
# Behaviors - Trim Operations
# ============================================

behavior Trim {
  description: "Remove whitespace from both ends (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length <= input.value.length
    not result.starts_with(" ")
    not result.ends_with(" ")
  }
}

behavior TrimStart {
  description: "Remove whitespace from start (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length <= input.value.length
    not result.starts_with(" ")
  }
}

behavior TrimEnd {
  description: "Remove whitespace from end (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length <= input.value.length
    not result.ends_with(" ")
  }
}

behavior TrimChars {
  description: "Remove specified characters from both ends (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    chars: String
  }

  output {
    success: String
  }

  post success {
    result.length <= input.value.length
  }
}

# ============================================
# Behaviors - Search Operations
# ============================================

behavior Contains {
  description: "Check if string contains substring (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    substring: String
    case_sensitive: Boolean [default: true]
  }

  output {
    success: Boolean
  }
}

behavior StartsWith {
  description: "Check if string starts with prefix (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    prefix: String
    case_sensitive: Boolean [default: true]
  }

  output {
    success: Boolean
  }

  post success {
    input.case_sensitive implies result == input.value.substring(0, input.prefix.length) == input.prefix
  }
}

behavior EndsWith {
  description: "Check if string ends with suffix (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    suffix: String
    case_sensitive: Boolean [default: true]
  }

  output {
    success: Boolean
  }
}

behavior IndexOf {
  description: "Find first occurrence of substring (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    substring: String
    start_index: Int [default: 0]
    case_sensitive: Boolean [default: true]
  }

  output {
    success: Int  # -1 if not found

    errors {
      INVALID_START_INDEX {
        when: "Start index is out of bounds"
        retriable: false
      }
    }
  }

  pre {
    start_index >= 0
    start_index <= value.length
  }

  post success {
    result >= -1
    result < input.value.length
  }
}

behavior LastIndexOf {
  description: "Find last occurrence of substring (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    substring: String
    case_sensitive: Boolean [default: true]
  }

  output {
    success: Int  # -1 if not found
  }

  post success {
    result >= -1
    result < input.value.length
  }
}

# ============================================
# Behaviors - Manipulation Operations
# ============================================

behavior Substring {
  description: "Extract a portion of string (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    start: Int { min: 0 }
    length: Int?
  }

  output {
    success: String

    errors {
      INDEX_OUT_OF_BOUNDS {
        when: "Start index exceeds string length"
        retriable: false
      }
    }
  }

  pre {
    start >= 0
    start <= value.length
    length == null or length >= 0
  }

  post success {
    result.length <= input.value.length - input.start
    input.length != null implies result.length == min(input.length, input.value.length - input.start)
  }
}

behavior Slice {
  description: "Extract portion with start and end indices (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    start: Int
    end: Int?
  }

  output {
    success: String
  }
}

behavior Replace {
  description: "Replace first occurrence of substring (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    search: String
    replacement: String
  }

  output {
    success: String
  }

  pre {
    search.length > 0
  }
}

behavior ReplaceAll {
  description: "Replace all occurrences of substring (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    search: String
    replacement: String
  }

  output {
    success: String
  }

  pre {
    search.length > 0
  }

  post success {
    not result.contains(input.search) or input.replacement.contains(input.search)
  }
}

behavior Split {
  description: "Split string by delimiter (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    delimiter: String
    limit: Int?  # Maximum number of splits
  }

  output {
    success: SplitResult
  }

  pre {
    delimiter.length > 0
    limit == null or limit > 0
  }

  post success {
    result.count >= 1
    input.limit != null implies result.count <= input.limit
  }
}

behavior Join {
  description: "Join strings with delimiter (DETERMINISTIC)"
  deterministic: true

  input {
    parts: List<String>
    delimiter: String [default: ""]
  }

  output {
    success: String
  }

  post success {
    input.parts.length == 0 implies result == ""
    input.parts.length == 1 implies result == input.parts[0]
  }
}

behavior Concat {
  description: "Concatenate multiple strings (DETERMINISTIC)"
  deterministic: true

  input {
    parts: List<String>
  }

  output {
    success: String
  }

  post success {
    result.length == sum(input.parts.map(p => p.length))
  }
}

behavior Repeat {
  description: "Repeat string n times (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    count: Int { min: 0, max: 10000 }
  }

  output {
    success: String
  }

  post success {
    result.length == input.value.length * input.count
  }
}

behavior PadStart {
  description: "Pad string at start to reach length (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    length: Int { min: 0 }
    fill: String [default: " "]
  }

  output {
    success: String
  }

  pre {
    fill.length > 0
  }

  post success {
    result.length >= input.length
    result.ends_with(input.value)
  }
}

behavior PadEnd {
  description: "Pad string at end to reach length (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    length: Int { min: 0 }
    fill: String [default: " "]
  }

  output {
    success: String
  }

  pre {
    fill.length > 0
  }

  post success {
    result.length >= input.length
    result.starts_with(input.value)
  }
}

behavior Reverse {
  description: "Reverse a string (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: String
  }

  post success {
    result.length == input.value.length
  }
}

behavior CharAt {
  description: "Get character at index (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    index: Int { min: 0 }
  }

  output {
    success: String  # Single character

    errors {
      INDEX_OUT_OF_BOUNDS {
        when: "Index exceeds string length"
        retriable: false
      }
    }
  }

  pre {
    index >= 0
    index < value.length
  }

  post success {
    result.length == 1
  }
}

behavior CharCodeAt {
  description: "Get character code at index (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    index: Int { min: 0 }
  }

  output {
    success: Int { min: 0 }

    errors {
      INDEX_OUT_OF_BOUNDS {
        when: "Index exceeds string length"
        retriable: false
      }
    }
  }

  pre {
    index >= 0
    index < value.length
  }
}

behavior FromCharCode {
  description: "Create string from character codes (DETERMINISTIC)"
  deterministic: true

  input {
    codes: List<Int>
  }

  output {
    success: String
  }

  pre {
    forall code in codes: code >= 0
  }

  post success {
    result.length == input.codes.length
  }
}

# ============================================
# Behaviors - Validation Operations
# ============================================

behavior IsValidEmail {
  description: "Validate email format (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.contains("@")
    result implies input.value.length >= 3
    result implies input.value.length <= 254
  }
}

behavior IsValidUrl {
  description: "Validate URL format (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    require_https: Boolean [default: false]
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.contains("://")
    input.require_https and result implies input.value.starts_with("https://")
  }
}

behavior IsValidPhone {
  description: "Validate E.164 phone number format (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.length >= 2
    result implies input.value.length <= 16
  }
}

behavior MatchesPattern {
  description: "Check if string matches regex pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: String
    flags: String [default: ""]
  }

  output {
    success: Boolean

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }
}

behavior IsAlpha {
  description: "Check if string contains only letters (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.matches("^[a-zA-Z]*$")
  }
}

behavior IsAlphanumeric {
  description: "Check if string contains only letters and digits (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.matches("^[a-zA-Z0-9]*$")
  }
}

behavior IsNumeric {
  description: "Check if string contains only digits (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.matches("^[0-9]*$")
  }
}

behavior IsHexadecimal {
  description: "Check if string is valid hexadecimal (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result implies input.value.matches("^[0-9a-fA-F]*$")
  }
}

behavior IsLowerCase {
  description: "Check if string is all lowercase (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.value == ToLowerCase(input.value))
  }
}

behavior IsUpperCase {
  description: "Check if string is all uppercase (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.value == ToUpperCase(input.value))
  }
}

# ============================================
# Constants
# ============================================

const EMPTY: String = ""
const SPACE: String = " "
const NEWLINE: String = "\n"
const TAB: String = "\t"
const CRLF: String = "\r\n"
