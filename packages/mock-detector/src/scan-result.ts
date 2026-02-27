/**
 * Scan result with allowlist information
 */

import type { MockFinding, MockDetectorConfig } from './types.js';
import { isAllowlisted, getAllowlistReason } from './allowlist.js';
import { scanFile as scanFileInternal, type ScanOptions } from './detector.js';

export interface ScanResult {
  /** Findings detected */
  findings: MockFinding[];
  /** Whether file was allowlisted */
  allowed: boolean;
  /** Reason for allowlisting if applicable */
  allowlistReason?: string;
}

/**
 * Scan a file and return result with allowlist info
 */
export function scanFileWithResult(
  filePath: string,
  content: string,
  config: MockDetectorConfig
): ScanResult {
  const allowed = isAllowlisted(filePath, config.allowlist);
  
  if (allowed) {
    return {
      findings: [],
      allowed: true,
      allowlistReason: getAllowlistReason(filePath),
    };
  }

  const findings = scanFileInternal({
    filePath,
    content,
    config,
  } as ScanOptions);

  return {
    findings,
    allowed: false,
  };
}
