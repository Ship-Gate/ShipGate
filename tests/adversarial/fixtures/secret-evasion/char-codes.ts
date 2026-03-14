/**
 * ADVERSARIAL FIXTURE: Hardcoded Secret via Character Code Construction
 *
 * Vulnerability: Secrets built from character codes at runtime
 * Evasion technique: The secret is encoded as an array of numeric char
 * codes and reconstructed via String.fromCharCode(). No string literal
 * in the source contains the secret pattern, so regex-based scanners
 * that search for "sk_live", "password", or "api_key" patterns in
 * source text will not find anything to flag.
 *
 * Constructed value: "sk_live_secret123"
 */

// "sk_live" as char codes
const LIVE_KEY_PREFIX = String.fromCharCode(115, 107, 95, 108, 105, 118, 101);

// "_secret123" as char codes
const LIVE_KEY_SUFFIX = String.fromCharCode(95, 115, 101, 99, 114, 101, 116, 49, 50, 51);

export function getApiKey(): string {
  return LIVE_KEY_PREFIX + LIVE_KEY_SUFFIX;
}

// "password" as char codes: 112, 97, 115, 115, 119, 111, 114, 100
const DB_PASSWORD_CODES = [112, 97, 115, 115, 119, 111, 114, 100];
const DB_PASSWORD_SUFFIX_CODES = [33, 64, 35, 36]; // "!@#$"

export function getDatabasePassword(): string {
  return String.fromCharCode(...DB_PASSWORD_CODES, ...DB_PASSWORD_SUFFIX_CODES);
}

// "ghp_" (GitHub personal access token prefix)
const GH_PREFIX = [103, 104, 112, 95];
const GH_TOKEN_BODY = [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76];

export function getGitHubToken(): string {
  const prefix = String.fromCharCode(...GH_PREFIX);
  const body = GH_TOKEN_BODY.map((c) => String.fromCharCode(c)).join("");
  return prefix + body + "1234567890abcdef12345678";
}

export function initializeServices() {
  const config = {
    payment: { key: getApiKey() },
    database: { password: getDatabasePassword() },
    github: { token: getGitHubToken() },
  };

  return config;
}
