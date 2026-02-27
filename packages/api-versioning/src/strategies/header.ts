/**
 * Header Version Strategy
 * 
 * Extracts version from headers:
 * - API-Version: 2
 * - Accept: application/vnd.api+json;version=2
 */

export interface HeaderStrategyOptions {
  header?: string;
  mediaType?: string;
}

/**
 * Extract version from headers
 */
export function extractVersionFromHeader(
  headers: Record<string, string | undefined>,
  options: HeaderStrategyOptions = {}
): string | null {
  const { header = 'API-Version', mediaType } = options;
  
  // Check custom version header
  const versionHeader = headers[header] ?? headers[header.toLowerCase()];
  if (versionHeader) {
    return versionHeader;
  }
  
  // Check Accept header for versioned media type
  const accept = headers['Accept'] ?? headers['accept'];
  if (accept && mediaType) {
    const versionFromAccept = extractVersionFromMediaType(accept, mediaType);
    if (versionFromAccept) {
      return versionFromAccept;
    }
  }
  
  // Check Accept header for version parameter
  if (accept) {
    const versionMatch = accept.match(/version=(\d+)/i);
    if (versionMatch) {
      return versionMatch[1];
    }
  }
  
  return null;
}

/**
 * Extract version from media type
 * Accept: application/vnd.myapi.v2+json
 */
function extractVersionFromMediaType(accept: string, mediaType: string): string | null {
  const regex = new RegExp(`${escapeRegex(mediaType)}\\.v(\\d+)`);
  const match = accept.match(regex);
  return match ? match[1] : null;
}

/**
 * Build headers with version
 */
export function buildVersionedHeaders(
  headers: Record<string, string>,
  version: string,
  options: HeaderStrategyOptions = {}
): Record<string, string> {
  const { header = 'API-Version' } = options;
  
  return {
    ...headers,
    [header]: version,
  };
}

/**
 * Build Accept header with version
 */
export function buildVersionedAcceptHeader(
  version: string,
  options: HeaderStrategyOptions = {}
): string {
  const { mediaType = 'application/vnd.api' } = options;
  return `${mediaType}+json;version=${version}`;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const headerStrategy = {
  extract: extractVersionFromHeader,
  build: buildVersionedHeaders,
  buildAccept: buildVersionedAcceptHeader,
};
