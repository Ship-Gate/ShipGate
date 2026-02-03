/**
 * Registry Validation Script
 * 
 * Validates the registry for correctness:
 * - All modules have required fields
 * - Dependencies reference valid modules
 * - Categories reference valid modules
 * - Import aliases reference valid modules
 * 
 * Run with: pnpm run validate-registry
 */

import { validateRegistry, getRegistryStats } from './registry.js';

export function runValidation(): { success: boolean; output: string } {
  const lines: string[] = [];
  lines.push('Validating stdlib registry...');
  lines.push('');
  
  const { valid, errors } = validateRegistry();
  
  if (valid) {
    lines.push('✓ Registry is valid!');
    lines.push('');
    
    const stats = getRegistryStats();
    lines.push('Registry Statistics:');
    lines.push(`  Total modules: ${stats.totalModules}`);
    lines.push(`  Total entities: ${stats.totalEntities}`);
    lines.push(`  Total behaviors: ${stats.totalBehaviors}`);
    lines.push(`  Total enums: ${stats.totalEnums}`);
    lines.push(`  Total types: ${stats.totalTypes}`);
    lines.push('');
    lines.push('Modules by category:');
    for (const [category, count] of Object.entries(stats.byCategory)) {
      lines.push(`  ${category}: ${count}`);
    }
    
    return { success: true, output: lines.join('\n') };
  } else {
    lines.push('✗ Registry validation failed!');
    lines.push('');
    lines.push('Errors:');
    for (const error of errors) {
      lines.push(`  - ${error}`);
    }
    
    return { success: false, output: lines.join('\n') };
  }
}

// Export for testing
export { validateRegistry, getRegistryStats };
