# @isl-lang/codegen-harness

Golden output + compile-check harness for ISL code generators. Ensures codegen changes always produce **stable, valid, and deterministic** output.

## What It Does

For each generator (TypeScript, Rust, Go, OpenAPI) × each sample ISL file:

1. **Parses** the ISL spec via `@isl-lang/parser`
2. **Generates** code into memory using deterministic generators (no timestamps)
3. **Compares** output byte-for-byte against golden files in `samples/golden/`
4. **Runs `tsc --noEmit`** on generated TypeScript to verify it compiles

## Quick Start

```bash
# Run all codegen quality tests
pnpm test:codegen

# Run from the harness package directly
pnpm --filter @isl-lang/codegen-harness test

# Update golden files after intentional generator changes
pnpm --filter @isl-lang/codegen-harness update-golden
```

## Structure

```
packages/codegen-harness/
├── src/
│   ├── types.ts          # CodeGenerator contract interface
│   ├── generators.ts     # Deterministic TS/Rust/Go/OpenAPI generators
│   └── index.ts          # Public exports
├── samples/
│   ├── isl/              # Sample ISL input specs
│   │   └── auth.isl
│   └── golden/           # Expected outputs (committed to git)
│       ├── typescript/
│       ├── rust/
│       ├── go/
│       └── openapi/
├── tests/
│   ├── codegen-golden.test.ts   # Golden comparison (18 tests)
│   └── ts-compile-check.test.ts # TypeScript compilation check
└── scripts/
    └── update-golden.ts         # Regenerate golden files
```

## Generator Contract

Every generator must implement:

```typescript
interface CodeGenerator {
  readonly name: string;
  readonly extension: string;
  generate(domain: Domain): GeneratedFile[];
}
```

Requirements:
- **Deterministic**: Two runs with the same input produce identical output
- **No side effects**: Pure function, no disk I/O or timestamps
- **Non-empty**: Must produce at least one file with content

## Adding a New Generator

1. Add the generator to `src/generators.ts` implementing `CodeGenerator`
2. Register it in the `ALL_GENERATORS` array
3. Run `pnpm --filter @isl-lang/codegen-harness update-golden`
4. Commit the new golden files

## Adding a New Sample ISL

1. Place the `.isl` file in `samples/isl/`
2. Run `pnpm --filter @isl-lang/codegen-harness update-golden`
3. Commit the new golden files

## CI Gate

The `.github/workflows/codegen-gate.yml` workflow runs on PRs that touch `packages/codegen-*` or `packages/cli/src/commands/gen*.ts`. It ensures:

- Golden outputs match (no unexpected diffs)
- Generated TypeScript compiles without errors

## License

MIT
