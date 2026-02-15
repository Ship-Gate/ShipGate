/**
 * Endpoint inferrers - aggregate by framework.
 */

import type { InferredEndpoint } from '../../types.js';
import type { WebFramework } from '../../types.js';
import { inferNextJsEndpoints } from './nextjs-inferrer.js';
import { inferExpressEndpoints } from './express-inferrer.js';
import { inferFastifyEndpoints } from './fastify-inferrer.js';

export async function inferEndpoints(
  projectRoot: string,
  framework: WebFramework
): Promise<InferredEndpoint[]> {
  switch (framework) {
    case 'nextjs':
      return inferNextJsEndpoints(projectRoot);
    case 'express':
      return inferExpressEndpoints(projectRoot);
    case 'fastify':
      return inferFastifyEndpoints(projectRoot);
    default:
      const results: InferredEndpoint[] = [];
      results.push(...(await inferNextJsEndpoints(projectRoot)));
      results.push(...(await inferExpressEndpoints(projectRoot)));
      results.push(...(await inferFastifyEndpoints(projectRoot)));
      return results;
  }
}

export { inferNextJsEndpoints } from './nextjs-inferrer.js';
export { inferExpressEndpoints } from './express-inferrer.js';
export { inferFastifyEndpoints } from './fastify-inferrer.js';
