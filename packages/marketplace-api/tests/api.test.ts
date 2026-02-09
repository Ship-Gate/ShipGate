/**
 * Marketplace API – Integration Tests
 *
 * Uses Fastify's built-in inject() for zero-dependency HTTP testing.
 * Seed data is loaded in beforeAll so every describe block has packs to work with.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { MarketplaceStore } from '../src/db/store.js';
import { hashApiKey } from '../src/hooks/auth.js';
import { computeDigest } from '../src/hooks/signature.js';

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-secret-key-1234';
const TEST_API_KEY_HASH = hashApiKey(TEST_API_KEY);

const OTHER_API_KEY = 'other-author-key-5678';
const OTHER_API_KEY_HASH = hashApiKey(OTHER_API_KEY);

function seedStore(): MarketplaceStore {
  const store = new MarketplaceStore();

  // Authors
  const alice = store.addAuthor({
    username: 'alice',
    displayName: 'Alice Dev',
    email: 'alice@example.com',
    apiKeyHash: TEST_API_KEY_HASH,
  });

  const bob = store.addAuthor({
    username: 'bob',
    displayName: 'Bob Builder',
    email: 'bob@example.com',
    apiKeyHash: OTHER_API_KEY_HASH,
  });

  // Packs
  const authPack = store.addPack({
    name: 'auth-oauth',
    displayName: 'OAuth Auth Pack',
    description: 'OAuth2 authentication flows for ISL',
    authorId: alice.id,
    keywords: ['auth', 'oauth', 'login'],
    category: 'AUTH',
  });

  const payPack = store.addPack({
    name: 'payments-stripe',
    displayName: 'Stripe Payments',
    description: 'Stripe payment processing contracts',
    authorId: bob.id,
    keywords: ['payments', 'stripe', 'billing'],
    category: 'PAYMENT',
  });

  const dataPack = store.addPack({
    name: 'data-validator',
    displayName: 'Data Validator',
    description: 'Schema validation and transformation utilities',
    authorId: alice.id,
    keywords: ['data', 'validation', 'schema'],
    category: 'DATA',
  });

  // Versions
  const authV1 = store.addVersion({
    packId: authPack.id,
    version: '1.0.0',
    contract: 'intent AuthLogin { input { email: string } output { token: string } }',
    readme: '# OAuth Auth Pack\nProvides OAuth2 flows.',
  });

  store.addVersion({
    packId: authPack.id,
    version: '1.1.0',
    contract: 'intent AuthLogin { input { email: string; mfa?: string } output { token: string } }',
    changelog: 'Added optional MFA support',
  });

  store.addVersion({
    packId: payPack.id,
    version: '0.9.0',
    contract: 'intent Charge { input { amount: number; currency: string } output { id: string } }',
  });

  store.addVersion({
    packId: dataPack.id,
    version: '2.0.0',
    contract: 'intent Validate { input { schema: object; data: any } output { valid: boolean } }',
  });

  // Signatures for the latest auth version
  const latestAuthVer = store.getLatestVersion(authPack.id)!;
  store.addSignature({
    versionId: latestAuthVer.id,
    algorithm: 'sha256',
    digest: computeDigest(latestAuthVer.contract),
    signerId: alice.id,
    verified: false,
  });

  return store;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Marketplace API', () => {
  let app: FastifyInstance;
  let store: MarketplaceStore;

  beforeAll(async () => {
    store = seedStore();
    app = await buildServer({ store, logger: false });
  });

  // -----------------------------------------------------------------------
  // Health & info
  // -----------------------------------------------------------------------

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('marketplace-api');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('API Info', () => {
    it('should return API information', async () => {
      const res = await app.inject({ method: 'GET', url: '/api' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.name).toBe('Marketplace API');
      expect(body.version).toBe('0.1.0');
      expect(body.endpoints.packs).toBeDefined();
      expect(body.endpoints.search).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // List packs
  // -----------------------------------------------------------------------

  describe('GET /api/packs', () => {
    it('should return list of packs with pagination', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(body.packs)).toBe(true);
      expect(body.packs.length).toBe(3);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(20);
      expect(body.pagination.offset).toBe(0);
    });

    it('should support limit and offset', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs?limit=1&offset=1' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.packs.length).toBe(1);
      expect(body.pagination.limit).toBe(1);
      expect(body.pagination.offset).toBe(1);
      expect(body.pagination.hasMore).toBe(true);
    });

    it('should filter by category', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs?category=AUTH' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.packs.length).toBe(1);
      expect(body.packs[0].category).toBe('AUTH');
    });

    it('should filter by author', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs?author=alice' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.packs.length).toBe(2);
      body.packs.forEach((p: any) => expect(p.author).toBe('alice'));
    });
  });

  // -----------------------------------------------------------------------
  // Get single pack
  // -----------------------------------------------------------------------

  describe('GET /api/packs/:name', () => {
    it('should return pack details with signatures', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/auth-oauth' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.name).toBe('auth-oauth');
      expect(body.displayName).toBe('OAuth Auth Pack');
      expect(body.author).toBe('alice');
      expect(body.version).toBe('1.1.0');
      expect(body.signatures).toBeDefined();
      expect(Array.isArray(body.signatures)).toBe(true);
      expect(body.signatures.length).toBeGreaterThanOrEqual(1);
      expect(body.signatures[0].algorithm).toBe('sha256');
      expect(body.signatures[0].digest).toBeDefined();
    });

    it('should return 404 for non-existent pack', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/does-not-exist' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Not Found');
    });
  });

  // -----------------------------------------------------------------------
  // Versions
  // -----------------------------------------------------------------------

  describe('GET /api/packs/:name/versions', () => {
    it('should list all versions', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/auth-oauth/versions' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.packName).toBe('auth-oauth');
      expect(body.versions.length).toBe(2);
      expect(body.versions[0].version).toBe('1.1.0');
      expect(body.versions[0].isLatest).toBe(true);
      expect(body.versions[1].version).toBe('1.0.0');
      expect(body.versions[1].isLatest).toBe(false);
    });

    it('should return 404 for non-existent pack', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/nope/versions' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/packs/:name/versions/:version', () => {
    it('should return specific version with signatures', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/auth-oauth/versions/1.1.0' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.version).toBe('1.1.0');
      expect(body.contract).toContain('AuthLogin');
      expect(body.isLatest).toBe(true);
      expect(body.signatures).toBeDefined();
    });

    it('should resolve "latest" alias', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/auth-oauth/versions/latest' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.version).toBe('1.1.0');
    });

    it('should return 404 for non-existent version', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/auth-oauth/versions/9.9.9' });
      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // Publish (auth required)
  // -----------------------------------------------------------------------

  describe('POST /api/packs (publish)', () => {
    it('should reject requests without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        payload: {
          name: 'new-pack',
          displayName: 'New Pack',
          description: 'A brand new pack for testing',
          version: '1.0.0',
          contract: 'intent NewThing { input { x: number } output { y: number } }',
        },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Unauthorized');
    });

    it('should reject invalid API key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: 'Bearer bad-key' },
        payload: {
          name: 'new-pack',
          displayName: 'New Pack',
          description: 'A brand new pack for testing',
          version: '1.0.0',
          contract: 'intent NewThing { input { x: number } output { y: number } }',
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should publish a new pack with valid auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          name: 'my-new-pack',
          displayName: 'My New Pack',
          description: 'A brand new ISL pack for testing purposes',
          version: '1.0.0',
          contract: 'intent HelloWorld { input { name: string } output { greeting: string } }',
          keywords: ['hello', 'world'],
          category: 'GENERAL',
        },
      });
      const body = res.json();
      expect(res.statusCode).toBe(201);
      expect(body.message).toBe('Pack published successfully');
      expect(body.pack.name).toBe('my-new-pack');
      expect(body.pack.author).toBe('alice');
      expect(body.version.version).toBe('1.0.0');
      expect(body.version.isLatest).toBe(true);
      expect(body.signature.algorithm).toBe('sha256');
      expect(body.signature.digest).toBeDefined();
    });

    it('should publish a new version to an existing pack', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          name: 'my-new-pack',
          displayName: 'My New Pack',
          description: 'A brand new ISL pack for testing purposes',
          version: '1.1.0',
          contract: 'intent HelloWorld { input { name: string; lang?: string } output { greeting: string } }',
          changelog: 'Added language support',
        },
      });
      const body = res.json();
      expect(res.statusCode).toBe(201);
      expect(body.version.version).toBe('1.1.0');
    });

    it('should reject lower version number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          name: 'my-new-pack',
          displayName: 'My New Pack',
          description: 'A brand new ISL pack for testing purposes',
          version: '0.5.0',
          contract: 'intent HelloWorld { input { name: string } output { greeting: string } }',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Version Error');
    });

    it('should reject publish by non-owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${OTHER_API_KEY}` },
        payload: {
          name: 'my-new-pack',
          displayName: 'My New Pack',
          description: 'Trying to hijack this pack',
          version: '2.0.0',
          contract: 'intent Hijack { input { x: number } output { y: number } }',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('Forbidden');
    });

    it('should validate required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Validation Error');
      expect(res.json().details.length).toBeGreaterThan(0);
    });

    it('should validate name format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          name: 'INVALID NAME!',
          displayName: 'Test',
          description: 'Test description text',
          version: '1.0.0',
          contract: 'intent Test { input { x: number } output { y: number } }',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should validate semver format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          name: 'semver-test',
          displayName: 'Semver Test',
          description: 'Testing bad version string',
          version: 'not-semver',
          contract: 'intent Test { input { x: number } output { y: number } }',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  describe('GET /api/search', () => {
    it('should require query parameter', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search' });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('"q"');
    });

    it('should find packs by name', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search?q=auth' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.query).toBe('auth');
      expect(body.results.length).toBeGreaterThanOrEqual(1);
      expect(body.results[0].name).toBe('auth-oauth');
    });

    it('should find packs by keyword', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search?q=stripe' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.results.length).toBeGreaterThanOrEqual(1);
      expect(body.results.some((r: any) => r.name === 'payments-stripe')).toBe(true);
    });

    it('should find packs by description words', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search?q=validation' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.results.some((r: any) => r.name === 'data-validator')).toBe(true);
    });

    it('should return empty for non-matching query', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search?q=zzzzzzzzz' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.total).toBe(0);
      expect(body.results.length).toBe(0);
    });

    it('should filter by category', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search?q=auth&category=AUTH' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      body.results.forEach((r: any) => expect(r.category).toBe('AUTH'));
    });
  });

  // -----------------------------------------------------------------------
  // Fetch after publish (round-trip)
  // -----------------------------------------------------------------------

  describe('Publish → Fetch round-trip', () => {
    it('published pack should be fetchable', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs/my-new-pack' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.name).toBe('my-new-pack');
      expect(body.version).toBe('1.1.0');
      expect(body.author).toBe('alice');
      expect(body.signatures.length).toBeGreaterThanOrEqual(1);
      expect(body.signatures[0].digest).toBeDefined();
    });

    it('published pack should appear in search results', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/search?q=hello' });
      const body = res.json();
      expect(res.statusCode).toBe(200);
      expect(body.results.some((r: any) => r.name === 'my-new-pack')).toBe(true);
    });

    it('published pack should appear in list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/packs' });
      const body = res.json();
      expect(body.packs.some((p: any) => p.name === 'my-new-pack')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Signature / hash metadata
  // -----------------------------------------------------------------------

  describe('Signature metadata', () => {
    it('should store sha256 digest on publish', async () => {
      const contract = 'intent SigTest { input { a: number } output { b: number } }';
      const expectedDigest = computeDigest(contract);

      const pub = await app.inject({
        method: 'POST',
        url: '/api/packs',
        headers: { authorization: `Bearer ${TEST_API_KEY}` },
        payload: {
          name: 'sig-test-pack',
          displayName: 'Signature Test',
          description: 'Testing signature storage in the marketplace',
          version: '1.0.0',
          contract,
        },
      });
      expect(pub.statusCode).toBe(201);
      expect(pub.json().signature.digest).toBe(expectedDigest);
      expect(pub.json().signature.algorithm).toBe('sha256');

      // Verify digest is also returned on GET
      const get = await app.inject({ method: 'GET', url: '/api/packs/sig-test-pack' });
      const sigs = get.json().signatures;
      expect(sigs.length).toBeGreaterThanOrEqual(1);
      expect(sigs[0].digest).toBe(expectedDigest);
    });
  });

  // -----------------------------------------------------------------------
  // 404 fallback
  // -----------------------------------------------------------------------

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/unknown-endpoint' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Not Found');
    });
  });
});
