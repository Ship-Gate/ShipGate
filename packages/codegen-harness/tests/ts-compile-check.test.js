/**
 * TypeScript Compile Check
 *
 * Verifies that generated TypeScript code actually compiles without errors.
 * This catches type-level bugs that golden comparison alone cannot detect.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { parse } from '@isl-lang/parser';
import { typescriptGenerator } from '../src/generators.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SAMPLES_DIR = resolve(__dirname, '..', 'samples', 'isl');
const TEMP_DIR = resolve(__dirname, '..', '.test-temp');
const islFiles = readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.isl'));
describe('TypeScript Compile Check', () => {
    for (const islFile of islFiles) {
        it(`generated TS from ${islFile} compiles without errors`, () => {
            const source = readFileSync(join(SAMPLES_DIR, islFile), 'utf-8');
            const parseResult = parse(source, islFile);
            expect(parseResult.success).toBe(true);
            expect(parseResult.domain).toBeDefined();
            if (!parseResult.domain)
                return;
            const files = typescriptGenerator.generate(parseResult.domain);
            expect(files.length).toBeGreaterThan(0);
            // Write generated files to temp dir
            const outDir = join(TEMP_DIR, 'ts-compile', islFile.replace('.isl', ''));
            mkdirSync(outDir, { recursive: true });
            for (const file of files) {
                const outPath = join(outDir, file.path);
                mkdirSync(dirname(outPath), { recursive: true });
                writeFileSync(outPath, file.content);
            }
            // Write a minimal tsconfig for the compile check
            const tsconfig = {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ESNext',
                    moduleResolution: 'bundler',
                    strict: true,
                    noEmit: true,
                    skipLibCheck: true,
                },
                include: ['**/*.ts'],
            };
            writeFileSync(join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
            // Run tsc --noEmit
            try {
                execSync('npx tsc --noEmit', {
                    cwd: outDir,
                    encoding: 'utf-8',
                    timeout: 30000,
                    stdio: 'pipe',
                });
            }
            catch (err) {
                const stderr = err.stderr || '';
                const stdout = err.stdout || '';
                throw new Error(`TypeScript compilation failed for ${islFile}:\n` +
                    `stdout: ${stdout}\n` +
                    `stderr: ${stderr}`);
            }
            finally {
                // Cleanup
                try {
                    rmSync(outDir, { recursive: true, force: true });
                }
                catch {
                    // ignore cleanup errors
                }
            }
        });
    }
});
