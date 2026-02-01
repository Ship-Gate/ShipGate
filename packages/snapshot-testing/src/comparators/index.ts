/**
 * Comparators Index
 * 
 * Re-exports all comparators.
 */

export {
  // JSON comparator
  compareJson,
  compareJsonStrings,
  parseJson,
  serializeJson,
  createJsonSerializer,
  createJsonComparator,
  type JsonCompareOptions,
  type JsonDiff,
  type JsonCompareResult,
} from './json.js';

export {
  // ISL comparator
  compareIsl,
  parseIslElements,
  extractDomainName,
  extractVersion,
  removeComments,
  normalizeWhitespace,
  normalizeIsl,
  createIslSerializer,
  createIslComparator,
  type IslCompareOptions,
  type IslElement,
  type IslElementType,
  type IslDiff,
  type IslCompareResult,
} from './isl.js';

export {
  // Generated code comparator
  compareGenerated,
  compareLines,
  normalizeTypescript,
  normalizeFormatting,
  normalizeImports,
  removeGeneratedComments,
  removeTimestamps,
  createGeneratedSerializer,
  createGeneratedComparator,
  detectFileType,
  getNormalizerForFile,
  type GeneratedCompareOptions,
  type CodeDiff,
  type GeneratedCompareResult,
} from './generated.js';
