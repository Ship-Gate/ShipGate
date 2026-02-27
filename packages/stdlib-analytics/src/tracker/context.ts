/**
 * Event context enrichment
 */

import type { EventContext } from './types.js';

const LIB_CONTEXT = {
  name: '@isl-lang/stdlib-analytics',
  version: '1.0.0',
};

export function enrichContext(ctx?: EventContext): EventContext {
  return {
    ...ctx,
    library: LIB_CONTEXT,
  };
}

export function mergeContext(base: EventContext | undefined, override: EventContext | undefined): EventContext {
  if (!base) return override ? { ...override, library: LIB_CONTEXT } : { library: LIB_CONTEXT };
  if (!override) return { ...base, library: LIB_CONTEXT };
  return {
    ...base,
    ...override,
    library: LIB_CONTEXT,
    custom: {
      ...base.custom,
      ...override.custom,
    },
  };
}
