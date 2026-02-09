# ShipGate Packs Marketplace

Minimal Marketplace MVP for ISL domain/spec packs.

## Overview

ShipGate Packs allow you to:
- Browse ISL domain/spec packs from a registry
- Install packs into your repository
- Verify pack integrity

## Pack Format

Each pack contains a `pack.json` manifest with:

```json
{
  "name": "stdlib-auth",
  "version": "1.0.0",
  "description": "Authentication and authorization standard library",
  "domain": "Auth",
  "dependencies": {},
  "files": [
    {
      "path": "intents/domain.isl",
      "checksum": "sha256-hash",
      "size": 1234
    }
  ],
  "signature": {
    "algorithm": "sha256",
    "value": "optional-signature"
  }
}
```

## Commands

### Install a Pack

```bash
shipgate packs install stdlib-auth
```

Options:
- `-v, --version <version>` - Install specific version (default: latest)
- `-d, --dir <dir>` - Custom install directory (default: `./shipgate/packs/<name>`)
- `--skip-verify` - Skip integrity verification

### List Installed Packs

```bash
shipgate packs list
```

### Verify Pack Integrity

```bash
shipgate packs verify stdlib-auth
```

## Registry

The registry is a static JSON file located at:
- Default: `packages/cli/registry/packs-registry.json`
- Can be overridden via `SHIPGATE_REGISTRY_URL` environment variable

## Starter Packs

Three starter packs are available:

1. **stdlib-auth** - Authentication and authorization (login, logout, sessions, MFA, OAuth)
2. **stdlib-payments** - Payment processing (charges, refunds, subscriptions, invoices)
3. **stdlib-rest-api** - REST API patterns (CRUD operations, pagination, filtering)

## Usage Example

```bash
# Install auth pack
shipgate packs install stdlib-auth

# List installed packs
shipgate packs list

# Verify integrity
shipgate packs verify stdlib-auth

# Use in your ISL specs
import { Auth } from "./shipgate/packs/stdlib-auth/intents/domain.isl"
```

## Acceptance Test

```bash
# Install stdlib-auth
shipgate packs install stdlib-auth

# Verify it was installed
shipgate packs verify stdlib-auth

# List packs (should show stdlib-auth)
shipgate packs list

# Use in a gate command
shipgate gate ./shipgate/packs/stdlib-auth/intents/domain.isl --impl ./src/auth.ts
```

## Implementation Details

- Packs are installed to `./shipgate/packs/<name>/`
- Each pack contains its `pack.json` manifest
- Files are copied from source directories (for local development) or downloaded from URLs
- Integrity verification checks file existence and checksums
- Signature verification is planned but not yet implemented

## Future Enhancements

- Pack dependencies resolution
- Version management
- Pack updates
- Signature verification
- Remote registry support
- Pack publishing workflow
