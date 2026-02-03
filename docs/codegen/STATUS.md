# Code Generation Status

This document summarizes the status of ISL code generation for each target language.

## Language Support Matrix

| Language | Types | Validation | Contracts | Tests | Status |
|----------|-------|------------|-----------|-------|--------|
| **TypeScript** | ✓ Full | ✓ Zod | ✓ Full | ✓ Full | **v1 Production** |
| **Python** | ✓ Full | ✓ Pydantic | ✓ Full | ✓ Full | **v1 Production** |
| Rust | ✓ Full | ✓ Full | ✗ Stub | Partial | Experimental |
| Go | ✓ Full | Partial | ✗ Stub | Partial | Experimental |
| JVM (Java/Kotlin) | Partial | ✗ None | ✗ None | ✗ None | Stub |
| C#/.NET | Partial | ✗ None | ✗ None | ✗ None | Stub |

## Status Definitions

- **v1 Production**: Full feature support with contract checking. Ready for production use.
- **Experimental**: Core functionality works but contract checking incomplete. Use with caution.
- **Stub**: Basic scaffolding exists but implementation is minimal. Not recommended for use.

## v1 Production Languages

### TypeScript

TypeScript codegen is fully supported with:
- Complete type generation (interfaces, type aliases, enums)
- Zod validation schemas
- Runtime contract checking via decorators
- Full test generation
- Serialization/deserialization helpers

### Python

Python codegen is fully supported as of v1.0 with:
- Dataclass generation
- Pydantic model generation with validation
- **Full runtime contract checking**:
  - Precondition validation
  - Postcondition verification
  - Invariant checking
  - Entity store integration for existential checks
  - Old state capture for postconditions
- Contract enforcement modes (strict, warn, skip)
- FastAPI integration
- Test generation

See [Python Codegen Documentation](./PYTHON.md) for details.

## Experimental Languages

### Rust

- Types: Full struct generation with derives
- Validation: Custom validators via traits
- Contracts: Stub only - no runtime checking
- Recommendation: Use for type generation only

### Go

- Types: Full struct generation
- Validation: Partial (field tags only)
- Contracts: Stub only - no runtime checking
- Recommendation: Use for type generation only

## Stub Languages

These languages have minimal implementation and are not recommended for use:

### JVM (Java/Kotlin)

- Only basic class scaffolding
- No validation or contracts
- Contribution welcome

### C#/.NET

- Only basic class scaffolding
- No validation or contracts
- Contribution welcome

## Roadmap

### Near-term (v1.x)

1. Complete Rust contract generation
2. Add Go contract generation
3. Improve cross-language test vectors

### Medium-term (v2.0)

1. JVM full support with contracts
2. C# full support with contracts
3. Swift support

## Contributing

We welcome contributions to improve language support. Priority areas:

1. **Contract generation** for Rust and Go
2. **Test generation** improvements
3. **New language targets** (Swift, Ruby, PHP)

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Architecture

All code generators use the same architecture:

```
ISL Source → Parser → AST → Codegen → Target Language
                             ↓
                    Expression Compiler
                             ↓
                    Contract Generator
```

Key components:
- `@isl-lang/codegen-types`: Type and contract generation
- `@isl-lang/codegen-tests`: Test generation
- `@isl-lang/codegen-python`: Python-specific generation
- `@isl-lang/codegen-{lang}`: Language-specific packages

### Adding New Languages

To add contract support for a new language:

1. Create an expression compiler (`{lang}-expression-compiler.ts`)
2. Create a contract generator (`{lang}-contracts.ts`)
3. Update the main generator to include contracts
4. Add golden fixture tests for consistency
5. Create runtime library for target language

See the Python implementation as a reference:
- `packages/codegen-types/src/python-expression-compiler.ts`
- `packages/codegen-types/src/python-contracts.ts`
- `packages/codegen-types/templates/python/isl_runtime.py`
