/**
 * Marketplace API – Entry point
 *
 * Starts the Fastify server for the ISL Marketplace.
 */

import { buildServer } from './server.js';

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = await buildServer({ logger: true });

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

export { buildServer } from './server.js';
export { MarketplaceStore } from './db/store.js';
export type { Author, Pack, PackVersion, Signature, PackCategory } from './types.js';
