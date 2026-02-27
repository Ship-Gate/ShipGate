/**
 * ISL Standard Library - URL Module
 * Provides URL parsing and manipulation operations
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 */

// ============================================
// Types
// ============================================

export interface ParsedURL {
  href: string;
  protocol: string;
  host: string;
  hostname: string;
  port: number | null;
  pathname: string;
  search: string | null;
  query: string | null;
  hash: string | null;
  fragment: string | null;
  origin: string;
  username: string | null;
  password: string | null;
}

export interface URLComponents {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: number;
  pathname?: string;
  query?: Record<string, string | string[]>;
  fragment?: string;
}

export interface QueryParams {
  params: Record<string, string | string[]>;
}

export interface URLParseResult {
  success: boolean;
  url?: ParsedURL;
  error_message?: string;
}

// ============================================
// Parsing
// ============================================

/**
 * Parse URL string into components (DETERMINISTIC)
 */
export function parse(urlString: string, base?: string): ParsedURL {
  try {
    const url = base ? new URL(urlString, base) : new URL(urlString);
    
    return {
      href: url.href,
      protocol: url.protocol.replace(':', ''),
      host: url.host,
      hostname: url.hostname,
      port: url.port ? parseInt(url.port, 10) : null,
      pathname: url.pathname,
      search: url.search || null,
      query: url.search ? url.search.slice(1) : null,
      hash: url.hash || null,
      fragment: url.hash ? url.hash.slice(1) : null,
      origin: url.origin,
      username: url.username || null,
      password: url.password || null,
    };
  } catch {
    throw new Error('INVALID_URL: URL string is malformed');
  }
}

/**
 * Try to parse URL, returning result object (DETERMINISTIC)
 */
export function tryParse(urlString: string, base?: string): URLParseResult {
  try {
    const url = parse(urlString, base);
    return { success: true, url };
  } catch (e) {
    return {
      success: false,
      error_message: e instanceof Error ? e.message : 'Invalid URL',
    };
  }
}

/**
 * Parse query string into parameters (DETERMINISTIC)
 */
export function parseQuery(query: string, decode = true): QueryParams {
  const params: Record<string, string | string[]> = {};
  
  // Remove leading ?
  if (query.startsWith('?')) {
    query = query.slice(1);
  }
  
  if (!query) return { params };
  
  for (const part of query.split('&')) {
    const [rawKey, rawValue = ''] = part.split('=');
    if (rawKey === undefined) continue;
    const key = decode ? decodeURIComponent(rawKey) : rawKey;
    const value = decode ? decodeURIComponent(rawValue) : rawValue;
    
    if (key in params) {
      const existing = params[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (existing !== undefined) {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  }
  
  return { params };
}

// ============================================
// Component Access
// ============================================

/**
 * Get URL protocol (DETERMINISTIC)
 */
export function getProtocol(urlString: string): string {
  return parse(urlString).protocol;
}

/**
 * Get URL host (hostname:port) (DETERMINISTIC)
 */
export function getHost(urlString: string): string {
  return parse(urlString).host;
}

/**
 * Get URL hostname (without port) (DETERMINISTIC)
 */
export function getHostname(urlString: string): string {
  return parse(urlString).hostname;
}

/**
 * Get URL port (DETERMINISTIC)
 */
export function getPort(urlString: string): number | null {
  return parse(urlString).port;
}

/**
 * Get URL pathname (DETERMINISTIC)
 */
export function getPathname(urlString: string): string {
  return parse(urlString).pathname;
}

/**
 * Get URL search/query string with ? (DETERMINISTIC)
 */
export function getSearch(urlString: string): string | null {
  return parse(urlString).search;
}

/**
 * Get URL hash/fragment with # (DETERMINISTIC)
 */
export function getHash(urlString: string): string | null {
  return parse(urlString).hash;
}

/**
 * Get URL origin (protocol + host) (DETERMINISTIC)
 */
export function getOrigin(urlString: string): string {
  return parse(urlString).origin;
}

// ============================================
// Query Parameters
// ============================================

/**
 * Get single query parameter value (DETERMINISTIC)
 */
export function getQueryParam(urlString: string, name: string, defaultValue?: string): string | undefined {
  const parsed = parse(urlString);
  if (!parsed.query) return defaultValue;
  
  const params = parseQuery(parsed.query);
  const value = params.params[name];
  
  if (value === undefined) return defaultValue;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Get all query parameters (DETERMINISTIC)
 */
export function getQueryParams(urlString: string): QueryParams {
  const parsed = parse(urlString);
  if (!parsed.query) return { params: {} };
  return parseQuery(parsed.query);
}

/**
 * Get all values for a query parameter (DETERMINISTIC)
 */
export function getQueryParamAll(urlString: string, name: string): string[] {
  const parsed = parse(urlString);
  if (!parsed.query) return [];
  
  const params = parseQuery(parsed.query);
  const value = params.params[name];
  
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Check if query parameter exists (DETERMINISTIC)
 */
export function hasQueryParam(urlString: string, name: string): boolean {
  const parsed = parse(urlString);
  if (!parsed.query) return false;
  
  const params = parseQuery(parsed.query);
  return name in params.params;
}

/**
 * Set query parameter value (DETERMINISTIC)
 */
export function setQueryParam(urlString: string, name: string, value: string): string {
  const url = new URL(urlString);
  url.searchParams.set(name, value);
  return url.href;
}

/**
 * Set multiple query parameters (DETERMINISTIC)
 */
export function setQueryParams(urlString: string, params: Record<string, string>): string {
  const url = new URL(urlString);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

/**
 * Remove query parameter (DETERMINISTIC)
 */
export function removeQueryParam(urlString: string, name: string): string {
  const url = new URL(urlString);
  url.searchParams.delete(name);
  return url.href;
}

/**
 * Remove all query parameters (DETERMINISTIC)
 */
export function clearQueryParams(urlString: string): string {
  const url = new URL(urlString);
  url.search = '';
  return url.href;
}

// ============================================
// Building URLs
// ============================================

/**
 * Build URL from components (DETERMINISTIC)
 */
export function build(components: URLComponents): string {
  if (!components.hostname) {
    throw new Error('MISSING_HOSTNAME: Hostname is required');
  }
  if (!components.protocol) {
    throw new Error('MISSING_PROTOCOL: Protocol is required');
  }
  
  let url = `${components.protocol}://`;
  
  if (components.username) {
    url += components.username;
    if (components.password) {
      url += `:${components.password}`;
    }
    url += '@';
  }
  
  url += components.hostname;
  
  if (components.port) {
    url += `:${components.port}`;
  }
  
  if (components.pathname) {
    url += components.pathname.startsWith('/') ? components.pathname : `/${components.pathname}`;
  }
  
  if (components.query && Object.keys(components.query).length > 0) {
    url += '?' + buildQuery(components.query);
  }
  
  if (components.fragment) {
    url += `#${components.fragment}`;
  }
  
  return url;
}

/**
 * Build query string from parameters (DETERMINISTIC)
 */
export function buildQuery(params: Record<string, string | string[]>, encode = true): string {
  const parts: string[] = [];
  
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        const k = encode ? encodeURIComponent(key) : key;
        const val = encode ? encodeURIComponent(v) : v;
        parts.push(`${k}=${val}`);
      }
    } else {
      const k = encode ? encodeURIComponent(key) : key;
      const val = encode ? encodeURIComponent(value) : value;
      parts.push(`${k}=${val}`);
    }
  }
  
  return parts.join('&');
}

/**
 * Join URL with path segments (DETERMINISTIC)
 */
export function join(baseUrl: string, segments: string[]): string {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, '');
  const joinedSegments = segments.map(s => s.replace(/^\/|\/$/g, '')).join('/');
  url.pathname = `${basePath}/${joinedSegments}`;
  return url.href;
}

/**
 * Resolve relative URL against base (DETERMINISTIC)
 */
export function resolve(baseUrl: string, relative: string): string {
  return new URL(relative, baseUrl).href;
}

// ============================================
// Validation
// ============================================

/**
 * Check if string is a valid URL (DETERMINISTIC)
 */
export function isValid(urlString: string): boolean {
  return tryParse(urlString).success;
}

/**
 * Check if URL is absolute (DETERMINISTIC)
 */
export function isAbsolute(urlString: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(urlString);
}

/**
 * Check if URL is relative (DETERMINISTIC)
 */
export function isRelative(urlString: string): boolean {
  return !isAbsolute(urlString);
}

/**
 * Check if URL uses HTTPS (DETERMINISTIC)
 */
export function isHttps(urlString: string): boolean {
  return getProtocol(urlString).toLowerCase() === 'https';
}

/**
 * Check if two URLs have same origin (DETERMINISTIC)
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  return getOrigin(url1) === getOrigin(url2);
}

// ============================================
// Normalization
// ============================================

interface NormalizeOptions {
  lowercase_scheme?: boolean;
  lowercase_host?: boolean;
  remove_default_port?: boolean;
  remove_trailing_slash?: boolean;
  sort_query_params?: boolean;
  remove_empty_query_params?: boolean;
}

/**
 * Normalize URL (DETERMINISTIC)
 */
export function normalize(urlString: string, options?: NormalizeOptions): string {
  const opts: NormalizeOptions = {
    lowercase_scheme: true,
    lowercase_host: true,
    remove_default_port: true,
    remove_trailing_slash: false,
    sort_query_params: false,
    remove_empty_query_params: false,
    ...options,
  };
  
  const url = new URL(urlString);
  
  // Lowercase scheme
  if (opts.lowercase_scheme) {
    url.protocol = url.protocol.toLowerCase();
  }
  
  // Lowercase host
  if (opts.lowercase_host) {
    url.hostname = url.hostname.toLowerCase();
  }
  
  // Remove default port
  if (opts.remove_default_port) {
    const defaultPorts: Record<string, string> = {
      'http:': '80',
      'https:': '443',
      'ftp:': '21',
      'ws:': '80',
      'wss:': '443',
    };
    if (url.port === defaultPorts[url.protocol]) {
      url.port = '';
    }
  }
  
  // Remove trailing slash
  if (opts.remove_trailing_slash && url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/$/, '');
  }
  
  // Sort query params
  if (opts.sort_query_params) {
    url.searchParams.sort();
  }
  
  // Remove empty query params
  if (opts.remove_empty_query_params) {
    const keysToDelete: string[] = [];
    url.searchParams.forEach((value, key) => {
      if (value === '') keysToDelete.push(key);
    });
    keysToDelete.forEach(key => url.searchParams.delete(key));
  }
  
  return url.href;
}

/**
 * Remove trailing slash from pathname (DETERMINISTIC)
 */
export function removeTrailingSlash(urlString: string): string {
  const url = new URL(urlString);
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.href;
}

/**
 * Add trailing slash to pathname (DETERMINISTIC)
 */
export function addTrailingSlash(urlString: string): string {
  const url = new URL(urlString);
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  return url.href;
}

// ============================================
// Modification
// ============================================

/**
 * Set URL protocol (DETERMINISTIC)
 */
export function setProtocol(urlString: string, protocol: string): string {
  const url = new URL(urlString);
  url.protocol = protocol.replace(/:$/, '') + ':';
  return url.href;
}

/**
 * Set URL host (DETERMINISTIC)
 */
export function setHost(urlString: string, host: string, port?: number): string {
  const url = new URL(urlString);
  url.hostname = host;
  if (port) {
    url.port = port.toString();
  }
  return url.href;
}

/**
 * Set URL pathname (DETERMINISTIC)
 */
export function setPathname(urlString: string, pathname: string): string {
  const url = new URL(urlString);
  url.pathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return url.href;
}

/**
 * Set URL hash/fragment (DETERMINISTIC)
 */
export function setHash(urlString: string, hash: string | null): string {
  const url = new URL(urlString);
  url.hash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  return url.href;
}

// ============================================
// Path Utilities
// ============================================

/**
 * Get pathname as array of segments (DETERMINISTIC)
 */
export function getPathSegments(urlString: string): string[] {
  const pathname = getPathname(urlString);
  return pathname.split('/').filter(Boolean);
}

/**
 * Get filename from pathname (DETERMINISTIC)
 */
export function getFilename(urlString: string): string | null {
  const segments = getPathSegments(urlString);
  if (segments.length === 0) return null;
  const last = segments[segments.length - 1]!;
  return last.includes('.') ? last : null;
}

/**
 * Get file extension from pathname (DETERMINISTIC)
 */
export function getExtension(urlString: string): string | null {
  const filename = getFilename(urlString);
  if (!filename) return null;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return null;
  return filename.slice(lastDot);
}

// ============================================
// Constants
// ============================================

export const DEFAULT_HTTP_PORT = 80;
export const DEFAULT_HTTPS_PORT = 443;
export const DEFAULT_FTP_PORT = 21;
export const DEFAULT_WS_PORT = 80;
export const DEFAULT_WSS_PORT = 443;

export const PROTOCOL_HTTP = 'http';
export const PROTOCOL_HTTPS = 'https';
export const PROTOCOL_FTP = 'ftp';
export const PROTOCOL_WS = 'ws';
export const PROTOCOL_WSS = 'wss';
export const PROTOCOL_FILE = 'file';
export const PROTOCOL_DATA = 'data';

// ============================================
// Default Export
// ============================================

export const URL_ = {
  // Parsing
  parse,
  tryParse,
  parseQuery,
  
  // Component access
  getProtocol,
  getHost,
  getHostname,
  getPort,
  getPathname,
  getSearch,
  getHash,
  getOrigin,
  
  // Query parameters
  getQueryParam,
  getQueryParams,
  getQueryParamAll,
  hasQueryParam,
  setQueryParam,
  setQueryParams,
  removeQueryParam,
  clearQueryParams,
  
  // Building
  build,
  buildQuery,
  join,
  resolve,
  
  // Validation
  isValid,
  isAbsolute,
  isRelative,
  isHttps,
  isSameOrigin,
  
  // Normalization
  normalize,
  removeTrailingSlash,
  addTrailingSlash,
  
  // Modification
  setProtocol,
  setHost,
  setPathname,
  setHash,
  
  // Path utilities
  getPathSegments,
  getFilename,
  getExtension,
  
  // Constants
  DEFAULT_HTTP_PORT,
  DEFAULT_HTTPS_PORT,
  DEFAULT_FTP_PORT,
  DEFAULT_WS_PORT,
  DEFAULT_WSS_PORT,
  PROTOCOL_HTTP,
  PROTOCOL_HTTPS,
  PROTOCOL_FTP,
  PROTOCOL_WS,
  PROTOCOL_WSS,
  PROTOCOL_FILE,
  PROTOCOL_DATA,
};

export default URL_;
