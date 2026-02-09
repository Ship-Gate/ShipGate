#!/usr/bin/env tsx
/**
 * Update Golden Files
 *
 * Parses each sample ISL file, runs every generator, and writes the output
 * into samples/golden/<generator>/. Run this after intentional generator changes:
 *
 *   pnpm --filter @isl-lang/codegen-harness update-golden
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, basename, resolve, dirname } from 'path';
import { parse } from '@isl-lang/parser';
import { ALL_GENERATORS } from '../src/generators.js';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')));
const SAMPLES_DIR = join(ROOT, '..', 'samples', 'isl');
const GOLDEN_DIR = join(ROOT, '..', 'samples', 'golden');

function main() {
  const islFiles = readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.isl'));

  if (islFiles.length === 0) {
    console.error('No ISL files found in', SAMPLES_DIR);
    process.exit(1);
  }

  let totalFiles = 0;

  for (const islFile of islFiles) {
    const source = readFileSync(join(SAMPLES_DIR, islFile), 'utf-8');
    const result = parse(source, islFile);

    if (!result.success || !result.domain) {
      console.error(`Parse failed for ${islFile}:`);
      for (const err of result.errors) {
        console.error(`  ${err.message}`);
      }
      process.exit(1);
    }

    for (const generator of ALL_GENERATORS) {
      const files = generator.generate(result.domain);

      for (const file of files) {
        const outDir = join(GOLDEN_DIR, generator.name);
        mkdirSync(outDir, { recursive: true });
        const outPath = join(outDir, file.path);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, file.content);
        totalFiles++;
        console.log(`  ✓ ${generator.name}/${file.path}`);
      }
    }
  }

  console.log(`\nUpdated ${totalFiles} golden files from ${islFiles.length} ISL spec(s).`);
}

main();
