# OpenAPI Interoperability

ShipGate provides first-class support for OpenAPI specifications, enabling seamless round-trip conversion between OpenAPI and ISL.

## Features

- **Import OpenAPI → ISL**: Convert OpenAPI 3.x specs to ISL domain specifications
- **Generate OpenAPI from ISL**: Enhanced OpenAPI generation with full schema support
- **Diff OpenAPI specs**: Detect API drift and breaking changes between versions

## Commands

### Import OpenAPI

Convert an OpenAPI specification to ISL:

```bash
shipgate import openapi api.yaml -o api.isl
```

Options:
- `-o, --output <file>`: Output ISL file path (default: same name as input with .isl extension)
- `-d, --domain <name>`: Override domain name (default: inferred from API title)
- `--force`: Overwrite existing files

Example:

```bash
# Import OpenAPI spec
shipgate import openapi openapi.yaml -o api.isl

# With custom domain name
shipgate import openapi openapi.yaml -o api.isl -d UserService
```

### Generate OpenAPI

Generate OpenAPI specification from ISL (enhanced version):

```bash
shipgate gen openapi domain.isl -o openapi.yaml
```

The enhanced generator:
- Supports OpenAPI 3.0 and 3.1
- Generates complete schemas from entities and types
- Maps behaviors to HTTP operations
- Includes error responses
- Preserves constraints and annotations

### Diff OpenAPI

Compare two OpenAPI specifications to detect changes:

```bash
shipgate diff openapi old.yaml new.yaml
```

Options:
- `--breaking-only`: Show only breaking changes
- `--ignore-version`: Ignore version number changes

Example:

```bash
# Compare API versions
shipgate diff openapi api-v1.yaml api-v2.yaml

# Show only breaking changes
shipgate diff openapi api-v1.yaml api-v2.yaml --breaking-only
```

## Round-Trip Consistency

The import/export pipeline is designed for round-trip consistency:

1. **Import** OpenAPI → ISL
2. **Modify** ISL specification
3. **Generate** OpenAPI from modified ISL
4. **Diff** original vs generated OpenAPI

The diff should show minimal differences, preserving core semantics while allowing ISL-specific enhancements.

## Supported OpenAPI Features

### Import (OpenAPI → ISL)

- ✅ OpenAPI 3.0 and 3.1
- ✅ JSON and YAML formats
- ✅ Component schemas → ISL types/entities
- ✅ Paths and operations → ISL behaviors
- ✅ Parameters (path, query, header, body)
- ✅ Request/response schemas
- ✅ Error responses
- ✅ Enums
- ✅ Constraints (min, max, pattern, etc.)
- ✅ Required/optional fields

### Export (ISL → OpenAPI)

- ✅ Entities → Component schemas
- ✅ Types → Component schemas
- ✅ Behaviors → Path operations
- ✅ Input/output types
- ✅ Error definitions
- ✅ Constraints and validations
- ✅ Field annotations (immutable, secret, etc.)

### Diff

- ✅ Path additions/removals
- ✅ Operation changes
- ✅ Parameter modifications
- ✅ Schema changes
- ✅ Breaking vs non-breaking classification
- ✅ Response code changes

## Examples

### Example 1: Import Existing API

```bash
# Start with OpenAPI spec
shipgate import openapi petstore.yaml -o petstore.isl

# Review and enhance ISL
# ... edit petstore.isl ...

# Generate enhanced OpenAPI
shipgate gen openapi petstore.isl -o petstore-enhanced.yaml

# Compare original vs enhanced
shipgate diff openapi petstore.yaml petstore-enhanced.yaml
```

### Example 2: API Versioning

```bash
# Compare API versions
shipgate diff openapi api-v1.yaml api-v2.yaml

# Check for breaking changes only
shipgate diff openapi api-v1.yaml api-v2.yaml --breaking-only
```

### Example 3: CI Integration

```bash
# In CI pipeline: fail on breaking changes
if shipgate diff openapi api-current.yaml api-new.yaml --breaking-only; then
  echo "Breaking changes detected!"
  exit 1
fi
```

## Limitations

- Complex OpenAPI features (callbacks, links, etc.) may not fully map to ISL
- Some OpenAPI patterns may require manual ISL refinement
- Round-trip may introduce minor formatting differences

## Best Practices

1. **Review imported ISL**: Always review generated ISL and add ISL-specific features (invariants, policies, scenarios)
2. **Use version control**: Track both OpenAPI and ISL specs
3. **Validate round-trip**: After import, generate OpenAPI and diff to verify consistency
4. **Incremental adoption**: Start with import, gradually enhance with ISL features

## See Also

- [ISL Language Reference](../isl-language/syntax-reference.md)
- [Code Generation](../cli/generate.md)
- [API Gateway Integration](../../isl-federation/README.md)
