import { spawn } from 'child_process';
import path from 'path';
import type { ToolFinding } from '../types.js';

export async function runTSC(projectPath: string): Promise<ToolFinding[]> {
  const findings: ToolFinding[] = [];
  
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsc', '--noEmit', '--strict'], {
      cwd: projectPath,
      shell: true,
    });

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', () => {
      try {
        // TypeScript outputs errors in format: file(line,col): error TS####: message
        const errorPattern = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/gm;
        let match;
        
        while ((match = errorPattern.exec(stderr)) !== null) {
          const [, filePath, lineStr, errorCode, message] = match;
          const relPath = path.relative(projectPath, filePath);
          
          findings.push({
            tool: 'tsc',
            file: relPath,
            line: parseInt(lineStr, 10),
            ruleId: errorCode,
            message: message.trim(),
            severity: 'error',
          });
        }
        
        resolve(findings);
      } catch (error) {
        console.warn(`TSC parse error for ${projectPath}:`, error);
        resolve(findings);
      }
    });

    proc.on('error', (error) => {
      console.error(`TSC execution error for ${projectPath}:`, error);
      resolve(findings);
    });
  });
}
