/**
 * ADVERSARIAL FIXTURE: Hardcoded Secret via String Reversal
 *
 * Vulnerability: Secrets stored as reversed strings in source code
 * Evasion technique: The secret is written backwards in the source.
 * At runtime it's reversed to produce the real key. Pattern matchers
 * scanning for "sk_live_" or "ghp_" prefixes won't match the reversed
 * form "evil_ks" or "_phg". This is a common obfuscation in malware
 * that occasionally appears in "clever" application code.
 *
 * Reversed value: "654321_evil_ks" -> "sk_live_123456"
 */

function deobfuscate(encoded: string): string {
  return encoded.split("").reverse().join("");
}

const PAYMENT_KEY_REV = "654321_evil_ks";
const GH_TOKEN_REV = "fedcba0987654321_phg";
const AWS_KEY_REV = "ELPMAXE7NNDOFSFOAIKIA";

export function getPaymentKey(): string {
  const key = deobfuscate(PAYMENT_KEY_REV);
  return key;
}

export function getGitHubConfig() {
  const token = GH_TOKEN_REV.split("").reverse().join("");
  return {
    auth: token,
    baseUrl: "https://api.github.com",
  };
}

export function getCloudCredentials() {
  const accessKeyId = AWS_KEY_REV.split("").reverse().join("");
  const secretKey = "YCifRxPb/GNEDMk7/IMEnFtUXrlAJw"
    .split("")
    .reverse()
    .join("");

  return {
    provider: "aws",
    credentials: {
      accessKeyId,
      secretAccessKey: secretKey,
      region: "us-east-1",
    },
  };
}

const rot13 = (s: string) =>
  s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });

export function getObfuscatedApiKey(): string {
  // ROT13 of "sk_live_abcdef123"
  const encoded = "fx_yvir_nopqrs123";
  return rot13(encoded);
}
