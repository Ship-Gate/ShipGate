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
