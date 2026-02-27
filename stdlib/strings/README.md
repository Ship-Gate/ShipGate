# @isl/strings

String manipulation and validation operations for ISL specifications.

## Overview

This module provides comprehensive string operations including manipulation, validation, search, and encoding. **All functions are deterministic**.

## Determinism

All functions in this module are **deterministic** - they always produce the same output given the same input.

## Categories

### Length Operations
- `Length` - Get string length
- `IsEmpty` - Check if empty
- `IsBlank` - Check if empty or whitespace only

### Case Operations
- `ToLowerCase` - Convert to lowercase
- `ToUpperCase` - Convert to uppercase
- `ToTitleCase` - Convert to title case
- `ChangeCase` - Convert to any case (LOWER, UPPER, TITLE, CAMEL, PASCAL, SNAKE, KEBAB)

### Trim Operations
- `Trim` - Remove whitespace from both ends
- `TrimStart` - Remove whitespace from start
- `TrimEnd` - Remove whitespace from end
- `TrimChars` - Remove specific characters

### Search Operations
- `Contains` - Check if contains substring
- `StartsWith` - Check if starts with prefix
- `EndsWith` - Check if ends with suffix
- `IndexOf` - Find first occurrence
- `LastIndexOf` - Find last occurrence

### Manipulation Operations
- `Substring` - Extract portion
- `Replace` - Replace first occurrence
- `ReplaceAll` - Replace all occurrences
- `Split` - Split by delimiter
- `Join` - Join with delimiter
- `Concat` - Concatenate strings
- `Repeat` - Repeat n times
- `PadStart` / `PadEnd` - Pad to length
- `Reverse` - Reverse string

### Validation Operations
- `IsValidEmail` - Validate email format
- `IsValidUrl` - Validate URL format
- `IsValidPhone` - Validate E.164 phone format
- `MatchesPattern` - Match against regex
- `IsAlpha` - Only letters
- `IsAlphanumeric` - Letters and digits
- `IsNumeric` - Only digits
- `IsHexadecimal` - Valid hex string

### Encoding Operations
- `EncodeBase64` / `DecodeBase64`
- `EncodeUrl` / `DecodeUrl`
- `EscapeHtml` / `UnescapeHtml`

## Usage

```isl
use @isl/strings

behavior RegisterUser {
  input {
    email: String
    username: String
  }

  pre {
    # Validate email format
    IsValidEmail(email)
    
    # Username must be alphanumeric
    IsAlphanumeric(username)
    Length(username) >= 3
    Length(username) <= 20
  }

  post success {
    # Email stored lowercase
    result.email == ToLowerCase(input.email)
    
    # Username trimmed
    result.username == Trim(input.username)
  }
}
```

## Types

- `StringCase` - Case conversion enum
- `TrimMode` - Trim direction enum
- `EmailFormat` - Pre-validated email type
- `UrlFormat` - Pre-validated URL type
- `PhoneFormat` - E.164 phone number type
