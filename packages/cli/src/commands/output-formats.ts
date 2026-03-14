/**
 * CI Output Format Formatters
 * 
 * Supports multiple CI provider formats:
 * - gitlab: GitLab Code Quality JSON
 * - junit: JUnit XML (universal CI format)
 * - json: Raw JSON (default)
 * - github: GitHub Actions annotations (via --ci flag)
 */

import type { UnifiedVerifyResult, FileVerifyResultEntry } from './verify.js';

/**
 * Format result as GitLab Code Quality JSON
 * https://docs.gitlab.com/ee/ci/testing/code_quality.html
 */
export function formatGitLab(result: UnifiedVerifyResult): string {
  const issues: Array<{
    description: string;
    fingerprint: string;
    severity: 'info' | 'minor' | 'major' | 'critical' | 'blocker';
    location: {
      path: string;
      lines: {
        begin: number;
        end: number;
      };
    };
  }> = [];

  for (const file of result.files) {
    if (file.status === 'FAIL') {
      // Critical issues
      for (const blocker of file.blockers) {
        issues.push({
          description: blocker,
          fingerprint: `shipgate-${file.file}-${blocker.slice(0, 50)}`,
          severity: 'critical',
          location: {
            path: file.file,
            lines: {
              begin: 1,
              end: 1,
            },
          },
        });
      }
    } else if (file.status === 'WARN') {
      // Major issues for warnings
      const message = file.mode === 'Specless'
        ? `No ISL spec found (specless verification, score: ${file.score})`
        : `Warning (score: ${file.score})`;
      
      issues.push({
        description: message,
        fingerprint: `shipgate-${file.file}-warn`,
        severity: 'major',
        location: {
          path: file.file,
          lines: {
            begin: 1,
            end: 1,
          },
        },
      });
    }
  }

  return JSON.stringify(issues, null, 2);
}

/**
 * Format result as JUnit XML
 * Compatible with Jenkins, Azure DevOps, Bitbucket, CircleCI, etc.
 */
export function formatJUnit(result: UnifiedVerifyResult): string {
  const testsuites = result.files.map((file: FileVerifyResultEntry) => {
    const testcases = [];
    
    // Add test case for overall file status
    const status = file.status === 'PASS' ? 'success' : file.status === 'WARN' ? 'warning' : 'failure';
    const testcase = {
      name: `verify-${file.file}`,
      classname: file.file,
      time: (file.duration / 1000).toFixed(3),
      ...(status === 'failure' && {
        failure: {
          message: file.blockers.join('; ') || `Verification failed (score: ${file.score})`,
          $t: file.blockers.join('\n') || `Status: ${file.status}, Mode: ${file.mode}, Score: ${file.score}`,
        },
      }),
      ...(status === 'warning' && {
        skipped: {
          message: `Warning: ${file.mode === 'Specless' ? 'No ISL spec found' : 'Low score'}`,
        },
      }),
    };
    
    testcases.push(testcase);
    
    // Add individual blocker test cases
    for (const blocker of file.blockers) {
      testcases.push({
        name: `blocker-${file.file}-${blocker.slice(0, 30)}`,
        classname: file.file,
        time: '0.000',
        failure: {
          message: blocker,
          $t: blocker,
        },
      });
    }

    const failures = file.status === 'FAIL' ? (file.blockers.length > 0 ? file.blockers.length : 1) : 0;
    const skipped = file.status === 'WARN' ? 1 : 0;
    
    return {
      name: file.file,
      tests: testcases.length,
      failures,
      errors: 0,
      skipped,
      time: (file.duration / 1000).toFixed(3),
      testcase: testcases,
    };
  });

  const totalTests = testsuites.reduce((sum, ts) => sum + ts.tests, 0);
  const totalFailures = testsuites.reduce((sum, ts) => sum + ts.failures, 0);
  const totalErrors = testsuites.reduce((sum, ts) => sum + ts.errors, 0);
  const totalSkipped = testsuites.reduce((sum, ts) => sum + ts.skipped, 0);
  const totalTime = (result.duration / 1000).toFixed(3);

  // Build XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuites name="Shipgate ISL Verify" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" skipped="${totalSkipped}" time="${totalTime}">\n`;

  for (const suite of testsuites) {
    xml += `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.tests}" failures="${suite.failures}" errors="${suite.errors}" skipped="${suite.skipped}" time="${suite.time}">\n`;
    
    for (const tc of suite.testcase) {
      xml += `    <testcase name="${escapeXml(tc.name)}" classname="${escapeXml(tc.classname)}" time="${tc.time}">\n`;
      
      if (tc.failure) {
        xml += `      <failure message="${escapeXml(tc.failure.message)}">${escapeXml(tc.failure.$t)}</failure>\n`;
      } else if (tc.skipped) {
        xml += `      <skipped message="${escapeXml(tc.skipped.message)}"/>\n`;
      }
      
      xml += `    </testcase>\n`;
    }
    
    xml += `  </testsuite>\n`;
  }

  xml += '</testsuites>\n';
  return xml;
}

/**
 * Format result as SARIF 2.1.0
 * https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */
export function formatSarif(result: UnifiedVerifyResult): string {
  const ruleMap = new Map<string, { id: string; shortDescription: string; severity: 'error' | 'warning' | 'note' }>();
  const sarifResults: Array<Record<string, unknown>> = [];

  for (const file of result.files) {
    if (file.status === 'FAIL') {
      for (const blocker of file.blockers) {
        const ruleId = deriveRuleId(blocker);
        if (!ruleMap.has(ruleId)) {
          ruleMap.set(ruleId, {
            id: ruleId,
            shortDescription: blocker.length > 120 ? blocker.slice(0, 117) + '...' : blocker,
            severity: 'error',
          });
        }

        sarifResults.push({
          ruleId,
          message: { text: blocker },
          level: 'error',
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: file.file, uriBaseId: '%SRCROOT%' },
              region: { startLine: 1 },
            },
          }],
          properties: {
            proofMethod: file.mode,
            score: file.score,
            tier: file.tier ?? null,
          },
        });
      }
    } else if (file.status === 'WARN') {
      const ruleId = file.mode === 'Specless' ? 'shipgate/specless-warn' : 'shipgate/low-score';
      const message = file.mode === 'Specless'
        ? `No ISL spec found — specless verification (score: ${file.score})`
        : `Verification warning (score: ${file.score})`;

      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, { id: ruleId, shortDescription: message, severity: 'warning' });
      }

      sarifResults.push({
        ruleId,
        message: { text: message },
        level: 'warning',
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: file.file, uriBaseId: '%SRCROOT%' },
            region: { startLine: 1 },
          },
        }],
        properties: {
          proofMethod: file.mode,
          score: file.score,
          tier: file.tier ?? null,
        },
      });
    }
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0' as const,
    runs: [{
      tool: {
        driver: {
          name: 'shipgate',
          version: '3.0.0',
          informationUri: 'https://shipgate.dev',
          rules: Array.from(ruleMap.values()).map((r) => ({
            id: r.id,
            shortDescription: { text: r.shortDescription },
            defaultConfiguration: { level: r.severity },
          })),
        },
      },
      results: sarifResults,
      invocations: [{
        executionSuccessful: result.verdict !== 'NO_SHIP',
        properties: {
          verdict: result.verdict,
          trustScore: result.trustScore,
          confidence: result.confidence,
          mode: result.mode,
        },
      }],
    }],
  };

  return JSON.stringify(sarif, null, 2);
}

function deriveRuleId(blocker: string): string {
  const normalized = blocker
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `shipgate/${normalized || 'verification-failure'}`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
