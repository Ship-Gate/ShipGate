/**
 * Tests for drift detection command
 */

import { describe, it, expect } from 'vitest';
import { detectDrift } from '../src/commands/drift.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('drift detection', () => {
  it('should detect routes without matching behaviors', async () => {
    const testDir = join(tmpdir(), `isl-drift-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    try {
      // Create a simple route file
      const routeFile = join(testDir, 'routes.ts');
      await writeFile(
        routeFile,
        `export async function GET(req: Request) {
          return new Response('OK');
        }`
      );
      
      // Create a spec file without matching behavior
      const specFile = join(testDir, 'api.isl');
      await writeFile(
        specFile,
        `domain Api {
          version: "1.0.0"
          
          behavior GetUsers {
            input {
              request: String
            }
            output {
              success: Boolean
            }
          }
        }`
      );
      
      const result = await detectDrift(testDir, specFile);
      
      // Should detect the route as added (UNBOUND)
      expect(result.changes.some(c => 
        c.type === 'added' && 
        c.category === 'route' &&
        c.name.includes('GET')
      )).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  }, 30000);
  
  it('should detect behaviors without matching routes', async () => {
    const testDir = join(tmpdir(), `isl-drift-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    try {
      // Create an empty code directory
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // Create a spec file with a behavior
      const specFile = join(testDir, 'api.isl');
      await writeFile(
        specFile,
        `domain Api {
          version: "1.0.0"
          
          behavior CreateUser {
            input {
              email: String
            }
            output {
              success: Boolean
            }
          }
        }`
      );
      
      const result = await detectDrift(join(testDir, 'src'), specFile);
      
      // Should detect the behavior as removed (no matching route)
      expect(result.changes.some(c => 
        c.type === 'removed' && 
        c.category === 'behavior' &&
        c.name === 'CreateUser'
      )).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  }, 30000);
  
  it('should handle missing spec files gracefully', async () => {
    const testDir = join(tmpdir(), `isl-drift-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    try {
      await expect(
        detectDrift(testDir, join(testDir, 'nonexistent.isl'))
      ).rejects.toThrow();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  }, 30000);
});
