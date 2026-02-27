/**
 * Node.js built-in modules list
 * @module @isl-lang/hallucination-scanner/ts/builtins
 */

/**
 * Complete set of Node.js built-in module names (without "node:" prefix).
 * Based on Node.js 20.x LTS.
 */
export const NODE_BUILTINS = new Set<string>([
  '_http_agent',
  '_http_client',
  '_http_common',
  '_http_incoming',
  '_http_outgoing',
  '_http_server',
  '_stream_duplex',
  '_stream_passthrough',
  '_stream_readable',
  '_stream_transform',
  '_stream_wrap',
  '_stream_writable',
  '_tls_common',
  '_tls_wrap',
  'assert',
  'assert/strict',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'dns/promises',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'inspector/promises',
  'module',
  'net',
  'os',
  'path',
  'path/posix',
  'path/win32',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'readline/promises',
  'repl',
  'stream',
  'stream/consumers',
  'stream/promises',
  'stream/web',
  'string_decoder',
  'sys',
  'test',
  'timers',
  'timers/promises',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'util/types',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

/**
 * Check if a module specifier refers to a Node.js built-in.
 * Handles both "fs" and "node:fs" forms.
 */
export function isNodeBuiltin(specifier: string): boolean {
  if (specifier.startsWith('node:')) {
    return NODE_BUILTINS.has(specifier.slice(5));
  }
  return NODE_BUILTINS.has(specifier);
}

/**
 * Check if a specifier uses the "node:" prefix scheme but is NOT a real builtin.
 */
export function isFakeNodeBuiltin(specifier: string): boolean {
  if (!specifier.startsWith('node:')) return false;
  return !NODE_BUILTINS.has(specifier.slice(5));
}
