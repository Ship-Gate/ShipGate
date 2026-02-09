# ISL Language Versioning

## Overview

ISL (Intent Specification Language) uses semantic versioning to manage language evolution while maintaining backward compatibility. This document describes the versioning system, compatibility rules, and migration process.

## Version Format

ISL language versions follow semantic versioning (SemVer) with major.minor format:
- **Major version**: Breaking changes that require migration
- **Minor version**: Backward-compatible additions and improvements

Current version: **0.2**

## Specifying ISL Version

### islVersion Directive

Add an `islVersion` directive at the top of your ISL spec file to declare the language version:

```isl
#islVersion "0.2"
domain MyDomain {
  version: "1.0.0"
  # ... rest of spec
}
```

**Supported formats:**
- `#islVersion "0.2"` (hash comment style, recommended)
- `islVersion "0.2"` (directive style)

**Placement:**
- Must appear before the `domain` declaration
- Can appear after comments and shebangs
- Only the first occurrence is recognized

### Default Behavior

If no `islVersion` directive is present:
- The parser assumes the current ISL version (0.2)
- A warning is issued suggesting to add the directive
- The spec is parsed using current language rules

## Supported Versions

Currently supported ISL versions:
- **0.1**: Legacy version (requires migration)
- **0.2**: Current version (recommended)

## Version Compatibility

### Compatibility Matrix

| Source Version | Compatible With | Migration Required |
|---------------|----------------|-------------------|
| 0.1           | 0.2            | Yes               |
| 0.2           | 0.2            | No                |

### Compatibility Rules

1. **Same Version**: No migration needed
2. **Older Version**: Migration recommended for best compatibility
3. **Unknown Version**: Parser will warn but attempt to parse

## Migration

### Automatic Migration

Use the `shipgate migrate` command to automatically migrate specs:

```bash
# Migrate to current version (0.2)
shipgate migrate spec.isl

# Migrate to specific version
shipgate migrate spec.isl --target 0.2

# Dry run (preview changes)
shipgate migrate spec.isl --dry-run

# Output to different file
shipgate migrate spec.isl --output migrated.isl
```

### Migration Rules (v0.1 → v0.2)

The following transformations are applied automatically:

1. **Add islVersion directive**: If missing, adds `#islVersion "0.2"` at the top
2. **Update deprecated syntax**: (Future: syntax pattern updates)

### Manual Migration

If automatic migration doesn't cover your needs:

1. Add `#islVersion "0.2"` at the top of your spec
2. Review parser warnings for deprecated features
3. Update syntax according to migration notes

## Version Detection

The parser automatically detects the `islVersion` directive and stores it in the parse result:

```typescript
import { parse } from '@isl-lang/parser';

const result = parse(source);
console.log(result.islVersion); // "0.2" or undefined
```

## Warnings and Errors

### Warnings

The parser issues warnings when:
- No `islVersion` directive is found (suggests adding one)
- Version is deprecated (suggests migration)
- Version is unknown (may not parse correctly)

### Errors

The parser errors when:
- `islVersion` directive is malformed
- Version is incompatible with parser capabilities

## Best Practices

1. **Always specify version**: Add `#islVersion` directive to all specs
2. **Keep specs updated**: Migrate to latest version periodically
3. **Version control**: Track version changes in git
4. **Test after migration**: Verify migrated specs parse correctly

## Version History

### Version 0.2 (Current)

- Added `islVersion` directive support
- Improved error messages
- Enhanced parser robustness

### Version 0.1 (Legacy)

- Initial ISL language version
- Basic domain, entity, and behavior syntax

## Migration Notes

### v0.1 → v0.2

**Changes:**
- Introduction of `islVersion` directive
- No breaking syntax changes
- Migration is optional but recommended

**Migration Steps:**
1. Run `shipgate migrate spec.isl`
2. Review changes
3. Test parsed output
4. Commit updated spec

## API Reference

### Versioning Functions

```typescript
import {
  CURRENT_ISL_VERSION,
  SUPPORTED_VERSIONS,
  isSupportedVersion,
  areVersionsCompatible,
  getMigrationWarnings,
  migrateISL,
} from '@isl-lang/parser';
```

- `CURRENT_ISL_VERSION`: Current ISL version string
- `SUPPORTED_VERSIONS`: Array of supported version strings
- `isSupportedVersion(version)`: Check if version is supported
- `areVersionsCompatible(from, to)`: Check compatibility
- `getMigrationWarnings(version)`: Get migration warnings
- `migrateISL(content, from, to)`: Migrate ISL content

## Examples

### Basic Spec with Version

```isl
#islVersion "0.2"
domain Auth {
  version: "1.0.0"
  
  entity User {
    id: UUID
    email: String
  }
  
  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: User
    }
  }
}
```

### Migration Example

**Before (v0.1):**
```isl
domain Auth {
  version: "1.0.0"
  # ... spec
}
```

**After (v0.2):**
```isl
#islVersion "0.2"
domain Auth {
  version: "1.0.0"
  # ... spec
}
```

## FAQ

**Q: Do I need to migrate existing specs?**
A: Migration is optional but recommended. The parser will work with older versions but may show warnings.

**Q: Can I use multiple versions in one project?**
A: Yes, each `.isl` file can specify its own version. However, mixing versions may complicate tooling.

**Q: What happens if I don't specify a version?**
A: The parser assumes the current version and issues a warning suggesting to add the directive.

**Q: How do I check what version a spec uses?**
A: Use `isl parse spec.isl` and check the `islVersion` field in the output, or look for the `#islVersion` directive at the top of the file.

## See Also

- [ISL Language Specification](./ISL-LANGUAGE-SPEC.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Parser API Reference](../packages/parser/README.md)
