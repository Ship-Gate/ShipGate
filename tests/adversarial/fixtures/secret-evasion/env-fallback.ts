/**
 * ADVERSARIAL FIXTURE: Hardcoded Secret via Environment Variable Fallback
 *
 * Vulnerability: Hardcoded secrets used as fallback values for env vars
 * Evasion technique: The code reads from process.env first, which looks
 * safe. But the fallback value after `||` or `??` IS a real production
 * secret. Scanners that whitelist any code reading from process.env may
 * not inspect the fallback branch. In CI or misconfigured deployments
 * where the env var is unset, the hardcoded secret is used directly.
 *
 * Hardcoded fallback: "sk_live_fallback_key_12345"
 */

export function getConfig() {
  const stripeKey = process.env.STRIPE_API_KEY || "sk_live_fallback_key_12345";

  const dbPassword = process.env.DB_PASSWORD ?? "SuperSecretProd!2024";

  const jwtSecret = process.env.JWT_SECRET || "jwt-hmac-secret-do-not-share-xK9mP2";

  return {
    stripe: {
      apiKey: stripeKey,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "whsec_live_abc123def456",
    },
    database: {
      host: process.env.DB_HOST || "prod-database.internal.io",
      port: parseInt(process.env.DB_PORT || "5432"),
      password: dbPassword,
      connectionString:
        process.env.DATABASE_URL ||
        `postgresql://admin:${dbPassword}@prod-database.internal.io:5432/myapp`,
    },
    auth: {
      jwtSecret,
      sessionSecret: process.env.SESSION_SECRET || "keyboard-cat-but-actually-prod",
    },
  };
}

export function getExternalServiceKeys() {
  return {
    sendgrid: process.env.SENDGRID_API_KEY || "SG.real_sendgrid_key_here_abc123",
    twilio: {
      sid: process.env.TWILIO_SID || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      token: process.env.TWILIO_TOKEN || "auth_token_1234567890abcdef",
    },
    openai: process.env.OPENAI_API_KEY || "sk-proj-abc123def456ghi789jkl012mno345",
  };
}
