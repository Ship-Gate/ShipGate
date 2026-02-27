/**
 * ISL Studio - Output Formatters
 */

import type { GateResult } from './gate.js';
import { explainRule } from '@isl-lang/policy-packs';

/**
 * Format result for terminal output
 */
export function formatTerminalOutput(result: GateResult, ci: boolean = false): string {
  const lines: string[] = [];
  
  if (!ci) {
    lines.push('');
    lines.push('╔═══════════════════════════════════════════════════════════╗');
    lines.push('║                    ISL Studio Gate                        ║');
    lines.push('╚═══════════════════════════════════════════════════════════╝');
    lines.push('');
  }

  // Verdict
  const emoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  lines.push(`${emoji} ${result.verdict} (${result.score}/100)`);
  lines.push('');

  // Summary
  lines.push(`Files checked: ${result.summary.filesChecked}`);
  lines.push(`Blockers: ${result.summary.blockers}`);
  lines.push(`Warnings: ${result.summary.warnings}`);
  lines.push('');

  // Violations
  if (result.violations.length > 0) {
    lines.push('Violations:');
    lines.push('');
    
    // Group by file
    const byFile = new Map<string, typeof result.violations>();
    for (const v of result.violations) {
      const file = v.filePath || 'unknown';
      if (!byFile.has(file)) {
        byFile.set(file, []);
      }
      byFile.get(file)!.push(v);
    }

    for (const [file, violations] of byFile) {
      lines.push(`  ${file}`);
      for (const v of violations) {
        const icon = v.tier === 'hard_block' ? '🛑' : v.tier === 'soft_block' ? '⚠️' : 'ℹ️';
        const line = v.line ? `L${v.line}: ` : '';
        lines.push(`    ${icon} ${line}${v.ruleId}`);
        lines.push(`       ${v.message}`);
        if (v.suggestion && !ci) {
          lines.push(`       Fix: ${v.suggestion}`);
        }
      }
      lines.push('');
    }
  }

  // Fingerprint
  lines.push(`Fingerprint: ${result.fingerprint}`);
  
  if (!ci) {
    lines.push('');
    lines.push('Evidence: .islstudio/evidence/');
  }

  return lines.join('\n');
}

/**
 * Format result as JSON
 */
export function formatJsonOutput(result: GateResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format result as SARIF for GitHub Security tab
 */
export function formatSarifOutput(result: GateResult, cwd: string): string {
  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'ISL Studio',
            version: '0.1.0',
            informationUri: 'https://islstudio.dev',
            rules: getRulesFromViolations(result.violations),
          },
        },
        results: result.violations.map((v, idx) => ({
          ruleId: v.ruleId,
          level: v.tier === 'hard_block' ? 'error' : v.tier === 'soft_block' ? 'warning' : 'note',
          message: {
            text: v.message + (v.suggestion ? ` Fix: ${v.suggestion}` : ''),
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: v.filePath || 'unknown',
                  uriBaseId: '%SRCROOT%',
                },
                region: {
                  startLine: v.line || 1,
                  startColumn: 1,
                },
              },
            },
          ],
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

function getRulesFromViolations(violations: GateResult['violations']) {
  const seen = new Set<string>();
  const rules: Array<{
    id: string;
    name: string;
    shortDescription: { text: string };
    fullDescription: { text: string };
    defaultConfiguration: { level: string };
    helpUri: string;
  }> = [];

  for (const v of violations) {
    if (!seen.has(v.ruleId)) {
      seen.add(v.ruleId);
      const explanation = explainRule(v.ruleId);
      rules.push({
        id: v.ruleId,
        name: v.ruleId.replace('/', ' - '),
        shortDescription: { text: v.message },
        fullDescription: { text: explanation?.why || v.message },
        defaultConfiguration: {
          level: v.tier === 'hard_block' ? 'error' : v.tier === 'soft_block' ? 'warning' : 'note',
        },
        helpUri: explanation?.docs?.[0] || 'https://islstudio.dev/docs/rules',
      });
    }
  }

  return rules;
}

/**
 * Format result with detailed explanations for each violation
 */
export function formatWithExplanations(result: GateResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔═══════════════════════════════════════════════════════════╗');
  lines.push('║              ISL Studio Gate - Detailed Report            ║');
  lines.push('╚═══════════════════════════════════════════════════════════╝');
  lines.push('');

  // Verdict
  const emoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  lines.push(`${emoji} ${result.verdict} (${result.score}/100)`);
  lines.push('');

  // Summary
  lines.push(`Files checked: ${result.summary.filesChecked}`);
  lines.push(`Blockers: ${result.summary.blockers}`);
  lines.push(`Warnings: ${result.summary.warnings}`);
  lines.push('');

  // Detailed violations with explanations
  if (result.violations.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('VIOLATIONS WITH FIX GUIDANCE');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');
    
    const seenRules = new Set<string>();
    
    for (const v of result.violations) {
      const icon = v.tier === 'hard_block' ? '🛑' : v.tier === 'soft_block' ? '⚠️' : 'ℹ️';
      
      lines.push(`${icon} ${v.ruleId}`);
      lines.push(`   File: ${v.filePath || 'unknown'}`);
      lines.push(`   Issue: ${v.message}`);
      
      // Add explanation if we haven't shown it yet
      if (!seenRules.has(v.ruleId)) {
        seenRules.add(v.ruleId);
        
        const explanation = explainRule(v.ruleId);
        if (explanation) {
          lines.push('');
          lines.push(`   📖 WHY THIS MATTERS:`);
          lines.push(`   ${explanation.why}`);
          lines.push('');
          
          lines.push(`   🔧 HOW TO FIX:`);
          for (const fix of explanation.fixes.slice(0, 2)) {
            lines.push(`   • ${fix.name}: ${fix.description}`);
            if (fix.code) {
              lines.push('');
              lines.push('     ' + fix.code.split('\n').slice(0, 3).join('\n     '));
            }
          }
          lines.push('');
          
          if (explanation.examples.length > 0) {
            const ex = explanation.examples[0];
            lines.push(`   📝 EXAMPLE:`);
            lines.push(`   Bad:  ${ex.bad.split('\n')[0]}`);
            lines.push(`   Good: ${ex.good.split('\n')[0]}`);
            lines.push('');
          }
          
          if (explanation.docs.length > 0) {
            lines.push(`   📚 DOCS: ${explanation.docs[0]}`);
          }
        }
      }
      
      lines.push('───────────────────────────────────────────────────────────');
      lines.push('');
    }
  }

  // Fingerprint
  lines.push(`Fingerprint: ${result.fingerprint}`);
  lines.push('Evidence: .islstudio/evidence/');

  return lines.join('\n');
}
