/**
 * ADVERSARIAL FIXTURE: Hardcoded Secret via Base64 Encoding
 *
 * Vulnerability: Hardcoded API key disguised through base64 encoding
 * Evasion technique: The secret "sk_live_123456" is stored as its
 * base64 representation. Scanners that pattern-match for "sk_live_",
 * "api_key", or similar plaintext prefixes will miss the encoded form.
 * The secret only materializes at runtime via Buffer.from().toString().
 *
 * Decoded value: "sk_live_123456"
 */

const STRIPE_KEY_B64 = "c2tfbGl2ZV8xMjM0NTY=";

export function getStripeClient() {
  const key = Buffer.from(STRIPE_KEY_B64, "base64").toString("utf-8");

  return {
    apiKey: key,
    async createCharge(amount: number, currency: string) {
      const response = await fetch("https://api.stripe.com/v1/charges", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `amount=${amount}&currency=${currency}`,
      });
      return response.json();
    },
  };
}

const DB_PASS_ENCODED = Buffer.from("cGFzc3dvcmQxMjM=", "base64");

export function getDatabaseConfig() {
  return {
    host: "prod-db.internal.company.com",
    port: 5432,
    user: "admin",
    password: DB_PASS_ENCODED.toString(),
    database: "production",
  };
}

const AWS_SECRET_PARTS = [
  "d0FMclJ4",
  "TjJzS2Vm",
  "UThkWGtp",
];

export function getAwsCredentials() {
  const secret = Buffer.from(AWS_SECRET_PARTS.join(""), "base64").toString();
  return {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: secret,
    region: "us-east-1",
  };
}
