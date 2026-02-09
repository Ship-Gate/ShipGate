/**
 * Pack routes – publish, list, get, get version.
 */

import { z } from 'zod';
import semver from 'semver';
import type { FastifyInstance } from 'fastify';
import type { MarketplaceStore } from '../db/store.js';
import type { Author, PackCategory } from '../types.js';
import { PACK_CATEGORIES } from '../types.js';
import { createAuthHook } from '../hooks/auth.js';
import { processSignature } from '../hooks/signature.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const publishPackSchema = z.object({
  name: z.string()
    .min(2).max(128)
    .regex(/^[a-z@][a-z0-9/_-]*[a-z0-9]$/, 'Name must be lowercase with hyphens/slashes'),
  displayName: z.string().min(2).max(256),
  description: z.string().min(5).max(2000),
  version: z.string().refine(v => semver.valid(v) !== null, 'Invalid semver version'),
  contract: z.string().min(10),
  repository: z.string().url().optional(),
  license: z.string().max(32).default('MIT'),
  keywords: z.array(z.string()).default([]),
  category: z.enum(PACK_CATEGORIES as [string, ...string[]]).default('GENERAL'),
  readme: z.string().optional(),
  changelog: z.string().optional(),
  signature: z.string().optional(), // optional base64 detached signature
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerPackRoutes(app: FastifyInstance, store: MarketplaceStore): void {
  const authHook = createAuthHook(store);

  // -----------------------------------------------------------------------
  // POST /api/packs  – Publish a pack (creates pack + first version, or
  //                     adds a version to an existing pack owned by the author)
  // -----------------------------------------------------------------------
  app.post('/api/packs', { preHandler: [authHook] }, async (request, reply) => {
    const parsed = publishPackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parsed.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const input = parsed.data;
    const author = (request as any).author as Author;

    // Upsert pack
    let pack = store.getPackByName(input.name);

    if (pack) {
      // Verify ownership
      if (pack.authorId !== author.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Pack '${input.name}' is owned by another author`,
        });
      }

      // Validate version is newer
      const latest = store.getLatestVersion(pack.id);
      if (latest && !semver.gt(input.version, latest.version)) {
        return reply.status(400).send({
          error: 'Version Error',
          message: `Version ${input.version} must be greater than current latest ${latest.version}`,
        });
      }
    } else {
      // Create new pack
      pack = store.addPack({
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        authorId: author.id,
        repository: input.repository ?? null,
        license: input.license,
        keywords: input.keywords,
        category: input.category as PackCategory,
      });
    }

    // Create version
    const version = store.addVersion({
      packId: pack.id,
      version: input.version,
      contract: input.contract,
      readme: input.readme ?? null,
      changelog: input.changelog ?? null,
    });

    // Process signature / hash
    const sigResult = processSignature(store, version.id, author, {
      contract: input.contract,
      signature: input.signature ?? null,
    });

    return reply.status(201).send({
      message: 'Pack published successfully',
      pack: {
        name: pack.name,
        displayName: pack.displayName,
        author: author.username,
        category: pack.category,
      },
      version: {
        version: version.version,
        isLatest: version.isLatest,
        publishedAt: version.publishedAt,
      },
      signature: {
        algorithm: sigResult.algorithm,
        digest: sigResult.digest,
        verified: sigResult.verified,
      },
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/packs  – List packs with pagination & filtering
  // -----------------------------------------------------------------------
  app.get('/api/packs', async (request) => {
    const qs = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(qs.limit ?? '20', 10) || 20, 100);
    const offset = parseInt(qs.offset ?? '0', 10) || 0;

    const { packs, total } = store.listPacks({
      limit,
      offset,
      category: qs.category as PackCategory | undefined,
      author: qs.author,
      verified: qs.verified === 'true' ? true : qs.verified === 'false' ? false : undefined,
      sortBy: (qs.sort as any) ?? 'downloads',
      sortOrder: (qs.order as any) ?? 'desc',
    });

    return {
      packs: packs.map(p => ({
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        author: p.authorUsername ?? p.authorId,
        category: p.category,
        version: p.latestVersion?.version ?? '0.0.0',
        downloads: p.downloads,
        stars: p.stars,
        isVerified: p.isVerified,
        createdAt: p.createdAt,
      })),
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/packs/:name  – Get a single pack
  // -----------------------------------------------------------------------
  app.get('/api/packs/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const pack = store.getPackByName(name);

    if (!pack) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Pack '${name}' not found`,
      });
    }

    store.incrementDownloads(pack.id);
    const latest = store.getLatestVersion(pack.id);
    const author = store.getAuthorById(pack.authorId);
    const sigs = latest ? store.getSignaturesByVersion(latest.id) : [];

    return {
      name: pack.name,
      displayName: pack.displayName,
      description: pack.description,
      author: author?.username ?? pack.authorId,
      repository: pack.repository,
      license: pack.license,
      keywords: pack.keywords,
      category: pack.category,
      version: latest?.version ?? '0.0.0',
      contract: latest?.contract,
      readme: latest?.readme,
      downloads: pack.downloads,
      stars: pack.stars,
      isVerified: pack.isVerified,
      isDeprecated: pack.isDeprecated,
      signatures: sigs.map(s => ({
        algorithm: s.algorithm,
        digest: s.digest,
        verified: s.verified,
      })),
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/packs/:name/versions  – List versions
  // -----------------------------------------------------------------------
  app.get('/api/packs/:name/versions', async (request, reply) => {
    const { name } = request.params as { name: string };
    const pack = store.getPackByName(name);

    if (!pack) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Pack '${name}' not found`,
      });
    }

    const versions = store.getVersionsByPack(pack.id);

    return {
      packName: name,
      versions: versions.map(v => {
        const sigs = store.getSignaturesByVersion(v.id);
        return {
          version: v.version,
          isLatest: v.isLatest,
          publishedAt: v.publishedAt,
          downloads: v.downloads,
          changelog: v.changelog,
          signatures: sigs.map(s => ({
            algorithm: s.algorithm,
            digest: s.digest,
            verified: s.verified,
          })),
        };
      }),
    };
  });

  // -----------------------------------------------------------------------
  // GET /api/packs/:name/versions/:version  – Get specific version
  // -----------------------------------------------------------------------
  app.get('/api/packs/:name/versions/:version', async (request, reply) => {
    const { name, version } = request.params as { name: string; version: string };
    const pack = store.getPackByName(name);

    if (!pack) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Pack '${name}' not found`,
      });
    }

    const ver = store.getVersion(pack.id, version);
    if (!ver) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Version '${version}' of pack '${name}' not found`,
      });
    }

    const sigs = store.getSignaturesByVersion(ver.id);

    return {
      packName: name,
      version: ver.version,
      contract: ver.contract,
      readme: ver.readme,
      changelog: ver.changelog,
      isLatest: ver.isLatest,
      publishedAt: ver.publishedAt,
      downloads: ver.downloads,
      signatures: sigs.map(s => ({
        algorithm: s.algorithm,
        digest: s.digest,
        verified: s.verified,
      })),
    };
  });
}
