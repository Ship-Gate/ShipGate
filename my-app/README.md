# MyApp

An ISL (Intent Specification Language) project.

## Getting Started

```bash
# Check ISL files for errors
npm run check

# Generate TypeScript types and tests
npm run generate

# Verify implementation against spec
npm run verify
```

## Project Structure

```
my-app/
├── src/
│   └── my-app.isl    # ISL specification
├── generated/                 # Generated TypeScript files
│   ├── types/                 # Generated types
│   ├── tests/                 # Generated tests
│   └── docs/                  # Generated documentation
├── isl.config.json           # ISL configuration
└── package.json
```

## Commands

- `isl check` - Validate ISL syntax and semantics
- `isl generate --types` - Generate TypeScript types
- `isl generate --tests` - Generate test files
- `isl generate --docs` - Generate documentation
- `isl verify --impl <file>` - Verify implementation

## Learn More

- [ISL Documentation](https://intentos.dev/docs)
- [ISL GitHub](https://github.com/intentos/isl)
