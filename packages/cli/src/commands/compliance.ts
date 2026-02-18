/**
 * Compliance Command - Generate compliance reports
 * 
 * Maps ISL specifications to compliance frameworks automatically
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { parse as parseISL } from '@isl-lang/parser';
// Missing module - compliance not available
// import { runComplianceCheck } from '@isl-lang/compliance';
const runComplianceCheck = null as any;
import { ExitCode } from '../exit-codes.js';
import { isJsonOutput } from '../output.js';

interface ComplianceOptions {
  framework?: 'soc2' | 'hipaa' | 'pci-dss' | 'gdpr';
  output?: string;
  format?: 'json' | 'markdown';
  evidence?: boolean;
}

export async function compliance(
  specPath: string,
  options: ComplianceOptions = {}
): Promise<{ exitCode: number; result?: any }> {
  try {
    // 1. Parse ISL spec
    const specContent = await readFile(resolve(specPath), 'utf-8');
    const parseResult = parseISL(specContent);
    
    if (parseResult.errors.length > 0) {
      throw new Error(`ISL parse errors: ${parseResult.errors.map(e => e.message).join(', ')}`);
    }

    // 2. Generate compliance report
    const generator = runComplianceCheck ? new (runComplianceCheck as any).ComplianceGenerator(parseResult.domain, options.framework ?? 'soc2') : null;
    if (!generator) throw new Error('Compliance module not available');

    const report = await generator.generateReport(parseResult.domain);

    // 3. Output results
    if (isJsonOutput()) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('\n🔒 ISL Compliance Report\n');
      console.log(`Framework: ${report.framework.toUpperCase()}`);
      console.log(`Status: ${report.status.toUpperCase()}`);
      console.log(`Coverage: ${report.summary.coveragePercentage}%`);
      console.log(`Controls Implemented: ${report.summary.implemented}/${report.summary.total}`);
      
      if (report.gaps.length > 0) {
        console.log('\n⚠️  Compliance Gaps:');
        report.gaps.forEach((gap: any, i: number) => {
          console.log(`  • ${i + 1}. ${gap.controlId}: ${gap.description}`);
        });
      }
      
      console.log(`\n📄 Full report saved to: ${report.outputPath}`);
    }

    return { 
      exitCode: report.status === 'compliant' ? ExitCode.SUCCESS : (report.errors.length > 0 ? ExitCode.ISL_ERROR : ExitCode.INTERNAL_ERROR),
      result: report 
    };

  } catch (error) {
    console.error('Compliance analysis failed:', error);
    return { exitCode: ExitCode.INTERNAL_ERROR };
  }
}
