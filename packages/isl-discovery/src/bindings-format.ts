// ============================================================================
// Bindings File Format (.shipgate.bindings.json)
// ============================================================================

import { writeFile } from 'node:fs/promises';
import type { DiscoveryResult, BindingsFile, BindingEntry } from './types.js';

/**
 * Convert discovery result to bindings file format
 */
export function toBindingsFile(result: DiscoveryResult, specFiles: string[]): BindingsFile {
  const bindings: BindingEntry[] = result.bindings.map(binding => ({
    isl: {
      type: binding.islSymbol.type,
      name: binding.islSymbol.name,
      domain: binding.islSymbol.domain,
      specFile: binding.islSymbol.specFile,
      location: binding.islSymbol.location,
    },
    code: {
      type: binding.codeSymbol.type,
      name: binding.codeSymbol.name,
      file: binding.codeSymbol.file,
      location: binding.codeSymbol.location,
      metadata: binding.codeSymbol.metadata,
    },
    confidence: binding.confidence,
    evidence: binding.evidence,
    strategy: binding.strategy,
  }));

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    specs: specFiles,
    bindings,
  };
}

/**
 * Write bindings file to disk
 */
export async function writeBindingsFile(
  filePath: string,
  result: DiscoveryResult,
  specFiles: string[]
): Promise<void> {
  const bindingsFile = toBindingsFile(result, specFiles);
  await writeFile(filePath, JSON.stringify(bindingsFile, null, 2), 'utf-8');
}

/**
 * Read bindings file from disk
 */
export async function readBindingsFile(filePath: string): Promise<BindingsFile> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as BindingsFile;
}
