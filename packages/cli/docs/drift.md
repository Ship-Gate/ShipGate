# Drift Detection Command

The `isl drift` command detects drift between your code implementation and ISL specifications. It scans your codebase for routes and types, compares them against ISL specs, and reports differences.

## Usage

```bash
# Check drift for all specs in current directory
isl drift

# Check drift for specific spec file
isl drift path/to/spec.isl

# Specify code path to scan
isl drift --code ./src

# Output in different formats
isl drift --format json
isl drift --format diff

# Fail CI if drift is detected
isl drift --fail-on-drift
```

## What It Detects

### Added (UNBOUND)
- **Routes** found in code but no matching behavior in spec
- **Types** found in code but no matching entity in spec

These are marked as "UNBOUND" - they exist in code but aren't specified in ISL.

### Removed
- **Behaviors** in spec but no matching route found in code
- **Entities** in spec but no matching type found in code

These indicate that the spec references something that no longer exists in code.

### Modified
- Errors parsing spec files
- Other structural differences

## Output Formats

### Text (default)
Human-readable summary with color-coded changes:
- Green: Added items (UNBOUND)
- Red: Removed items
- Yellow: Modified items

### JSON
Structured JSON output for programmatic processing:
```json
{
  "success": false,
  "codePath": "./src",
  "specFile": "api.isl",
  "changes": [
    {
      "type": "added",
      "category": "route",
      "name": "GET:/api/users",
      "description": "Route GET /api/users found in code but no matching behavior in spec",
      "location": {
        "file": "src/routes/users.ts",
        "line": 10
      }
    }
  ],
  "summary": {
    "total": 1,
    "added": 1,
    "removed": 0,
    "modified": 0,
    "unchanged": 0
  }
}
```

### Diff
Unified diff-style output:
```
+ route: GET:/api/users
  Route GET /api/users found in code but no matching behavior in spec
  at src/routes/users.ts:10

- behavior: CreateUser
  Behavior CreateUser exists in spec but no matching route found in code
  at api.isl
```

## Integration with CI/CD

Use `--fail-on-drift` to fail builds when drift is detected:

```yaml
# GitHub Actions example
- name: Check drift
  run: isl drift --fail-on-drift --format json
```

## Examples

### Example 1: Detecting New Routes

```bash
$ isl drift
Drift Detection Report
────────────────────────────────────────────────────────────

Summary:
  Code Path: ./src
  Spec File: api.isl
  Total Changes: 2
  Added: 2
  Removed: 0
  Modified: 0

Added (UNBOUND):
  + route: GET:/api/users
    Route GET /api/users found in code but no matching behavior in spec
    at src/routes/users.ts:10

  + route: POST:/api/users
    Route POST /api/users found in code but no matching behavior in spec
    at src/routes/users.ts:25
```

### Example 2: Detecting Removed Behaviors

```bash
$ isl drift
Drift Detection Report
────────────────────────────────────────────────────────────

Summary:
  Code Path: ./src
  Spec File: api.isl
  Total Changes: 1
  Added: 0
  Removed: 1
  Modified: 0

Removed:
  - behavior: DeleteUser
    Behavior DeleteUser exists in spec but no matching route found in code
    at api.isl
```

## How It Works

1. **Scans codebase** for routes using pattern matching (Express, Next.js, Fastify, etc.)
2. **Scans codebase** for TypeScript types (interfaces, classes, enums)
3. **Parses ISL specs** to extract behaviors and entities
4. **Compares** code findings against spec definitions
5. **Reports differences** with clear categorization

## Limitations

- Route detection uses regex patterns and may miss some frameworks
- Type extraction is simplified and may not capture all TypeScript features
- Complex route patterns may not match exactly with behavior names
- Requires ISL spec files to be parseable

## Related Commands

- `isl isl-generate` - Generate ISL specs from code
- `isl verify` - Verify code against ISL specs
- `isl verify evolution` - Check API evolution between spec versions
