// ============================================================================
// Integration Tests - Parse all ISL files in the project
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively find all .isl files in a directory
 */
function findIslFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      files.push(...findIslFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.isl')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Get the project root (3 levels up from this test file)
 */
function getProjectRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

describe('ISL File Integration Tests', () => {
  const projectRoot = getProjectRoot();
  const islFiles = findIslFiles(projectRoot);
  
  describe('Parse all ISL files', () => {
    // Log what we found
    it('should find ISL files in the project', () => {
      console.log(`Found ${islFiles.length} ISL files in the project`);
      expect(islFiles.length).toBeGreaterThan(0);
    });
    
    // Track results for summary
    const results: { file: string; success: boolean; errors: string[] }[] = [];
    
    // Test each ISL file
    for (const islFile of islFiles) {
      const relativePath = path.relative(projectRoot, islFile);
      
      it(`should parse ${relativePath}`, () => {
        const source = fs.readFileSync(islFile, 'utf-8');
        const result = parse(source, relativePath);
        
        const errors = result.errors.filter(e => e.severity === 'error');
        
        results.push({
          file: relativePath,
          success: result.success && errors.length === 0,
          errors: errors.map(e => `${e.location.line}:${e.location.column}: ${e.message}`),
        });
        
        if (!result.success || errors.length > 0) {
          console.log(`\nFailed: ${relativePath}`);
          for (const error of errors) {
            console.log(`  ${error.location.line}:${error.location.column}: ${error.message}`);
          }
        }
        
        expect(result.success).toBe(true);
        expect(errors).toHaveLength(0);
      });
    }
    
    // Print summary after all tests
    it('should generate summary', () => {
      const passed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const total = results.length;
      const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
      
      console.log(`\n=== ISL Parser Coverage Summary ===`);
      console.log(`Passed: ${passed}/${total} (${percentage}%)`);
      console.log(`Failed: ${failed}`);
      
      if (failed > 0) {
        console.log(`\nFailed files:`);
        for (const r of results.filter(r => !r.success)) {
          console.log(`  - ${r.file}`);
          for (const err of r.errors.slice(0, 3)) {
            console.log(`      ${err}`);
          }
        }
      }
      
      // Final assertion
      expect(failed).toBe(0);
    });
  });
});
