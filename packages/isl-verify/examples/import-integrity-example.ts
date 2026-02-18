/**
 * Example: Using ImportIntegrityProver to verify all imports in a project
 * 
 * This example shows how to use the Import Integrity Prover to catch
 * hallucinated imports - a common issue with AI-generated code.
 */

import { ImportIntegrityProver } from '../src/proof/import-integrity-prover.js';
import type { PropertyProof } from '../src/proof/types.js';

async function main() {
  // Example 1: Verify current project
  console.log('🔍 Checking import integrity for current project...\n');
  
  const projectRoot = process.cwd();
  const prover = new ImportIntegrityProver(projectRoot);
  
  const proof = await prover.prove();
  
  // Display results
  displayProof(proof);
  
  // Example 2: What happens with hallucinated imports
  console.log('\n\n📋 Example of hallucinated imports:\n');
  console.log('If you had code like:');
  console.log('  import { fake } from "./nonexistent";');
  console.log('  import { missing } from "uninstalled-package";');
  console.log('\nYou would get findings like:');
  console.log('  ❌ src/index.ts:1 - Import "./nonexistent" cannot be resolved');
  console.log('     💡 Check that the file exists and the path is correct');
  console.log('  ❌ src/index.ts:2 - Import "uninstalled-package" cannot be resolved');
  console.log('     💡 Run npm install to ensure the package is installed');
}

function displayProof(proof: PropertyProof) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Import Integrity Proof');
  console.log('═══════════════════════════════════════════════════════════');
  console.log();
  
  // Status
  const statusEmoji = proof.status === 'PROVEN' ? '✅' : proof.status === 'PARTIAL' ? '⚠️' : '❌';
  console.log(`Status:      ${statusEmoji} ${proof.status}`);
  console.log(`Summary:     ${proof.summary}`);
  console.log(`Method:      ${proof.method}`);
  console.log(`Confidence:  ${proof.confidence}`);
  console.log(`Duration:    ${proof.duration_ms}ms`);
  console.log();
  
  // Evidence summary
  console.log('Evidence:');
  console.log(`  Total imports:    ${proof.evidence.length}`);
  console.log(`  ✅ Verified:      ${proof.evidence.filter(e => e.status === 'verified').length}`);
  console.log(`  ❌ Unresolved:    ${proof.evidence.filter(e => e.status === 'unresolved_module').length}`);
  console.log(`  ⚠️  Bad symbols:   ${proof.evidence.filter(e => e.status === 'unresolved_symbol').length}`);
  console.log(`  ⚠️  Missing types: ${proof.evidence.filter(e => e.status === 'missing_types').length}`);
  console.log();
  
  // Findings
  if (proof.findings.length > 0) {
    console.log('Findings:');
    console.log();
    
    for (const finding of proof.findings.slice(0, 10)) { // Show first 10
      const severityEmoji = finding.severity === 'error' ? '❌' : '⚠️';
      console.log(`  ${severityEmoji} ${finding.file}:${finding.line}`);
      console.log(`     ${finding.message}`);
      if (finding.suggestion) {
        console.log(`     💡 ${finding.suggestion}`);
      }
      console.log();
    }
    
    if (proof.findings.length > 10) {
      console.log(`  ... and ${proof.findings.length - 10} more`);
      console.log();
    }
  }
  
  // Import types breakdown
  if (proof.evidence.length > 0) {
    console.log('Import Types:');
    const relativeImports = proof.evidence.filter(e => e.importPath.startsWith('.')).length;
    const packageImports = proof.evidence.filter(e => !e.importPath.startsWith('.') && !e.importPath.startsWith('@')).length;
    const scopedPackages = proof.evidence.filter(e => e.importPath.startsWith('@')).length;
    
    console.log(`  Relative:        ${relativeImports}`);
    console.log(`  Packages:        ${packageImports}`);
    console.log(`  Scoped packages: ${scopedPackages}`);
    console.log();
  }
  
  // Sample evidence (first 5 imports)
  if (proof.evidence.length > 0) {
    console.log('Sample Evidence (first 5 imports):');
    console.log();
    
    for (const evidence of proof.evidence.slice(0, 5)) {
      const statusEmoji = evidence.status === 'verified' ? '✅' : '❌';
      console.log(`  ${statusEmoji} ${evidence.importPath}`);
      console.log(`     Source:   ${evidence.source}:${evidence.line}`);
      console.log(`     Symbols:  [${evidence.symbols.join(', ')}]`);
      console.log(`     Resolved: ${evidence.resolvedTo || 'NOT FOUND'}`);
      console.log();
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
}

// Run the example
main().catch(console.error);
