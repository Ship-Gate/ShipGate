# ISL Verifier Sandbox

Secure sandboxed execution environment for ISL verification to prevent arbitrary code execution vulnerabilities.

## Overview

The ISL Verifier Sandbox provides multiple isolation modes for executing untrusted code during verification:

- **Worker Threads** (default): Lightweight isolation using Node.js worker threads
- **Docker**: Strong isolation using Docker containers (recommended for production)
- **No-Op**: No sandboxing (use only when you trust the code)

## Security Features

- ✅ Execution timeouts
- ✅ Memory limits
- ✅ Environment variable filtering (allowlist)
- ✅ Secrets masking in logs and output
- ✅ Network access blocking (configurable)
- ✅ Filesystem access restrictions (configurable)

## Usage

### CLI

```bash
# Use default sandbox mode (auto-detects best available)
isl verify --spec spec.isl --impl impl.ts

# Use worker thread sandbox
isl verify --spec spec.isl --impl impl.ts --sandbox worker

# Use Docker sandbox (requires Docker)
isl verify --spec spec.isl --impl impl.ts --sandbox docker

# Disable sandboxing (not recommended)
isl verify --spec spec.isl --impl impl.ts --sandbox off

# Configure sandbox options
isl verify --spec spec.isl --impl impl.ts \
  --sandbox worker \
  --sandbox-timeout 60000 \
  --sandbox-memory 256 \
  --sandbox-env "NODE_ENV,PATH,HOME"
```

### Programmatic API

```typescript
import { createSandboxRunner } from '@isl-lang/verifier-sandbox';

const sandbox = createSandboxRunner({
  mode: 'worker',
  timeout: 30000,
  maxMemory: 128 * 1024 * 1024, // 128MB
  allowedEnvVars: ['NODE_ENV', 'PATH'],
  allowNetwork: false,
  allowFilesystem: false,
});

const result = await sandbox.execute('node', ['script.js'], {
  cwd: '/tmp/work',
  env: { NODE_ENV: 'test' },
});

console.log(result.maskedStdout); // Output with secrets masked
await sandbox.cleanup();
```

## Sandbox Modes

### Auto Mode (`auto`)

Automatically selects the best available sandbox:
1. Tries Docker if available
2. Falls back to worker threads
3. Falls back to no-op if neither available

### Worker Thread Mode (`worker`)

- Uses Node.js worker threads for isolation
- **Note**: Worker threads provide isolation but are NOT a complete security boundary
- Suitable for development and trusted environments
- Faster than Docker but less secure

### Docker Mode (`docker`)

- Executes code in isolated Docker containers
- Provides the strongest security boundary
- Requires Docker to be installed and running
- Recommended for production and CI/CD environments
- Slower than worker threads but more secure

### Off Mode (`off`)

- No sandboxing - executes code directly
- **Warning**: Only use when you fully trust the code
- Provides no security isolation
- Fastest execution but no protection

## Secrets Masking

The sandbox automatically masks sensitive information in logs and output:

- API keys (`API_KEY=...`, `apikey=...`)
- Tokens (`token=...`, `Bearer ...`)
- Passwords (`password=...`, `pwd=...`)
- Secrets (`secret=...`, `SECRET_KEY=...`)
- AWS keys (`AWS_SECRET_ACCESS_KEY=...`)
- Private keys (`-----BEGIN PRIVATE KEY-----`)
- JWT tokens (`eyJ...`)
- Credit card numbers

Custom patterns can be added:

```typescript
import { SecretsMasker } from '@isl-lang/verifier-sandbox';

const masker = new SecretsMasker({
  patterns: [/custom-pattern-(\w+)/g],
});

const masked = masker.mask('custom-pattern-secret123');
// Returns: '***'
```

## Threat Model

### What the Sandbox Protects Against

✅ **Arbitrary code execution**: Code runs in isolated environment  
✅ **Resource exhaustion**: Memory and CPU limits enforced  
✅ **Secrets leakage**: Sensitive data masked in logs  
✅ **Network access**: Blocked by default (configurable)  
✅ **Filesystem access**: Restricted to work directory (configurable)  
✅ **Environment variable access**: Filtered via allowlist  

### What the Sandbox Does NOT Protect Against

❌ **Worker Thread Mode**: Not a complete security boundary - use Docker for untrusted code  
❌ **Docker escape vulnerabilities**: Depends on Docker security  
❌ **Kernel-level exploits**: Requires OS-level security  
❌ **Side-channel attacks**: Not protected against timing attacks  

### Recommendations

- **Development**: Use `worker` mode for faster iteration
- **CI/CD**: Use `docker` mode for stronger isolation
- **Production**: Always use `docker` mode with strict limits
- **Untrusted code**: Always use `docker` mode, never `off`

## Configuration

### Environment Variables

The sandbox filters environment variables using an allowlist. By default, only these are allowed:

- `NODE_ENV`
- `PATH`
- `HOME`
- `TMPDIR`
- `TMP`

Custom allowlists can be specified via `--sandbox-env` or `allowedEnvVars` option.

### Memory Limits

Default memory limit: 128MB

Can be configured via `--sandbox-memory <mb>` or `maxMemory` option.

### Timeouts

Default timeout: 30 seconds

Can be configured via `--sandbox-timeout <ms>` or `timeout` option.

## Examples

### Basic Usage

```bash
# Verify with default sandbox
isl verify --spec auth.isl --impl auth.ts
```

### Custom Sandbox Configuration

```bash
# Use Docker with custom limits
isl verify --spec auth.isl --impl auth.ts \
  --sandbox docker \
  --sandbox-timeout 60000 \
  --sandbox-memory 512 \
  --sandbox-env "NODE_ENV,PATH"
```

### Programmatic Usage

```typescript
import { createSandboxRunner } from '@isl-lang/verifier-sandbox';

const sandbox = createSandboxRunner({
  mode: 'docker',
  timeout: 60000,
  maxMemory: 512 * 1024 * 1024,
  allowedEnvVars: ['NODE_ENV'],
  allowNetwork: false,
  allowFilesystem: false,
});

try {
  const result = await sandbox.execute('npm', ['test'], {
    cwd: '/tmp/test',
  });
  
  if (result.success) {
    console.log('Tests passed');
    console.log(result.maskedStdout);
  } else {
    console.error('Tests failed');
    console.error(result.maskedStderr);
  }
} finally {
  await sandbox.cleanup();
}
```

## Testing

Run tests:

```bash
npm test
```

Run specific test:

```bash
npm test -- sandbox.test.ts
```

## License

MIT
