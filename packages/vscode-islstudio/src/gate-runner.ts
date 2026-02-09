/**
 * Gate Runner
 * 
 * Runs ISL gate checks and integrates with pipeline
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: Violation[];
}

export interface Violation {
  ruleId: string;
  file: string;
  message: string;
  line?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Run gate on all files or changed files only
 */
export async function runGate(
  changedOnly: boolean,
  outputChannel?: vscode.OutputChannel
): Promise<GateResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open');
  }

  const cwd = workspaceFolder.uri.fsPath;
  const changedFlag = changedOnly ? '--changed-only' : '';
  
  // Try to use local shipgate CLI first, fallback to npx
  let cmd: string;
  try {
    // Check if shipgate is installed locally
    await execAsync('which shipgate', { cwd });
    cmd = `shipgate gate --ci --output json ${changedFlag}`;
  } catch {
    cmd = `npx shipgate@latest gate --ci --output json ${changedFlag}`;
  }

  if (outputChannel) {
    outputChannel.appendLine(`Running: ${cmd}`);
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 60000 });
    
    if (stderr && outputChannel) {
      outputChannel.appendLine(`stderr: ${stderr}`);
    }

    // Parse result
    let result: GateResult;
    try {
      result = JSON.parse(stdout);
    } catch (e) {
      if (outputChannel) {
        outputChannel.appendLine(`Failed to parse: ${stdout}`);
      }
      throw new Error(`Failed to parse gate result: ${e}`);
    }

    return result;
  } catch (error: any) {
    if (outputChannel) {
      outputChannel.appendLine(`Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get changed files from git
 */
export async function getChangedFiles(): Promise<string[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }

  try {
    const cwd = workspaceFolder.uri.fsPath;
    const { stdout } = await execAsync('git diff --name-only HEAD', { cwd });
    return stdout.trim().split('\n').filter(f => f.length > 0);
  } catch {
    return [];
  }
}
