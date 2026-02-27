import { spawn } from 'child_process';
import path from 'path';
import type { ToolFinding } from '../types.js';

interface ESLintResult {
  filePath: string;
  messages: Array<{
    line: number;
    column: number;
    ruleId: string | null;
    message: string;
    severity: number;
  }>;
}

export async function runESLint(projectPath: string): Promise<ToolFinding[]> {
  const findings: ToolFinding[] = [];
  
  return new Promise((resolve) => {
    const proc = spawn('npx', ['eslint', '.', '--format', 'json'], {
      cwd: projectPath,
      shell: true,
    });

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', () => {
      try {
        const results: ESLintResult[] = JSON.parse(stdout);
        
        for (const result of results) {
          const relPath = path.relative(projectPath, result.filePath);
          
          for (const msg of result.messages) {
            if (msg.ruleId) {
              findings.push({
                tool: 'eslint',
                file: relPath,
                line: msg.line,
                ruleId: msg.ruleId,
                message: msg.message,
                severity: msg.severity === 2 ? 'error' : 'warning',
              });
            }
          }
        }
        
        resolve(findings);
      } catch (error) {
        console.warn(`ESLint parse error for ${projectPath}:`, error);
        resolve(findings);
      }
    });

    proc.on('error', (error) => {
      console.error(`ESLint execution error for ${projectPath}:`, error);
      resolve(findings);
    });
  });
}
