# Fixture Skip TODO

This document tracks known-incompatible fixtures that are explicitly skipped in the parser integration tests.
These fixtures use syntax patterns the parser doesn't yet support.

**Status**: 6 fixtures skipped  
**Last Updated**: 2026-02-01  
**Tracked In**: `packages/parser/tests/integration.test.ts` → `SKIP_FIXTURES` array

---

## format-constraint

**Issue**: Parser doesn't support `format:` as a constraint key in type definitions.

**Affected Fixtures** (4 files):
- `packages/import-resolver/fixtures/shadowing/main.isl`
- `packages/import-resolver/fixtures/shadowing/types.isl`
- `packages/import-resolver/fixtures/simple/types.isl`
- `packages/lsp-server/fixtures/imports/common-types.isl`

**Example Failing Syntax**:
```isl
type Email = String { format: "email", max_length: 254 }
```

**Error Message**: `Expected identifier, got ','`

**Root Cause**: The parser's `parseConstrainedType()` function recognizes constraint keys like `max_length`, `min_length`, `min`, `max`, `precision`, but not `format`. When it encounters `format:`, it doesn't recognize it as a valid constraint and the comma separator causes a parse error.

**Fix Location**: `packages/parser/src/parser.ts` → `parseConstrainedType()` or `parseConstraint()`

**Proposed Fix**:
1. Add `format` to the list of recognized constraint keys
2. Handle string values for format constraints (e.g., `"email"`, `"url"`, `"uuid"`)

**Priority**: Medium - affects downstream packages (import-resolver, lsp-server)

---

## alternate-import

**Issue**: Parser doesn't support the alternate import syntax `imports { X } from "path"`.

**Affected Fixtures** (2 files):
- `packages/lsp-server/fixtures/imports/broken-import.isl`
- `packages/lsp-server/fixtures/imports/unused-imports.isl`

**Example Failing Syntax**:
```isl
imports { SomeType } from "./non-existent"
imports { Email, UserId, Status } from "./common-types"
```

**Error Message**: `Expected 'from', got '}'`

**Root Cause**: The parser expects the current import syntax:
```isl
imports {
  Email from "./types.isl"
}
```
But these fixtures use an alternate JavaScript/TypeScript-style syntax where `from` comes after the closing brace.

**Fix Location**: `packages/parser/src/parser.ts` → `parseImports()` or add `parseAlternateImportSyntax()`

**Proposed Fix**:
1. Detect when `{` follows `imports` keyword
2. If the block ends with `} from "..."`, parse as alternate syntax
3. Otherwise, parse as standard syntax

**Priority**: Low - this may be intentional test data for broken imports

---

## Resolution Checklist

- [ ] Fix `format:` constraint parsing (4 fixtures)
- [ ] Decide if alternate import syntax should be supported (2 fixtures)
- [ ] Remove fixtures from `SKIP_FIXTURES` after fixes
- [ ] Update `PARSER_STATUS.md` with new capabilities

---

## How to Test Fixes

After implementing a fix, verify by:

1. Remove the fixture path(s) from `SKIP_FIXTURES` in `integration.test.ts`
2. Run `npm test` in `packages/parser`
3. Ensure all tests pass
4. Update this document

---

## Related Documentation

- [PARSER_STATUS.md](../PARSER_STATUS.md) - Overall parser capability status
- [ISL-LANGUAGE-SPEC.md](../../../ISL-LANGUAGE-SPEC.md) - Language specification
