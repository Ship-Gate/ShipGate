# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: hash, hashSHA256, hashSHA512, hashSHA3, hashBlake3, hashPassword, verifyPassword, needsRehash, hmac, verifyHmac, generateToken, generateApiKey, generateBytes, deriveKey, constantTimeEquals, hashFile, DEFAULT_BCRYPT_ROUNDS, DEFAULT_ARGON2_MEMORY, DEFAULT_ARGON2_ITERATIONS, MIN_PASSWORD_LENGTH, DEFAULT_TOKEN_LENGTH, Crypto, HashAlgorithm, PasswordHashAlgorithm, HmacAlgorithm, HashResult, PasswordHashConfig
# dependencies: 

domain Crypto {
  version: "1.0.0"

  type HashAlgorithm = String
  type PasswordHashAlgorithm = String
  type HmacAlgorithm = String
  type HashResult = String
  type PasswordHashConfig = String

  invariants exports_present {
    - true
  }
}
