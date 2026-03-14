export { OSVClient } from './osv-client.js';
export type {
  PackageQuery,
  Ecosystem,
  OSVVulnerability,
  OSVSeverity,
  OSVAffectedPackage,
  OSVAffectedRange,
  OSVReference,
} from './osv-client.js';

export {
  parsePnpmLock,
  parsePackageLock,
  parseYarnLock,
  parseLockfile,
  detectLockfileType,
} from './lockfile-parser.js';
export type { PackageEntry } from './lockfile-parser.js';

export { verifyLockfileIntegrity, findLockfile } from './integrity-checker.js';
export type { IntegrityResult } from './integrity-checker.js';

export { checkForTyposquatting, levenshteinDistance } from './typosquat-detector.js';
export type { TyposquatFinding } from './typosquat-detector.js';

export { SupplyChainScanner } from './scanner.js';
export type { SupplyChainResult, SupplyChainScannerOptions, ScanSummary } from './scanner.js';

export { supplyChainCheck } from './adapter.js';
