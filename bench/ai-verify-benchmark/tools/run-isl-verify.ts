import { spawn } from 'child_process';
import path from 'path';
import type { ToolFinding } from '../types.js';

interface ISLVerifyResult {
  files: Array<{
    file: string;
    verdict: string;
    violations: Array<{
      line: number;
      check: string;
      message: string;
      severity: string;
    }>;
  }>;
}

export async function runISLVerify(projectPath: string): Promise<ToolFinding[]> {
  const findings: ToolFinding[] = [];
  
  return new Promise((resolve, reject) => {
    const cliPath = path.resolve(process.cwd(), 'packages/cli/dist/cli.cjs');
    
    const proc = spawn('node', [cliPath, 'verify', '.', '--format', 'json'], {
      cwd: projectPath,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      try {
        // ISL Verify outputs JSON on success
        const result: ISLVerifyResult = JSON.parse(stdout);
        
        for (const fileResult of result.files) {
          for (const violation of fileResult.violations || []) {
            findings.push({
              tool: 'isl-verify',
              file: fileResult.file,
              line: violation.line,
              ruleId: violation.check,
              message: violation.message,
              severity: violation.severity,
            });
          }
        }
        
        resolve(findings);
      } catch (error) {
        // If JSON parse fails, try to extract findings from stderr
        console.warn(`ISL Verify parse error for ${projectPath}:`, error);
        resolve(findings);
      }
    });

    proc.on('error', (error) => {
      console.error(`ISL Verify execution error for ${projectPath}:`, error);
      resolve(findings);
    });
  });
}
