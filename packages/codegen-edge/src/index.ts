// ============================================================================
// ISL Edge Computing Code Generator
// Generates edge-optimized code for modern edge platforms
// ============================================================================

export { generate, type EdgeGenOptions, type EdgeGenResult } from './generator';
export { generateCloudflare } from './targets/cloudflare';
export { generateDeno } from './targets/deno';
export { generateVercel } from './targets/vercel';
export { generateNetlify } from './targets/netlify';
export * from './types';
