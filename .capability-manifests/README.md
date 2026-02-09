# Capability Manifests

This directory contains capability manifests for packages that declare their completion status.

## Format

Each manifest file should be named `<package-name>.json` (without the `@isl-lang/` prefix) and follow this format:

```json
{
  "name": "@isl-lang/package-name",
  "status": "complete",
  "updatedAt": "2026-02-09T12:00:00.000Z",
  "notes": "Optional notes about current state"
}
```

## Status Values

- **`shell`**: Stub/incomplete package - minimal or no implementation
- **`partial`**: Real implementation exists but missing some deliverables (tests, docs, or samples)
- **`complete`**: All required deliverables present (exports, tests, docs, sample usage)

## Required Deliverables for "complete"

1. **Exports**: `package.json` must have proper `exports` field or `main` + `types`
2. **Tests**: Test files (`.test.ts` or `.spec.ts`) must exist and test script must not be stubbed
3. **Docs**: `README.md` with meaningful content (100+ chars) or `docs/` directory
4. **Sample Usage**: Either `examples/` directory, `demo/` directory, or usage examples in README

## Package-Specific Manifests

Alternatively, you can place a `capability-manifest.json` file directly in the package directory:

```
packages/package-name/capability-manifest.json
```

This takes precedence over manifests in `.capability-manifests/`.

## Default Behavior

If no manifest is found, packages default to `status: "shell"`.

## CI Enforcement

The CI will fail if:
- A package declares `status: "complete"` but lacks any required deliverables
- This ensures completion claims are accurate and enforceable
