/**
 * Code to ISL command
 *
 * Runs isl isl-generate on selected file/folder or workspace.
 */

import * as vscode from 'vscode';
import { runIslGenerate } from '../cli/islGenerateRunner';

export async function runCodeToIsl(
  workspaceRoot: string,
  path?: string
): Promise<{ success: boolean; generatedCount?: number; error?: string }> {
  const targetPath = path ?? workspaceRoot;

  const result = await runIslGenerate({
    path: targetPath,
    workspaceRoot,
  });

  if (result.success) {
    return {
      success: true,
      generatedCount: result.generatedCount,
    };
  }

  return {
    success: false,
    error: result.error ?? 'Generation failed',
  };
}
