# @isl/json

JSON parsing, serialization, and manipulation for ISL specifications.

## Overview

This module provides comprehensive JSON operations including parsing, serialization, path-based access, modification, and comparison. **All functions are deterministic**.

## Determinism

All functions in this module are **deterministic** - they always produce the same output given the same input.

## Categories

### Parsing
- `Parse` - Parse JSON string to value
- `TryParse` - Parse with error handling (returns result object)

### Serialization
- `Stringify` - Serialize to JSON string
- `StringifyPretty` - Pretty-printed output
- `StringifyCompact` - Compact output

### Access
- `Get` - Get value at path
- `GetString` / `GetNumber` / `GetBoolean` - Type-safe getters
- `GetArray` / `GetObject` - Collection getters
- `Has` - Check if path exists

### Modification
- `Set` - Set value at path
- `Remove` - Remove value at path
- `Merge` - Deep merge objects
- `Clone` - Deep clone value

### Querying
- `Keys` - Get object keys
- `Values` - Get object values
- `Entries` - Get key-value pairs
- `Query` - JSONPath query

### Comparison
- `Equals` - Deep equality
- `Diff` - Calculate JSON patch
- `ApplyPatches` - Apply JSON patches

### Validation
- `IsValid` - Check if valid JSON
- `IsObject` / `IsArray` / `IsString` / `IsNumber` / `IsBoolean` / `IsNull`

### Transformation
- `Flatten` - Flatten to dot-notation
- `Unflatten` - Expand dot-notation
- `Pick` - Select specific keys
- `Omit` - Exclude specific keys

## Usage

### Parsing and Serialization

```isl
use @isl/json

behavior ProcessWebhook {
  input {
    payload: String
  }

  pre {
    # Validate JSON
    IsValid(payload)
  }

  post success {
    # Parse and access data
    data = Parse(input.payload)
    GetString(data, "$.event_type") == "payment.completed"
  }
}
```

### Path-Based Access

Supports both JSONPath and JSON Pointer:

```isl
use @isl/json

behavior ExtractData {
  input {
    json: JSONObject
  }

  post success {
    # JSONPath syntax
    Get(input.json, "$.user.name")
    
    # JSON Pointer syntax
    Get(input.json, "/user/name")
    
    # Array access
    Get(input.json, "$.items[0].price")
  }
}
```

### Modification

```isl
use @isl/json

behavior UpdateConfig {
  input {
    config: JSONObject
    key: String
    value: JSONValue
  }

  post success {
    result == Set(input.config, "$." + input.key, input.value)
    Has(result, "$." + input.key)
  }
}
```

### Deep Merge

```isl
use @isl/json

behavior MergeDefaults {
  input {
    user_config: JSONObject
    defaults: JSONObject
  }

  post success {
    # User config takes precedence
    result == Merge(input.defaults, input.user_config)
  }
}
```

### JSON Patch (RFC 6902)

```isl
use @isl/json

behavior TrackChanges {
  input {
    before: JSONObject
    after: JSONObject
  }

  post success {
    # Calculate difference as patches
    diff = Diff(input.before, input.after)
    
    # Apply patches to recreate after
    ApplyPatches(input.before, diff.patches) == input.after
  }
}
```

## Types

- `JSONValue` - Any JSON value
- `JSONObject` - JSON object (Map<String, JSONValue>)
- `JSONArray` - JSON array (List<JSONValue>)
- `JSONPath` - JSONPath expression (e.g., `$.store.book[0].title`)
- `JSONPointer` - JSON Pointer (e.g., `/store/book/0/title`)
- `JSONPatchOp` - Patch operation (ADD, REMOVE, REPLACE, MOVE, COPY, TEST)

## Constants

- `EMPTY_OBJECT` - `{}`
- `EMPTY_ARRAY` - `[]`
- `NULL_VALUE` - `null`
