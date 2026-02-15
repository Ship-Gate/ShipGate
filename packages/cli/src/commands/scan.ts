/**

 * Scan Command - Host and Reality-Gap Scanners

 *

 * Exposes hallucination scanners directly via CLI:

 * - Host: ShipGate truthpack validation (routes, env, imports, files)

 * - Reality-Gap: ShipGate policy packs (auth, pii, payments, rate-limit, intent)

 */



import { relative } from 'path';

import type {

  HostScanResult,

  RealityGapScanResult,

  ScannerOptions,

} from '@isl-lang/isl-firewall';



export type ScanType = 'host' | 'reality-gap';



export interface ScanCommandOptions {

  projectRoot?: string;

  truthpackPath?: string;

  config?: string;

  format?: 'pretty' | 'json' | 'sarif';

  ci?: boolean;

  changedOnly?: boolean;

  explain?: boolean;

}



export interface ScanCommandResult {

  success: boolean;

  exitCode: number;

  scanner: ScanType;

  verdict: 'SHIP' | 'NO_SHIP';

  score: number;

  filesChecked: number;

  violations: number;

  results: Array<{

    file: string;

    verdict: 'SHIP' | 'NO_SHIP';

    violations: Array<{

      rule: string;

      message: string;

      line?: number;

      severity: string;

      tier: string;

      suggestion?: string;

    }>;

  }>;

}



function toOutputResult(

  result: HostScanResult | RealityGapScanResult

): ScanCommandResult {

  return {

    success: result.verdict === 'SHIP',

    exitCode: result.verdict === 'SHIP' ? 0 : 1,

    scanner: result.scanner,

    verdict: result.verdict,

    score: result.score,

    filesChecked: result.filesChecked,

    violations: result.violations,

    results: result.results.map((r) => ({

      file: r.file,

      verdict: r.verdict,

      violations: r.violations,

    })),

  };

}



/**

 * Run Host scanner

 */

export async function runHostScanCommand(

  files: string[],

  options: ScanCommandOptions = {}

): Promise<ScanCommandResult> {

  const { runHostScan } = await import('@isl-lang/isl-firewall');

  const result = await runHostScan(files, {

    projectRoot: options.projectRoot ?? process.cwd(),

    truthpackPath: options.truthpackPath,

    config: options.config,

  });

  return toOutputResult(result);

}



/**

 * Run Reality-Gap scanner

 */

export async function runRealityGapScanCommand(

  files: string[],

  options: ScanCommandOptions = {}

): Promise<ScanCommandResult> {

  const { runRealityGapScan } = await import('@isl-lang/isl-firewall');

  const result = await runRealityGapScan(files, {

    projectRoot: options.projectRoot ?? process.cwd(),

    truthpackPath: options.truthpackPath,

    config: options.config,

  });

  return toOutputResult(result);

}



/**

 * Format scan result for console output

 */

export function formatScanResultForConsole(

  result: ScanCommandResult,

  options: { explain?: boolean }

): string {

  const lines: string[] = [];

  const scannerName =

    result.scanner === 'host' ? 'Host Scanner' : 'Reality-Gap Scanner';



  lines.push('');

  lines.push(`┌${'─'.repeat(50)}┐`);

  lines.push(`│ ${scannerName}${' '.repeat(50 - scannerName.length - 2)}│`);

  lines.push(`├${'─'.repeat(50)}┤`);

  lines.push(

    `│ Verdict: ${result.verdict === 'SHIP' ? '✓ SHIP' : '✗ NO_SHIP'}${' '.repeat(result.verdict === 'SHIP' ? 32 : 30)}│`

  );

  lines.push(`│ Score:   ${result.score}/100${' '.repeat(36)}│`);

  lines.push(

    `│ Files:   ${result.filesChecked}${' '.repeat(40 - String(result.filesChecked).length)}│`

  );

  lines.push(`└${'─'.repeat(50)}┘`);

  lines.push('');



  if (result.violations > 0) {

    lines.push(`Found ${result.violations} violation(s):`);

    lines.push('');



    for (const fileResult of result.results) {

      if (fileResult.violations.length === 0) continue;



      const relPath = relative(process.cwd(), fileResult.file);

      lines.push(`  ${relPath}`);

      for (const v of fileResult.violations) {

        const icon =

          v.tier === 'hard_block'

            ? '✗'

            : v.tier === 'soft_block'

              ? '!'

              : '○';

        lines.push(`    ${icon} [${v.rule}] ${v.message}`);

        if (options.explain && v.suggestion) {

          lines.push(`      └─ Fix: ${v.suggestion}`);

        }

      }

      lines.push('');

    }

  } else {

    lines.push('  All checks passed! ✓');

    lines.push('');

  }



  return lines.join('\n');

}



/**

 * Generate SARIF output for scan result

 */

export function formatScanResultAsSarif(result: ScanCommandResult): object {

  const rules = Array.from(

    new Set(result.results.flatMap((r) => r.violations.map((v) => v.rule)))

  ).map((id) => ({

    id,

    shortDescription: { text: id },

  }));



  return {

    $schema:

      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',

    version: '2.1.0',

    runs: [

      {

        tool: {

          driver: {

            name: result.scanner === 'host' ? 'Host Scanner' : 'Reality-Gap Scanner',

            version: '0.2.0',

            informationUri: 'https://shipgate.dev',

            rules,

          },

        },

        results: result.results.flatMap((fileResult) =>

          fileResult.violations.map((v) => ({

            ruleId: v.rule,

            message: { text: v.message },

            level:

              v.tier === 'hard_block'

                ? 'error'

                : v.tier === 'soft_block'

                  ? 'warning'

                  : 'note',

            locations: [

              {

                physicalLocation: {

                  artifactLocation: {

                    uri: relative(process.cwd(), fileResult.file),

                  },

                  region: v.line ? { startLine: v.line } : undefined,

                },

              },

            ],

          }))

        ),

      },

    ],

  };

}



/**

 * Get exit code from scan result

 */

export function getScanExitCode(result: ScanCommandResult): number {

  return result.exitCode;

}

