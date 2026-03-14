/**
 * ADVERSARIAL FIXTURE: Hardcoded Secret via String Split + Concatenation
 *
 * Vulnerability: Hardcoded API keys assembled from partial strings
 * Evasion technique: The secret is split across multiple variables and
 * only concatenated at the point of use. Pattern-matching scanners that
 * look for complete secret patterns like "sk_live_..." in a single
 * string literal will not flag individual fragments.
 *
 * Assembled value: "sk_live_1234567890"
 */

const PROVIDER_PREFIX = "sk";
const ENV_MARKER = "live";
const SEPARATOR = "_";
const KEY_BODY = "1234567890";

function assembleKey(...parts: string[]): string {
  return parts.join(SEPARATOR);
}

export function getPaymentConfig() {
  const part1 = "sk_live_";
  const part2 = "1234567890";
  const apiKey = part1 + part2;

  return {
    provider: "stripe",
    apiKey,
    webhookSecret: "whsec" + SEPARATOR + "test" + SEPARATOR + "secret123",
  };
}

export function getEmailServiceKey() {
  const prefix = "SG.";
  const middle = "abcdefghijklmnop";
  const suffix = ".qrstuvwxyz123456";

  return {
    service: "sendgrid",
    key: prefix + middle + suffix,
  };
}

export function getMultiCloudConfig() {
  const stripeKey = assembleKey(PROVIDER_PREFIX, ENV_MARKER, KEY_BODY);

  const awsParts = {
    id: "AKIA" + "IOSF" + "ODNN" + "7EXA" + "MPLE",
    secret: ["wJalr", "XUtnF", "EMI/K", "7MDENG", "/bPxRfiCY"].join(""),
  };

  return {
    stripe: { apiKey: stripeKey },
    aws: {
      accessKeyId: awsParts.id,
      secretAccessKey: awsParts.secret,
    },
  };
}
