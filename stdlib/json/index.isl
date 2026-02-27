# JSON Standard Library Module
# Provides JSON parsing, serialization, and manipulation
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC

module JSON version "1.0.0"

# ============================================
# Types
# ============================================

type JSONValue = String | Number | Boolean | Null | JSONObject | JSONArray

type JSONObject = Map<String, JSONValue>

type JSONArray = List<JSONValue>

type JSONPath = String {
  description: "JSONPath expression (e.g., $.store.book[0].title)"
  pattern: "^\\$.*"
}

type JSONPointer = String {
  description: "JSON Pointer (RFC 6901, e.g., /store/book/0/title)"
  pattern: "^(/[^/]*)*$"
}

type JSONPatchOp = enum {
  ADD
  REMOVE
  REPLACE
  MOVE
  COPY
  TEST
}

type JSONFormatOptions = enum {
  COMPACT      # No whitespace
  PRETTY       # Indented with newlines
  SORTED_KEYS  # Keys sorted alphabetically
}

# ============================================
# Entities
# ============================================

entity JSONParseResult {
  success: Boolean
  value: JSONValue?
  error_message: String?
  error_position: Int?

  invariants {
    success implies value != null
    not success implies error_message != null
  }
}

entity JSONPatch {
  op: JSONPatchOp
  path: JSONPointer
  value: JSONValue?
  from: JSONPointer?

  invariants {
    op in [ADD, REPLACE, TEST] implies value != null
    op in [MOVE, COPY] implies from != null
  }
}

entity JSONDiff {
  patches: List<JSONPatch>
  
  invariants {
    patches.length >= 0
  }
}

entity JSONSchemaValidation {
  valid: Boolean
  errors: List<String>
  
  invariants {
    valid implies errors.length == 0
  }
}

# ============================================
# Behaviors - Parsing
# ============================================

behavior Parse {
  description: "Parse JSON string to value (DETERMINISTIC)"
  deterministic: true

  input {
    json: String
    strict: Boolean [default: true]
  }

  output {
    success: JSONValue

    errors {
      INVALID_JSON {
        when: "JSON string is malformed"
        retriable: false
      }
      UNEXPECTED_TOKEN {
        when: "Unexpected character in JSON"
        retriable: false
      }
      MAX_DEPTH_EXCEEDED {
        when: "Nesting depth exceeds limit"
        retriable: false
      }
    }
  }

  pre {
    json.length > 0
  }

  post success {
    # Same input always produces same output
    Parse(input.json) == result
  }
}

behavior TryParse {
  description: "Try to parse JSON, returning result object (DETERMINISTIC)"
  deterministic: true

  input {
    json: String
    strict: Boolean [default: true]
  }

  output {
    success: JSONParseResult
  }

  post success {
    # Never throws, always returns result
    result.success or result.error_message != null
  }
}

# ============================================
# Behaviors - Serialization
# ============================================

behavior Stringify {
  description: "Serialize value to JSON string (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
    format: JSONFormatOptions [default: COMPACT]
    indent: Int [default: 2]
  }

  output {
    success: String

    errors {
      CIRCULAR_REFERENCE {
        when: "Value contains circular reference"
        retriable: false
      }
      INVALID_VALUE {
        when: "Value cannot be serialized to JSON"
        retriable: false
      }
    }
  }

  post success {
    result.length > 0
    # Same input always produces same output
    Stringify(input.value, input.format) == result
    # Can be parsed back
    Parse(result) == input.value
  }
}

behavior StringifyPretty {
  description: "Serialize to pretty-printed JSON (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
    indent: Int [default: 2]
  }

  output {
    success: String
  }

  post success {
    result.contains("\n")
  }
}

behavior StringifyCompact {
  description: "Serialize to compact JSON (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: String
  }

  post success {
    not result.contains("\n")
    not result.contains("  ")
  }
}

# ============================================
# Behaviors - Access
# ============================================

behavior Get {
  description: "Get value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
    default_value: JSONValue?
  }

  output {
    success: JSONValue?
  }

  post success {
    # Returns default if path not found
  }
}

behavior GetString {
  description: "Get string value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
    default_value: String?
  }

  output {
    success: String?

    errors {
      TYPE_MISMATCH {
        when: "Value at path is not a string"
        retriable: false
      }
    }
  }
}

behavior GetNumber {
  description: "Get number value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
    default_value: Number?
  }

  output {
    success: Number?

    errors {
      TYPE_MISMATCH {
        when: "Value at path is not a number"
        retriable: false
      }
    }
  }
}

behavior GetBoolean {
  description: "Get boolean value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
    default_value: Boolean?
  }

  output {
    success: Boolean?

    errors {
      TYPE_MISMATCH {
        when: "Value at path is not a boolean"
        retriable: false
      }
    }
  }
}

behavior GetArray {
  description: "Get array value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
  }

  output {
    success: JSONArray?

    errors {
      TYPE_MISMATCH {
        when: "Value at path is not an array"
        retriable: false
      }
    }
  }
}

behavior GetObject {
  description: "Get object value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
  }

  output {
    success: JSONObject?

    errors {
      TYPE_MISMATCH {
        when: "Value at path is not an object"
        retriable: false
      }
    }
  }
}

behavior Has {
  description: "Check if path exists (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
  }

  output {
    success: Boolean
  }
}

# ============================================
# Behaviors - Modification
# ============================================

behavior Set {
  description: "Set value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
    value: JSONValue
  }

  output {
    success: JSONValue

    errors {
      INVALID_PATH {
        when: "Path is invalid or parent doesn't exist"
        retriable: false
      }
    }
  }

  post success {
    Get(result, input.path) == input.value
  }
}

behavior Remove {
  description: "Remove value at path (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath | JSONPointer
  }

  output {
    success: JSONValue

    errors {
      PATH_NOT_FOUND {
        when: "Path does not exist"
        retriable: false
      }
    }
  }

  post success {
    not Has(result, input.path)
  }
}

behavior Merge {
  description: "Deep merge two objects (DETERMINISTIC)"
  deterministic: true

  input {
    target: JSONObject
    source: JSONObject
    deep: Boolean [default: true]
  }

  output {
    success: JSONObject
  }

  post success {
    # All keys from source present in result
    forall key in Keys(input.source):
      Has(result, "$." + key)
  }
}

behavior Clone {
  description: "Deep clone JSON value (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: JSONValue
  }

  post success {
    result == input.value
    # Result is independent copy
  }
}

# ============================================
# Behaviors - Querying
# ============================================

behavior Keys {
  description: "Get all keys from object (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONObject
  }

  output {
    success: List<String>
  }
}

behavior Values {
  description: "Get all values from object (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONObject
  }

  output {
    success: List<JSONValue>
  }
}

behavior Entries {
  description: "Get all key-value pairs from object (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONObject
  }

  output {
    success: List<{ key: String, value: JSONValue }>
  }

  post success {
    result.length == Keys(input.object).length
  }
}

behavior Query {
  description: "Query JSON with JSONPath expression (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONValue
    path: JSONPath
  }

  output {
    success: List<JSONValue>

    errors {
      INVALID_PATH {
        when: "JSONPath expression is invalid"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Comparison
# ============================================

behavior Equals {
  description: "Deep equality comparison (DETERMINISTIC)"
  deterministic: true

  input {
    a: JSONValue
    b: JSONValue
  }

  output {
    success: Boolean
  }

  post success {
    # Same values always equal
    result == (Stringify(input.a, SORTED_KEYS) == Stringify(input.b, SORTED_KEYS))
  }
}

behavior Diff {
  description: "Calculate JSON patch between two values (DETERMINISTIC)"
  deterministic: true

  input {
    source: JSONValue
    target: JSONValue
  }

  output {
    success: JSONDiff
  }

  post success {
    # Applying patches to source yields target
    ApplyPatches(input.source, result.patches) == input.target
  }
}

behavior ApplyPatches {
  description: "Apply JSON patches to value (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
    patches: List<JSONPatch>
  }

  output {
    success: JSONValue

    errors {
      PATCH_FAILED {
        when: "Patch operation failed"
        retriable: false
      }
      TEST_FAILED {
        when: "Test operation did not pass"
        retriable: false
      }
    }
  }
}

# ============================================
# Behaviors - Validation
# ============================================

behavior IsValid {
  description: "Check if string is valid JSON (DETERMINISTIC)"
  deterministic: true

  input {
    json: String
  }

  output {
    success: Boolean
  }

  post success {
    result == TryParse(input.json).success
  }
}

behavior IsObject {
  description: "Check if value is a JSON object (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: Boolean
  }
}

behavior IsArray {
  description: "Check if value is a JSON array (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: Boolean
  }
}

behavior IsString {
  description: "Check if value is a string (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: Boolean
  }
}

behavior IsNumber {
  description: "Check if value is a number (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: Boolean
  }
}

behavior IsBoolean {
  description: "Check if value is a boolean (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: Boolean
  }
}

behavior IsNull {
  description: "Check if value is null (DETERMINISTIC)"
  deterministic: true

  input {
    value: JSONValue
  }

  output {
    success: Boolean
  }
}

# ============================================
# Behaviors - Transformation
# ============================================

behavior Flatten {
  description: "Flatten nested object to dot-notation keys (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONObject
    delimiter: String [default: "."]
  }

  output {
    success: Map<String, JSONValue>
  }

  post success {
    # No nested objects in result
    forall value in Values(result):
      not IsObject(value) or Keys(value).length == 0
  }
}

behavior Unflatten {
  description: "Unflatten dot-notation keys to nested object (DETERMINISTIC)"
  deterministic: true

  input {
    object: Map<String, JSONValue>
    delimiter: String [default: "."]
  }

  output {
    success: JSONObject
  }

  post success {
    # Round-trip preserves data
    Flatten(result, input.delimiter) == input.object
  }
}

behavior Pick {
  description: "Create object with only specified keys (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONObject
    keys: List<String>
  }

  output {
    success: JSONObject
  }

  post success {
    forall key in Keys(result):
      key in input.keys
  }
}

behavior Omit {
  description: "Create object without specified keys (DETERMINISTIC)"
  deterministic: true

  input {
    object: JSONObject
    keys: List<String>
  }

  output {
    success: JSONObject
  }

  post success {
    forall key in input.keys:
      not Has(result, "$." + key)
  }
}

# ============================================
# Constants
# ============================================

const EMPTY_OBJECT: JSONObject = {}
const EMPTY_ARRAY: JSONArray = []
const NULL_VALUE: JSONValue = null
