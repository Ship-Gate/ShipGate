#!/usr/bin/env node
// ============================================================================
// Build Seed Corpus from Real ISL Files
// ============================================================================

import { buildCorpusFromDir, saveCorpus } from '../src/build-corpus.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../../..');

async function main() {
  console.log('Building seed corpus from real ISL files...');
  console.log(`Scanning: ${repoRoot}`);
  
  const corpus = await buildCorpusFromDir(repoRoot, 1000);
  
  console.log(`Found ${corpus.length} ISL files`);
  
  const outputPath = join(__dirname, '../fuzz-corpus.json');
  await saveCorpus(corpus, outputPath);
  
  console.log(`Corpus saved to: ${outputPath}`);
  console.log(`Total size: ${corpus.reduce((sum, e) => sum + e.size, 0)} bytes`);
}

main().catch(console.error);
