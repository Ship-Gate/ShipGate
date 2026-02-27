/**
 * Intent Block Manager
 * 
 * Manages intent blocks from ISL specs
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { glob } from 'glob';

export interface IntentBlock {
  name: string;
  file: string;
  intents: string[];
}

/**
 * Find all ISL spec files in workspace
 */
export async function findISLSpecs(): Promise<string[]> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return [];
  }

  const pattern = path.join(workspaceFolder.uri.fsPath, '**/*.isl');
  return new Promise((resolve, reject) => {
    glob(pattern, (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files);
      }
    });
  });
}

/**
 * Parse ISL file and extract intent blocks
 */
export async function parseIntentBlocks(specFile: string): Promise<IntentBlock[]> {
  try {
    const content = await fs.readFile(specFile, 'utf-8');
    const blocks: IntentBlock[] = [];

    // Simple parser for intent blocks
    // Looks for: intent <name> { ... }
    const intentRegex = /intent\s+(\w+)\s*\{/g;
    const behaviorRegex = /behavior\s+(\w+)\s*\{([^}]+)\}/g;

    let match;
    const behaviors: Array<{ name: string; intents: string[] }> = [];

    // Extract behaviors and their intents
    while ((match = behaviorRegex.exec(content)) !== null) {
      const behaviorName = match[1];
      const behaviorContent = match[2];
      const intents: string[] = [];

      // Find intent tags in behavior
      const intentTagRegex = /@intent\s+(\w+)/g;
      let intentMatch;
      while ((intentMatch = intentTagRegex.exec(behaviorContent)) !== null) {
        intents.push(intentMatch[1]);
      }

      behaviors.push({ name: behaviorName, intents });
    }

    // Also check for standalone intents
    while ((match = intentRegex.exec(content)) !== null) {
      const intentName = match[1];
      blocks.push({
        name: intentName,
        file: specFile,
        intents: [intentName],
      });
    }

    // Add behaviors as blocks
    for (const behavior of behaviors) {
      blocks.push({
        name: behavior.name,
        file: specFile,
        intents: behavior.intents,
      });
    }

    return blocks;
  } catch (error) {
    return [];
  }
}

/**
 * Find all intent blocks in workspace
 */
export async function findAllIntentBlocks(): Promise<IntentBlock[]> {
  const specFiles = await findISLSpecs();
  const allBlocks: IntentBlock[] = [];

  for (const specFile of specFiles) {
    const blocks = await parseIntentBlocks(specFile);
    allBlocks.push(...blocks);
  }

  return allBlocks;
}
