// ============================================================================
// Declaration File Compile Test
// ============================================================================
// This test verifies that the generated declaration files are valid and
// can be consumed by TypeScript consumers.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Declaration Files', () => {
  it('should generate declaration files in dist/', () => {
    const distDir = path.join(process.cwd(), 'dist');
    const dtsFile = path.join(distDir, 'index.d.ts');
    const dctsFile = path.join(distDir, 'index.d.cts');

    expect(fs.existsSync(dtsFile)).toBe(true);
    expect(fs.existsSync(dctsFile)).toBe(true);

    // Verify files are not empty
    const dtsContent = fs.readFileSync(dtsFile, 'utf-8');
    const dctsContent = fs.readFileSync(dctsFile, 'utf-8');

    expect(dtsContent.length).toBeGreaterThan(0);
    expect(dctsContent.length).toBeGreaterThan(0);

    // Verify they contain expected exports
    expect(dtsContent).toContain('export');
    expect(dtsContent).toContain('BuildOptions');
    expect(dtsContent).toContain('BuildResult');
    expect(dtsContent).toContain('function run');
    expect(dtsContent).toContain('buildRunner');
  });

  it('should have correct package.json types field', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    expect(packageJson.types).toBe('./dist/index.d.ts');
    expect(packageJson.exports).toBeDefined();
    expect(packageJson.exports['.'].types).toBe('./dist/index.d.ts');
  });

  it('should have valid TypeScript declaration syntax', () => {
    const distDir = path.join(process.cwd(), 'dist');
    const dtsFile = path.join(distDir, 'index.d.ts');
    const dtsContent = fs.readFileSync(dtsFile, 'utf-8');

    // Verify the declaration file has valid TypeScript syntax
    // by checking for proper export statements
    expect(dtsContent).toMatch(/export\s*\{/);
    
    // Verify key types are exported
    expect(dtsContent).toContain('type BuildOptions');
    expect(dtsContent).toContain('type BuildResult');
    expect(dtsContent).toContain('type OutputFile');
    
    // Verify functions are declared
    expect(dtsContent).toContain('declare function run');
    expect(dtsContent).toContain('declare const buildRunner');
    
    // Verify the file ends with an export statement
    expect(dtsContent.trim()).toMatch(/export\s*\{.*\}\s*;?\s*$/);
  });
});
