/**
 * Query Parameter Version Strategy
 * 
 * Extracts version from query string: ?version=2
 */

export interface QueryStrategyOptions {
  param?: string;
}

/**
 * Extract version from query string
 */
export function extractVersionFromQuery(
  url: string,
  options: QueryStrategyOptions = {}
): string | null {
  const { param = 'version' } = options;
  
  try {
    const urlObj = new URL(url, 'http://localhost');
    const version = urlObj.searchParams.get(param);
    return version;
  } catch {
    // Try regex fallback for partial URLs
    const regex = new RegExp(`[?&]${escapeRegex(param)}=(\\d+)`);
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

/**
 * Build URL with version query parameter
 */
export function buildVersionedQueryUrl(
  url: string,
  version: string,
  options: QueryStrategyOptions = {}
): string {
  const { param = 'version' } = options;
  
  try {
    const urlObj = new URL(url, 'http://localhost');
    urlObj.searchParams.set(param, version);
    
    // Return path + query for relative URLs
    if (url.startsWith('/') || !url.includes('://')) {
      return urlObj.pathname + urlObj.search;
    }
    
    return urlObj.toString();
  } catch {
    // Fallback for malformed URLs
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${param}=${version}`;
  }
}

/**
 * Remove version from query string
 */
export function stripVersionFromQuery(
  url: string,
  options: QueryStrategyOptions = {}
): string {
  const { param = 'version' } = options;
  
  try {
    const urlObj = new URL(url, 'http://localhost');
    urlObj.searchParams.delete(param);
    
    // Return path + query for relative URLs
    if (url.startsWith('/') || !url.includes('://')) {
      const search = urlObj.search;
      return urlObj.pathname + (search === '?' ? '' : search);
    }
    
    return urlObj.toString();
  } catch {
    // Regex fallback
    const regex = new RegExp(`([?&])${escapeRegex(param)}=\\d+(&?)`, 'g');
    let result = url.replace(regex, (match, prefix, suffix) => {
      if (prefix === '?' && suffix === '&') return '?';
      if (prefix === '&') return suffix ? '&' : '';
      return suffix ? '?' : '';
    });
    
    // Clean up trailing ? or &
    result = result.replace(/[?&]$/, '');
    
    return result;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const queryStrategy = {
  extract: extractVersionFromQuery,
  build: buildVersionedQueryUrl,
  strip: stripVersionFromQuery,
};
