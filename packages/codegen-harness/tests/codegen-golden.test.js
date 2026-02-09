/**
 * Codegen Golden Output Tests
 *
 * For each generator × each sample ISL file:
 *   1. Parse the ISL
 *   2. Generate into memory
 *   3. Compare byte-for-byte against samples/golden/<generator>/<file>
 *
 * If a golden file is missing the test fails with instructions to run
 *   pnpm --filter @isl-lang/codegen-harness update-golden
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@isl-lang/parser';
import { ALL_GENERATORS } from '../src/generators.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SAMPLES_DIR = resolve(__dirname, '..', 'samples', 'isl');
const GOLDEN_DIR = resolve(__dirname, '..', 'samples', 'golden');
// Discover sample ISL files
const islFiles = readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.isl'));
describe('Codegen Golden Output', () => {
    // Sanity: at least one ISL sample must exist
    it('has at least one sample ISL file', () => {
        expect(islFiles.length).toBeGreaterThan(0);
    });
    for (const islFile of islFiles) {
        const source = readFileSync(join(SAMPLES_DIR, islFile), 'utf-8');
        const parseResult = parse(source, islFile);
        describe(`sample: ${islFile}`, () => {
            it('parses successfully', () => {
                expect(parseResult.success).toBe(true);
                expect(parseResult.domain).toBeDefined();
            });
            for (const generator of ALL_GENERATORS) {
                describe(`generator: ${generator.name}`, () => {
                    it('produces at least one file', () => {
                        if (!parseResult.domain)
                            return;
                        const files = generator.generate(parseResult.domain);
                        expect(files.length).toBeGreaterThan(0);
                    });
                    it('produces non-empty content', () => {
                        if (!parseResult.domain)
                            return;
                        const files = generator.generate(parseResult.domain);
                        for (const file of files) {
                            expect(file.content.trim().length).toBeGreaterThan(0);
                        }
                    });
                    it('output is deterministic (two runs produce identical output)', () => {
                        if (!parseResult.domain)
                            return;
                        const run1 = generator.generate(parseResult.domain);
                        const run2 = generator.generate(parseResult.domain);
                        expect(run1.length).toBe(run2.length);
                        for (let i = 0; i < run1.length; i++) {
                            expect(run1[i].path).toBe(run2[i].path);
                            expect(run1[i].content).toBe(run2[i].content);
                        }
                    });
                    it('matches golden file', () => {
                        if (!parseResult.domain)
                            return;
                        const files = generator.generate(parseResult.domain);
                        for (const file of files) {
                            const goldenPath = join(GOLDEN_DIR, generator.name, file.path);
                            if (!existsSync(goldenPath)) {
                                throw new Error(`Golden file missing: ${goldenPath}\n` +
                                    `Run: pnpm --filter @isl-lang/codegen-harness update-golden`);
                            }
                            const golden = readFileSync(goldenPath, 'utf-8');
                            // Show a helpful diff on mismatch
                            if (file.content !== golden) {
                                const genLines = file.content.split('\n');
                                const goldLines = golden.split('\n');
                                const diffLines = [];
                                const maxLen = Math.max(genLines.length, goldLines.length);
                                for (let i = 0; i < maxLen; i++) {
                                    if (genLines[i] !== goldLines[i]) {
                                        diffLines.push(`Line ${i + 1}:`);
                                        diffLines.push(`  golden:    ${JSON.stringify(goldLines[i] ?? '<EOF>')}`);
                                        diffLines.push(`  generated: ${JSON.stringify(genLines[i] ?? '<EOF>')}`);
                                        if (diffLines.length > 30) {
                                            diffLines.push('  ... (truncated)');
                                            break;
                                        }
                                    }
                                }
                                throw new Error(`Golden mismatch for ${generator.name}/${file.path}:\n` +
                                    diffLines.join('\n') + '\n\n' +
                                    'If this change is intentional, run:\n' +
                                    '  pnpm --filter @isl-lang/codegen-harness update-golden');
                            }
                        }
                    });
                });
            }
        });
    }
});
