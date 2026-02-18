import { spawn } from 'child_process';
import path from 'path';
import type { ToolFinding } from '../types.js';

interface SemgrepResult {
  results: Array<{
    path: string;
    start: { line: number };
    check_id: string;
    extra: {
      message: string;
      severity: string;
    };
  }>;
}

export async function runSemgrep(projectPath: string): Promise<ToolFinding[]> {
  const findings: ToolFinding[] = [];
  
  return new Promise((resolve) => {
    const proc = spawn('semgrep', ['--config', 'auto', '--json', '.'], {
      cwd: projectPath,
      shell: true,
    });

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', () => {
      try {
        const result: SemgrepResult = JSON.parse(stdout);
        
        for (const finding of result.results || []) {
          const relPath = path.relative(projectPath, finding.path);
          
          findings.push({
            tool: 'semgrep',
            file: relPath,
            line: finding.start.line,
            ruleId: finding.check_id,
            message: finding.extra.message,
            severity: finding.extra.severity,
          });
        }
        
        resolve(findings);
      } catch (error) {
        console.warn(`Semgrep parse error for ${projectPath}:`, error);
        resolve(findings);
      }
    });

    proc.on('error', (error) => {
      console.error(`Semgrep execution error for ${projectPath}:`, error);
      resolve(findings);
    });
  });
}
