/**
 * Missing Environment Variable Fixer
 * 
 * Adds missing environment variables to .env.example and schema files.
 */

import type { Finding } from '@isl-lang/isl-gate';
import type { FixContext, FixSuggestion } from '../shipgate-fixes.js';
import { readFileSafe, writeFileSafe } from '../shipgate-fixes.js';
import { createPatch } from '../patcher.js';
import { join } from 'path';

/**
 * Extract env var name from finding message
 */
function extractEnvVarName(finding: Finding): string | null {
  // Try to extract from message patterns like:
  // "Missing environment variable: API_KEY"
  // "Environment variable 'DATABASE_URL' is not defined"
  // "env var PORT missing"
  const patterns = [
    /environment variable[:\s]+['"]?([A-Z_][A-Z0-9_]*)['"]?/i,
    /env var[:\s]+['"]?([A-Z_][A-Z0-9_]*)['"]?/i,
    /missing[:\s]+['"]?([A-Z_][A-Z0-9_]*)['"]?/i,
    /not defined[:\s]+['"]?([A-Z_][A-Z0-9_]*)['"]?/i,
  ];

  for (const pattern of patterns) {
    const match = finding.message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Find .env.example file
 */
async function findEnvExample(projectRoot: string): Promise<string | null> {
  const candidates = [
    '.env.example',
    '.env.template',
    'env.example',
  ];

  for (const candidate of candidates) {
    const fullPath = join(projectRoot, candidate);
    if (existsSync(fullPath)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Find schema files (zod, joi, prisma)
 */
async function findSchemaFiles(projectRoot: string): Promise<string[]> {
  const schemaFiles: string[] = [];

  // Common schema file patterns
  const patterns = [
    '**/env.schema.ts',
    '**/env.schema.js',
    '**/config.schema.ts',
    '**/config.schema.js',
    '**/schema/env.ts',
    '**/schema/env.js',
    'prisma/schema.prisma',
  ];

  // Simple check - in a real implementation, use glob
  for (const pattern of patterns) {
    const parts = pattern.split('/');
    const file = parts[parts.length - 1]!;
    const fullPath = join(projectRoot, file);
    if (existsSync(fullPath)) {
      schemaFiles.push(file);
    }
  }

  return schemaFiles;
}

/**
 * Add env var to .env.example
 */
function addToEnvExample(
  content: string,
  varName: string,
  defaultValue: string = ''
): string {
  const lines = content.split('\n');
  
  // Find insertion point (after last env var or at end)
  let insertIndex = lines.length;
  let lastEnvLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.match(/^[A-Z_][A-Z0-9_]*=/)) {
      lastEnvLine = i;
    }
  }

  if (lastEnvLine >= 0) {
    insertIndex = lastEnvLine + 1;
  }

  // Generate new line
  const newLine = `${varName}=${defaultValue}`;
  lines.splice(insertIndex, 0, newLine);

  return lines.join('\n');
}

/**
 * Generate fix suggestions for missing env var
 */
export async function fixMissingEnvVar(
  finding: Finding,
  context: FixContext
): Promise<FixSuggestion[]> {
  const suggestions: FixSuggestion[] = [];
  const varName = extractEnvVarName(finding);

  if (!varName) {
    return [];
  }

  const { projectRoot } = context;

  // Fix 1: Add to .env.example
  const envExamplePath = await findEnvExample(projectRoot);
  if (envExamplePath) {
    const content = await readFileSafe(envExamplePath, projectRoot);
    if (content && !content.includes(`${varName}=`)) {
      const originalContent = content;
      const patchedContent = addToEnvExample(content, varName);
      const lineNumber = content.split('\n').length + 1;

      const patch = createPatch('insert', lineNumber, {
        file: envExamplePath,
        content: `${varName}=\n`,
        description: `Add missing environment variable ${varName} to .env.example`,
        confidence: 0.9,
      });

      suggestions.push({
        rule: 'missing-env-var',
        why: `Environment variable ${varName} is used in code but not defined in .env.example`,
        confidence: 0.9,
        patch,
        diff: generateDiff(envExamplePath, originalContent, patchedContent),
      });
    }
  } else {
    // Create .env.example if it doesn't exist
    const newContent = `# Environment Variables\n${varName}=\n`;
    const patch = createPatch('insert', 1, {
      file: '.env.example',
      content: newContent,
      description: `Create .env.example with missing environment variable ${varName}`,
      confidence: 0.7,
    });

    suggestions.push({
      rule: 'missing-env-var',
      why: `Environment variable ${varName} is used but .env.example doesn't exist. Creating it.`,
      confidence: 0.7,
      patch,
      diff: generateDiff('.env.example', '', newContent),
    });
  }

  // Fix 2: Add to schema files (if found)
  const schemaFiles = await findSchemaFiles(projectRoot);
  for (const schemaFile of schemaFiles) {
    const content = await readFileSafe(schemaFile, projectRoot);
    if (content && !content.includes(varName)) {
      // This is a simplified version - real implementation would parse AST
      // For now, we'll add a comment suggesting manual addition
      const comment = `// TODO: Add ${varName} to schema validation\n`;
      const lines = content.split('\n');
      const insertLine = lines.length > 0 ? lines.length : 1;

      const patch = createPatch('insert', insertLine, {
        file: schemaFile,
        content: comment,
        description: `Add TODO comment for ${varName} in schema file`,
        confidence: 0.5,
      });

      suggestions.push({
        rule: 'missing-env-var',
        why: `Add ${varName} to schema validation file ${schemaFile}`,
        confidence: 0.5,
        patch,
        diff: generateDiff(schemaFile, content, content + '\n' + comment),
      });
    }
  }

  return suggestions;
}

/**
 * Generate unified diff
 */
function generateDiff(
  file: string,
  oldContent: string,
  newContent: string
): string {
  const { generateUnifiedDiff } = require('../diff-generator.js');
  return generateUnifiedDiff(file, oldContent, newContent);
}

// Import existsSync
import { existsSync } from 'fs';
