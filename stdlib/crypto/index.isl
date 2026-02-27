# Crypto Standard Library Module
# Provides cryptographic hashing and secure operations
#
# DETERMINISM NOTE:
# - Hash functions are DETERMINISTIC (same input → same hash)
# - Random functions are NON-DETERMINISTIC (generates random values)
# - HMAC functions are DETERMINISTIC
# - Key derivation is DETERMINISTIC given same inputs

module Crypto version "1.0.0"

# ============================================
# Types
# ============================================

type HashAlgorithm = enum {
  SHA256
  SHA384
  SHA512
  SHA3_256
  SHA3_512
  BLAKE2B
  BLAKE3
}

type PasswordHashAlgorithm = enum {
  BCRYPT
  ARGON2ID
  SCRYPT
  PBKDF2
}

type HmacAlgorithm = enum {
  HMAC_SHA256
  HMAC_SHA384
  HMAC_SHA512
}

type HashOutput = String {
  description: "Hexadecimal hash output"
  pattern: "^[a-f0-9]+$"
}

type PasswordHash = String {
  description: "Password hash with algorithm prefix"
  sensitive: true
}

type SecureToken = String {
  description: "Cryptographically random token"
  min_length: 16
  sensitive: true
}

type HmacSignature = String {
  description: "HMAC signature in hexadecimal"
  pattern: "^[a-f0-9]+$"
}

type SecretKey = String {
  description: "Secret key for HMAC or encryption"
  min_length: 16
  sensitive: true
}

# ============================================
# Entities
# ============================================

entity HashResult {
  algorithm: HashAlgorithm
  hash: HashOutput
  input_length: Int { min: 0 }

  invariants {
    algorithm == SHA256 implies hash.length == 64
    algorithm == SHA384 implies hash.length == 96
    algorithm == SHA512 implies hash.length == 128
  }
}

entity PasswordHashConfig {
  algorithm: PasswordHashAlgorithm
  # Bcrypt
  bcrypt_rounds: Int { min: 10, max: 31, default: 12 }
  # Argon2
  argon2_memory: Int { min: 16384, default: 65536 }  # KB
  argon2_iterations: Int { min: 1, max: 10, default: 3 }
  argon2_parallelism: Int { min: 1, max: 4, default: 1 }
  # Scrypt
  scrypt_n: Int { min: 16384, default: 32768 }
  scrypt_r: Int { min: 8, default: 8 }
  scrypt_p: Int { min: 1, default: 1 }
}

# ============================================
# Behaviors - Deterministic Hash Functions
# ============================================

behavior Hash {
  description: "Compute cryptographic hash of data (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
    algorithm: HashAlgorithm [default: SHA256]
  }

  output {
    success: HashResult
  }

  post success {
    result.algorithm == input.algorithm
    result.input_length == input.data.length
    result.hash.length > 0
    # Same input always produces same hash
    Hash(input.data, input.algorithm).hash == result.hash
  }

  temporal {
    within 10ms (p99): response returned
  }
}

behavior HashSHA256 {
  description: "Compute SHA-256 hash (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
  }

  output {
    success: HashOutput
  }

  post success {
    result.length == 64
  }
}

behavior HashSHA512 {
  description: "Compute SHA-512 hash (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
  }

  output {
    success: HashOutput
  }

  post success {
    result.length == 128
  }
}

behavior HashSHA3 {
  description: "Compute SHA-3 hash (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
    bits: Int [default: 256]  # 256 or 512
  }

  output {
    success: HashOutput

    errors {
      INVALID_BITS {
        when: "Bits must be 256 or 512"
        retriable: false
      }
    }
  }

  pre {
    bits in [256, 512]
  }

  post success {
    input.bits == 256 implies result.length == 64
    input.bits == 512 implies result.length == 128
  }
}

behavior HashBlake3 {
  description: "Compute BLAKE3 hash (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
    output_length: Int [default: 32]  # bytes
  }

  output {
    success: HashOutput
  }

  pre {
    output_length >= 1
    output_length <= 64
  }

  post success {
    result.length == input.output_length * 2
  }
}

# ============================================
# Behaviors - Password Hashing
# ============================================

behavior HashPassword {
  description: "Hash password for storage (DETERMINISTIC with same salt)"
  deterministic: true  # With same salt, produces same result

  input {
    password: String { sensitive: true }
    config: PasswordHashConfig?
  }

  output {
    success: PasswordHash

    errors {
      PASSWORD_TOO_SHORT {
        when: "Password must be at least 8 characters"
        retriable: false
      }
      PASSWORD_TOO_LONG {
        when: "Password exceeds maximum length for algorithm"
        retriable: false
      }
    }
  }

  pre {
    password.length >= 8
    password.length <= 1000
  }

  post success {
    # Hash includes algorithm identifier
    result.starts_with("$") or result.length >= 60
  }

  invariants {
    password never logged
    password never stored plaintext
  }
}

behavior VerifyPassword {
  description: "Verify password against hash (DETERMINISTIC)"
  deterministic: true

  input {
    password: String { sensitive: true }
    hash: PasswordHash
  }

  output {
    success: Boolean
  }

  post success {
    # True if and only if password matches hash
    result == true implies HashPassword(input.password) verifies against input.hash
  }

  temporal {
    # Constant-time comparison to prevent timing attacks
    within 100ms (p50): response returned
    within 500ms (p99): response returned
  }

  invariants {
    password never logged
    comparison is constant-time
  }
}

behavior NeedsRehash {
  description: "Check if password hash needs upgrading (DETERMINISTIC)"
  deterministic: true

  input {
    hash: PasswordHash
    config: PasswordHashConfig?
  }

  output {
    success: Boolean
  }

  post success {
    # True if hash uses weaker parameters than current config
  }
}

# ============================================
# Behaviors - HMAC Functions
# ============================================

behavior Hmac {
  description: "Compute HMAC signature (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
    key: SecretKey
    algorithm: HmacAlgorithm [default: HMAC_SHA256]
  }

  output {
    success: HmacSignature
  }

  post success {
    input.algorithm == HMAC_SHA256 implies result.length == 64
    input.algorithm == HMAC_SHA384 implies result.length == 96
    input.algorithm == HMAC_SHA512 implies result.length == 128
    # Same inputs always produce same signature
    Hmac(input.data, input.key, input.algorithm) == result
  }

  invariants {
    key never logged
  }
}

behavior VerifyHmac {
  description: "Verify HMAC signature (DETERMINISTIC)"
  deterministic: true

  input {
    data: String
    key: SecretKey
    signature: HmacSignature
    algorithm: HmacAlgorithm [default: HMAC_SHA256]
  }

  output {
    success: Boolean
  }

  post success {
    result == (Hmac(input.data, input.key, input.algorithm) == input.signature)
  }

  temporal {
    # Constant-time comparison
    within 10ms (p99): response returned
  }

  invariants {
    comparison is constant-time
  }
}

# ============================================
# Behaviors - Non-Deterministic Random Functions
# ============================================

behavior GenerateToken {
  description: "Generate cryptographically random token (NON-DETERMINISTIC)"
  deterministic: false

  input {
    length: Int { min: 16, max: 256, default: 32 }
    encoding: String [default: "hex"]  # "hex", "base64", "base64url"
  }

  output {
    success: SecureToken

    errors {
      INVALID_ENCODING {
        when: "Encoding must be hex, base64, or base64url"
        retriable: false
      }
    }
  }

  pre {
    encoding in ["hex", "base64", "base64url"]
  }

  post success {
    result.length >= input.length
  }

  invariants {
    uses cryptographically secure random source
  }
}

behavior GenerateApiKey {
  description: "Generate API key with prefix (NON-DETERMINISTIC)"
  deterministic: false

  input {
    prefix: String [default: "sk"]
    length: Int { min: 24, max: 64, default: 32 }
  }

  output {
    success: String
  }

  post success {
    result.starts_with(input.prefix + "_")
    result.length >= input.prefix.length + 1 + input.length
  }
}

behavior GenerateBytes {
  description: "Generate cryptographically random bytes (NON-DETERMINISTIC)"
  deterministic: false

  input {
    count: Int { min: 1, max: 1024 }
  }

  output {
    success: String  # Hex-encoded bytes
  }

  post success {
    result.length == input.count * 2
    result.matches("^[a-f0-9]+$")
  }

  invariants {
    uses cryptographically secure random source
  }
}

# ============================================
# Behaviors - Key Derivation
# ============================================

behavior DeriveKey {
  description: "Derive key from password using PBKDF2 (DETERMINISTIC with same salt)"
  deterministic: true

  input {
    password: String { sensitive: true }
    salt: String { min_length: 16 }
    iterations: Int { min: 100000, default: 600000 }
    key_length: Int { min: 16, max: 64, default: 32 }
    algorithm: HashAlgorithm [default: SHA256]
  }

  output {
    success: SecretKey
  }

  pre {
    salt.length >= 16
    iterations >= 100000
  }

  post success {
    result.length == input.key_length * 2  # Hex encoding
    # Same inputs always produce same key
    DeriveKey(input.password, input.salt, input.iterations, input.key_length, input.algorithm) == result
  }

  invariants {
    password never logged
  }
}

# ============================================
# Behaviors - Utility Functions
# ============================================

behavior ConstantTimeEquals {
  description: "Compare strings in constant time (DETERMINISTIC)"
  deterministic: true

  input {
    a: String
    b: String
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.a == input.b)
  }

  invariants {
    comparison time independent of string content
  }
}

behavior HashFile {
  description: "Compute hash of file content (DETERMINISTIC)"
  deterministic: true

  input {
    content: String
    algorithm: HashAlgorithm [default: SHA256]
  }

  output {
    success: HashResult
  }

  post success {
    result.algorithm == input.algorithm
  }
}

# ============================================
# Constants
# ============================================

const DEFAULT_BCRYPT_ROUNDS: Int = 12
const DEFAULT_ARGON2_MEMORY: Int = 65536
const DEFAULT_ARGON2_ITERATIONS: Int = 3
const MIN_PASSWORD_LENGTH: Int = 8
const DEFAULT_TOKEN_LENGTH: Int = 32
