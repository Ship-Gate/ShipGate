# @isl/crypto

Cryptographic hashing and secure operations for ISL specifications.

## Overview

This module provides cryptographic primitives including hash functions, password hashing, HMAC signatures, and secure random generation.

## Determinism

| Function | Deterministic | Notes |
|----------|---------------|-------|
| `Hash` | ✅ Yes | Same input → same hash |
| `HashSHA256` | ✅ Yes | Same input → same hash |
| `HashSHA512` | ✅ Yes | Same input → same hash |
| `HashSHA3` | ✅ Yes | Same input → same hash |
| `HashBlake3` | ✅ Yes | Same input → same hash |
| `HashPassword` | ✅ Yes* | *With same salt |
| `VerifyPassword` | ✅ Yes | Constant-time comparison |
| `NeedsRehash` | ✅ Yes | Config comparison |
| `Hmac` | ✅ Yes | Same inputs → same signature |
| `VerifyHmac` | ✅ Yes | Constant-time comparison |
| `DeriveKey` | ✅ Yes | Same inputs → same key |
| `ConstantTimeEquals` | ✅ Yes | Timing-safe comparison |
| `HashFile` | ✅ Yes | Same content → same hash |
| `GenerateToken` | ❌ No | Random generation |
| `GenerateApiKey` | ❌ No | Random generation |
| `GenerateBytes` | ❌ No | Random generation |

## Hash Functions

### General Purpose Hashing

```isl
use @isl/crypto

behavior VerifyIntegrity {
  input {
    data: String
    expected_hash: String
  }

  post success {
    HashSHA256(input.data) == input.expected_hash
  }
}
```

### Supported Algorithms

- `SHA256` - SHA-2 256-bit (default)
- `SHA384` - SHA-2 384-bit
- `SHA512` - SHA-2 512-bit
- `SHA3_256` - SHA-3 256-bit
- `SHA3_512` - SHA-3 512-bit
- `BLAKE2B` - BLAKE2b
- `BLAKE3` - BLAKE3 (fast, modern)

## Password Hashing

Secure password hashing with configurable algorithms:

```isl
use @isl/crypto

behavior RegisterUser {
  input {
    password: String
  }

  post success {
    # Password is hashed, never stored plaintext
    result.password_hash == HashPassword(input.password)
  }

  invariants {
    password never stored plaintext
    password never logged
  }
}

behavior Login {
  input {
    email: String
    password: String
  }

  pre {
    # Verify password matches stored hash
    VerifyPassword(password, User.lookup(email).password_hash)
  }
}
```

### Password Hash Algorithms

- `BCRYPT` - bcrypt (default, 12 rounds)
- `ARGON2ID` - Argon2id (memory-hard)
- `SCRYPT` - scrypt (memory-hard)
- `PBKDF2` - PBKDF2-SHA256

## HMAC Signatures

For webhook verification and message authentication:

```isl
use @isl/crypto

behavior VerifyWebhook {
  input {
    payload: String
    signature: String
    secret: String
  }

  pre {
    # Verify HMAC signature
    VerifyHmac(payload, secret, signature, HMAC_SHA256)
  }
}
```

## Token Generation

Generate cryptographically secure tokens:

```isl
use @isl/crypto

behavior CreateSession {
  post success {
    # Generate secure session token
    result.token == GenerateToken(32, "base64url")
    result.api_key == GenerateApiKey("sk", 32)
  }
}
```

## Security Invariants

All functions in this module enforce:

- **Constant-time comparisons** for secrets
- **No logging** of passwords or secrets
- **Cryptographically secure** random sources
- **Industry-standard** algorithms

## Constants

- `DEFAULT_BCRYPT_ROUNDS` - 12
- `DEFAULT_ARGON2_MEMORY` - 65536 KB
- `DEFAULT_ARGON2_ITERATIONS` - 3
- `MIN_PASSWORD_LENGTH` - 8
- `DEFAULT_TOKEN_LENGTH` - 32
