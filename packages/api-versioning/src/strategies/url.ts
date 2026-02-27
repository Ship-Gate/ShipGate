/**
 * URL Version Strategy
 * 
 * Extracts version from URL path: /v1/users, /v2/users
 */

export interface UrlStrategyOptions {
  prefix?: string;
}

/**
 * Extract version from URL path
 */
export function extractVersionFromUrl(
  url: string,
  options: UrlStrategyOptions = {}
): string | null {
  const { prefix = '/v' } = options;
  
  // Match /v1, /v2, etc. at the start of the path
  const regex = new RegExp(`^${escapeRegex(prefix)}(\\d+)(?:/|$)`);
  const match = url.match(regex);
  
  if (match) {
    return match[1];
  }
  
  return null;
}

/**
 * Build URL with version
 */
export function buildVersionedUrl(
  url: string,
  version: string,
  options: UrlStrategyOptions = {}
): string {
  const { prefix = '/v' } = options;
  
  // Check if URL already has a version
  const existingVersion = extractVersionFromUrl(url, options);
  
  if (existingVersion) {
    // Replace existing version
    const regex = new RegExp(`^${escapeRegex(prefix)}\\d+`);
    return url.replace(regex, `${prefix}${version}`);
  }
  
  // Add version at the start
  return `${prefix}${version}${url}`;
}

/**
 * Remove version from URL
 */
export function stripVersionFromUrl(
  url: string,
  options: UrlStrategyOptions = {}
): string {
  const { prefix = '/v' } = options;
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d+`);
  return url.replace(regex, '');
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const urlStrategy = {
  extract: extractVersionFromUrl,
  build: buildVersionedUrl,
  strip: stripVersionFromUrl,
};
