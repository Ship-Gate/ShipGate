# Secrets Hygiene Module

Prevents leaking secrets in CLI output and proof bundles.

## Features

- **Environment variable allowlist** - Only whitelisted env vars are shown unmasked
- **Common secret pattern detection** - Automatically detects tokens, keys, passwords, JWTs, etc.
- **Deep object masking** - Recursively masks secrets in nested JSON structures
- **Safe logging utilities** - Drop-in replacements for console.log that mask secrets
- **Integration utilities** - Easy integration with CLI, proof bundles, and verifier output

## Usage

### Basic Masking

```typescript
import { SecretsMasker, createMasker } from '@isl-lang/secrets-hygiene';

const masker = createMasker();

// Mask secrets in text
const output = 'API_KEY=sk_live_1234567890abcdef';
const masked = masker.mask(output);
// Result: 'API_KEY=***'

// Mask secrets in objects
const obj = {
  user: 'alice',
  password: 'secret123',
  apiKey: 'sk_live_1234567890',
};
const masked = masker.maskObject(obj);
// Result: { user: 'alice', password: '***', apiKey: '***' }
```

### Environment Variable Filtering

```typescript
import { EnvFilter, createEnvFilter } from '@isl-lang/secrets-hygiene';

const filter = createEnvFilter({
  allowedEnvVars: ['PATH', 'HOME', 'NODE_ENV'],
});

const env = {
  PATH: '/usr/bin',
  SECRET_KEY: 'secret123',
  API_KEY: 'key123',
};

const filtered = filter.filter(env);
// Result: { PATH: '/usr/bin' } (SECRET_KEY and API_KEY are excluded)
```

### Safe JSON Stringify

```typescript
import { safeJSONStringify } from '@isl-lang/secrets-hygiene';

const data = {
  user: 'alice',
  password: 'secret123',
  apiKey: 'sk_live_1234567890',
};

const json = safeJSONStringify(data, undefined, 2);
// Secrets are automatically masked in the JSON output
```

### Safe Logger

```typescript
import { SafeLogger, createSafeLogger } from '@isl-lang/secrets-hygiene';

const logger = createSafeLogger();

logger.info('User logged in', { password: 'secret123' });
// Output: User logged in { password: '***' }

logger.error('API call failed', { apiKey: 'sk_live_1234567890' });
// Output: API call failed { apiKey: '***' }
```

## Integration

### CLI Output

The CLI output module automatically masks secrets:

```typescript
import { json, info, error } from '@isl-lang/cli/output';

// All output is automatically masked
json({ password: 'secret123' });
info('API_KEY=sk_live_1234567890');
error('Token: bearer_token_here');
```

### Proof Bundles

Proof bundle writer automatically masks secrets in all JSON files:

```typescript
import { ProofBundleWriter } from '@isl-lang/proof';

const writer = new ProofBundleWriter({ ... });
// All JSON files written are automatically masked
await writer.write();
```

### Verifier Output

Verifier results are automatically masked:

```typescript
import { verify } from '@isl-lang/isl-verify';

const result = await verify(spec, impl);
// Result JSON is automatically masked
```

## Supported Secret Patterns

- API keys (`sk_live_`, `sk_test_`, `pk_live_`, etc.)
- Stripe keys
- GitHub tokens (`ghp_`)
- GitLab tokens (`glpat-`)
- JWT tokens
- Passwords
- AWS keys
- Private keys (PEM format)
- OAuth tokens
- Database connection strings with passwords

## Configuration

### Custom Patterns

```typescript
const masker = createMasker({
  patterns: [
    /CUSTOM_SECRET_PATTERN/g,
  ],
  maskChar: '***',
});
```

### Environment Variable Allowlist

```typescript
const filter = createEnvFilter({
  allowedEnvVars: ['PATH', 'HOME', 'NODE_ENV'],
  maskDisallowed: true, // Mask disallowed vars instead of excluding
});
```

## Testing

Run tests:

```bash
pnpm test
```

Run acceptance test:

```bash
pnpm test acceptance.test.ts
```

## Acceptance Criteria

✅ A spec/impl that prints secrets cannot leak them into proof bundle or console output.

All output is automatically masked to prevent secrets leakage.
