// ============================================================================
// Discovery Engine - Main entry point
// ============================================================================

import { extractISLSymbols } from './isl-extractor.js';
import { scanCodebase } from './code-scanner.js';
import { matchSymbols } from './matcher.js';
import type { DiscoveryOptions, DiscoveryResult, ISLSymbol, CodeSymbol, Binding } from './types.js';

/**
 * Discover bindings between ISL specs and code implementation
 */
export async function discover(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const {
    rootDir,
    specFiles,
    codeDirs = [],
    includePatterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
    excludePatterns = ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.js'],
    minConfidence = 0.3,
    enableAST = true,
    enableFilesystem = true,
    enableNaming = true,
    verbose = false,
  } = options;

  if (verbose) {
    console.log(`[Discovery] Starting discovery for ${specFiles.length} spec file(s)`);
    console.log(`[Discovery] Root directory: ${rootDir}`);
    console.log(`[Discovery] Code directories: ${codeDirs.length > 0 ? codeDirs.join(', ') : 'all'}`);
  }

  // Step 1: Extract ISL symbols
  if (verbose) console.log('[Discovery] Extracting ISL symbols...');
  const islSymbols = await extractISLSymbols(specFiles);
  if (verbose) console.log(`[Discovery] Found ${islSymbols.length} ISL symbols`);

  // Step 2: Scan codebase
  if (verbose) console.log('[Discovery] Scanning codebase...');
  const codeSymbols = await scanCodebase(rootDir, codeDirs, includePatterns, excludePatterns);
  if (verbose) console.log(`[Discovery] Found ${codeSymbols.length} code symbols`);

  // Step 3: Match symbols
  if (verbose) console.log('[Discovery] Matching symbols...');
  const bindings = matchSymbols(islSymbols, codeSymbols, { minConfidence });

  // Step 4: Calculate statistics
  const boundISLSymbols = new Set(bindings.map(b => `${b.islSymbol.domain}.${b.islSymbol.name}`));
  const unboundSymbols = islSymbols.filter(
    s => !boundISLSymbols.has(`${s.domain}.${s.name}`)
  );

  const boundCodeSymbols = new Set(bindings.map(b => `${b.codeSymbol.file}:${b.codeSymbol.name}`));
  const unmatchedCodeSymbols = codeSymbols.filter(
    s => !boundCodeSymbols.has(`${s.file}:${s.name}`)
  );

  const averageConfidence =
    bindings.length > 0
      ? bindings.reduce((sum, b) => sum + b.confidence, 0) / bindings.length
      : 0;

  const strategyBreakdown: Record<string, number> = {};
  for (const binding of bindings) {
    strategyBreakdown[binding.strategy] = (strategyBreakdown[binding.strategy] || 0) + 1;
  }

  const result: DiscoveryResult = {
    bindings,
    unboundSymbols,
    unmatchedCodeSymbols,
    stats: {
      totalISLSymbols: islSymbols.length,
      totalCodeSymbols: codeSymbols.length,
      boundCount: bindings.length,
      averageConfidence,
      strategyBreakdown: strategyBreakdown as any,
    },
  };

  if (verbose) {
    console.log(`[Discovery] Discovery complete:`);
    console.log(`  - Bindings found: ${bindings.length}`);
    console.log(`  - Unbound ISL symbols: ${unboundSymbols.length}`);
    console.log(`  - Unmatched code symbols: ${unmatchedCodeSymbols.length}`);
    console.log(`  - Average confidence: ${(averageConfidence * 100).toFixed(1)}%`);
  }

  return result;
}
