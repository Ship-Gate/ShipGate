# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: length, isEmpty, isBlank, toLowerCase, toUpperCase, toTitleCase, toCamelCase, toPascalCase, toSnakeCase, toKebabCase, changeCase, trim, trimStart, trimEnd, trimChars, contains, startsWith, endsWith, indexOf, lastIndexOf, substring, slice, replace, replaceAll, split, join, concat, repeat, padStart, padEnd, reverse, charAt, charCodeAt, fromCharCode, isValidEmail, isValidUrl, isValidPhone, matchesPattern, isAlpha, isAlphanumeric, isNumeric, isHexadecimal, isLowerCase, isUpperCase, EMPTY, SPACE, NEWLINE, TAB, CRLF, String, StringCase, TrimMode, SplitResult, StringValidationResult
# dependencies: 

domain String {
  version: "1.0.0"

  type StringCase = String
  type TrimMode = String
  type SplitResult = String
  type StringValidationResult = String

  invariants exports_present {
    - true
  }
}
