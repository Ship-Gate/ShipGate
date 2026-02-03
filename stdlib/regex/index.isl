# Regex Standard Library Module
# Provides safe regex pattern matching operations
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC
# Patterns are limited to safe subsets (no catastrophic backtracking)

module Regex version "1.0.0"

# ============================================
# Types
# ============================================

type RegexPattern = String {
  description: "Regular expression pattern"
  max_length: 1000
}

type RegexFlags = String {
  pattern: "^[gimsuy]*$"
  description: "Regex flags: g(lobal), i(gnore case), m(ultiline), s(ingle line), u(nicode), y(sticky)"
}

type MatchResult = enum {
  MATCH
  NO_MATCH
  ERROR
}

# ============================================
# Entities
# ============================================

entity Match {
  value: String           # The matched string
  index: Int { min: 0 }   # Start position in input
  length: Int { min: 0 }  # Length of match
  groups: Map<String, String?>  # Named capture groups
  captures: List<String?>       # Indexed capture groups
  
  invariants {
    length == value.length
  }
}

entity MatchAllResult {
  matches: List<Match>
  count: Int { min: 0 }
  
  invariants {
    count == matches.length
  }
}

entity ReplaceResult {
  value: String
  replacements_made: Int { min: 0 }
}

entity SplitResult {
  parts: List<String>
  count: Int { min: 0 }
  
  invariants {
    count == parts.length
    count >= 1
  }
}

entity PatternInfo {
  pattern: RegexPattern
  flags: RegexFlags
  is_valid: Boolean
  has_captures: Boolean
  named_groups: List<String>
  estimated_complexity: String  # "low", "medium", "high"
}

entity ValidationError {
  message: String
  position: Int?
  pattern_fragment: String?
}

# ============================================
# Behaviors - Basic Matching
# ============================================

behavior Test {
  description: "Test if pattern matches anywhere in string (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    flags: RegexFlags [default: ""]
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

behavior Match {
  description: "Find first match of pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    flags: RegexFlags [default: ""]
  }

  output {
    success: Match?

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }

  post success {
    result == null or result.index >= 0
    result == null or result.index + result.length <= input.value.length
  }
}

behavior MatchAll {
  description: "Find all matches of pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    flags: RegexFlags [default: "g"]
  }

  output {
    success: MatchAllResult

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }

  post success {
    result.count >= 0
  }
}

behavior Exec {
  description: "Execute pattern and return detailed match (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    flags: RegexFlags [default: ""]
    start_index: Int [default: 0]
  }

  output {
    success: Match?

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }

  pre {
    start_index >= 0
    start_index <= value.length
  }
}

# ============================================
# Behaviors - Capture Groups
# ============================================

behavior Groups {
  description: "Extract named capture groups from match (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    flags: RegexFlags [default: ""]
  }

  output {
    success: Map<String, String?>

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
      NO_MATCH {
        when: "Pattern did not match"
        retriable: false
      }
    }
  }
}

behavior Captures {
  description: "Extract indexed capture groups from match (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    flags: RegexFlags [default: ""]
  }

  output {
    success: List<String?>

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
      NO_MATCH {
        when: "Pattern did not match"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Replacement
# ============================================

behavior Replace {
  description: "Replace first occurrence of pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    replacement: String
    flags: RegexFlags [default: ""]
  }

  output {
    success: ReplaceResult

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
      INVALID_REPLACEMENT {
        when: "Replacement string has invalid backreferences"
        retriable: false
      }
    }
  }

  post success {
    result.replacements_made <= 1
  }
}

behavior ReplaceAll {
  description: "Replace all occurrences of pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    replacement: String
    flags: RegexFlags [default: "g"]
  }

  output {
    success: ReplaceResult

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
      INVALID_REPLACEMENT {
        when: "Replacement string has invalid backreferences"
        retriable: false
      }
    }
  }

  post success {
    result.replacements_made >= 0
  }
}

behavior ReplaceWithFunction {
  description: "Replace with function callback (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    replacer: Function<Match, String>
    flags: RegexFlags [default: "g"]
  }

  output {
    success: ReplaceResult

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Splitting
# ============================================

behavior Split {
  description: "Split string by pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    limit: Int?
    flags: RegexFlags [default: ""]
  }

  output {
    success: SplitResult

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }

  pre {
    limit == null or limit > 0
  }

  post success {
    result.count >= 1
    input.limit != null implies result.count <= input.limit
  }
}

# ============================================
# Behaviors - Pattern Utilities
# ============================================

behavior Escape {
  description: "Escape string for literal pattern matching (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: RegexPattern
  }

  post success {
    # All special characters are escaped
    Test(input.value, result) == true
  }
}

behavior IsValidPattern {
  description: "Check if pattern is valid regex (DETERMINISTIC)"
  deterministic: true

  input {
    pattern: String
    flags: RegexFlags [default: ""]
  }

  output {
    success: Boolean
  }
}

behavior ValidatePattern {
  description: "Validate pattern and return detailed info (DETERMINISTIC)"
  deterministic: true

  input {
    pattern: String
    flags: RegexFlags [default: ""]
  }

  output {
    success: {
      valid: Boolean
      error: ValidationError?
      info: PatternInfo?
    }
  }

  post success {
    result.valid implies result.info != null
    not result.valid implies result.error != null
  }
}

behavior GetPatternInfo {
  description: "Get information about a pattern (DETERMINISTIC)"
  deterministic: true

  input {
    pattern: RegexPattern
    flags: RegexFlags [default: ""]
  }

  output {
    success: PatternInfo

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Safe Pattern Construction
# ============================================

behavior JoinPatterns {
  description: "Join multiple patterns with alternation (DETERMINISTIC)"
  deterministic: true

  input {
    patterns: List<RegexPattern>
    wrap_groups: Boolean [default: true]
  }

  output {
    success: RegexPattern
  }

  pre {
    patterns.length > 0
  }
}

behavior WrapGroup {
  description: "Wrap pattern in non-capturing group (DETERMINISTIC)"
  deterministic: true

  input {
    pattern: RegexPattern
    capture: Boolean [default: false]
    name: String?
  }

  output {
    success: RegexPattern
  }

  pre {
    capture == false or name != null implies capture == true
  }
}

behavior Quantify {
  description: "Add quantifier to pattern (DETERMINISTIC)"
  deterministic: true

  input {
    pattern: RegexPattern
    min: Int { min: 0 }
    max: Int?
    lazy: Boolean [default: false]
  }

  output {
    success: RegexPattern
  }

  pre {
    max == null or max >= min
  }
}

# ============================================
# Behaviors - Common Patterns
# ============================================

behavior MatchEmail {
  description: "Match email address pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    strict: Boolean [default: false]
  }

  output {
    success: Match?
  }
}

behavior MatchUrl {
  description: "Match URL pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    require_protocol: Boolean [default: true]
  }

  output {
    success: Match?
  }
}

behavior MatchPhone {
  description: "Match phone number pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    format: String [default: "e164"]  # "e164", "us", "international"
  }

  output {
    success: Match?
  }
}

behavior MatchUuid {
  description: "Match UUID pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    version: Int?  # null for any version
  }

  output {
    success: Match?
  }

  pre {
    version == null or version in [1, 3, 4, 5, 7]
  }
}

behavior MatchIpAddress {
  description: "Match IP address pattern (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    version: Int [default: 4]  # 4 or 6
  }

  output {
    success: Match?
  }

  pre {
    version in [4, 6]
  }
}

# ============================================
# Behaviors - Extraction Helpers
# ============================================

behavior ExtractAll {
  description: "Extract all matches as simple strings (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    group: Int [default: 0]  # 0 for full match
  }

  output {
    success: List<String>

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
      INVALID_GROUP {
        when: "Capture group does not exist"
        retriable: false
      }
    }
  }
}

behavior ExtractNamed {
  description: "Extract named group from all matches (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    pattern: RegexPattern
    group_name: String
  }

  output {
    success: List<String>

    errors {
      INVALID_PATTERN {
        when: "Regex pattern is invalid"
        retriable: false
      }
      GROUP_NOT_FOUND {
        when: "Named group does not exist in pattern"
        retriable: false
      }
    }
  }
}

# ============================================
# Constants - Common Patterns
# ============================================

const PATTERN_EMAIL: RegexPattern = "[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
const PATTERN_URL: RegexPattern = "https?://[^\\s/$.?#].[^\\s]*"
const PATTERN_UUID: RegexPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const PATTERN_UUID_V4: RegexPattern = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
const PATTERN_IPV4: RegexPattern = "(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"
const PATTERN_PHONE_E164: RegexPattern = "\\+[1-9]\\d{1,14}"
const PATTERN_HEX: RegexPattern = "[0-9a-fA-F]+"
const PATTERN_ALPHA: RegexPattern = "[a-zA-Z]+"
const PATTERN_ALPHANUMERIC: RegexPattern = "[a-zA-Z0-9]+"
const PATTERN_DIGITS: RegexPattern = "\\d+"
const PATTERN_WHITESPACE: RegexPattern = "\\s+"
const PATTERN_WORD: RegexPattern = "\\w+"
const PATTERN_SLUG: RegexPattern = "[a-z0-9]+(?:-[a-z0-9]+)*"
