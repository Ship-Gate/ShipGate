import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  KMSClient,
  DecryptCommand,
  EncryptCommand,
} from '@aws-sdk/client-kms';

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const KMS_KEY_ID = process.env.KMS_KEY_ARN;

interface SecretCache {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, SecretCache>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getSecret(secretName: string): Promise<string> {
  const cached = cache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsManager.send(command);

  const value = response.SecretString;
  if (!value) {
    throw new Error(`Secret ${secretName} has no string value`);
  }

  cache.set(secretName, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return value;
}

export async function getSecretJson<T>(secretName: string): Promise<T> {
  const raw = await getSecret(secretName);
  return JSON.parse(raw) as T;
}

export async function encryptData(plaintext: string): Promise<string> {
  if (!KMS_KEY_ID) {
    throw new Error('KMS_KEY_ARN environment variable is not set');
  }

  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext, 'utf-8'),
  });

  const response = await kmsClient.send(command);

  if (!response.CiphertextBlob) {
    throw new Error('KMS encryption returned no ciphertext');
  }

  return Buffer.from(response.CiphertextBlob).toString('base64');
}

export async function decryptData(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
  });

  const response = await kmsClient.send(command);

  if (!response.Plaintext) {
    throw new Error('KMS decryption returned no plaintext');
  }

  return Buffer.from(response.Plaintext).toString('utf-8');
}

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export async function getDatabaseConfig(): Promise<DatabaseConfig> {
  return getSecretJson<DatabaseConfig>('app/production/database');
}

export async function getStripeKeys(): Promise<{
  secretKey: string;
  webhookSecret: string;
}> {
  return getSecretJson('app/production/stripe');
}

export function clearSecretCache(): void {
  cache.clear();
}

export function invalidateSecret(secretName: string): void {
  cache.delete(secretName);
}
