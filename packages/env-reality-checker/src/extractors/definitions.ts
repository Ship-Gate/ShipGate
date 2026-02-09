/**
 * Extract environment variable definitions from various sources
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EnvDefinition } from '../types.js';

/**
 * Extract from .env* files
 */
export function extractFromEnvFiles(
  projectRoot: string,
  envFiles: string[] = ['.env.example', '.env', '.env.local', '.env.development', '.env.production']
): EnvDefinition[] {
  const definitions: EnvDefinition[] = [];

  for (const envFile of envFiles) {
    const filePath = path.join(projectRoot, envFile);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;

      // Match VAR_NAME=value or VAR_NAME= (empty)
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;

      const [, name, value] = match;
      const trimmedValue = value.trim();
      const hasDefault = trimmedValue.length > 0;
      const defaultValue = hasDefault ? trimmedValue : undefined;

      // Extract description from comment above
      let description: string | undefined;
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        if (prevLine.startsWith('#') && prevLine.length > 1) {
          description = prevLine.substring(1).trim();
        }
      }

      definitions.push({
        name,
        file: envFile,
        line: i + 1,
        source: 'env-file',
        required: !hasDefault,
        defaultValue,
        sensitive: isSensitiveVar(name),
        description,
      });
    }
  }

  return definitions;
}

/**
 * Extract from Zod schemas
 */
export function extractFromZodSchemas(
  projectRoot: string,
  filePaths: string[]
): EnvDefinition[] {
  const definitions: EnvDefinition[] = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Match z.object({ VAR_NAME: z... })
    const zodObjectPattern = /z\.object\s*\(\s*\{([^}]+)\}\s*\)/gs;
    let match: RegExpExecArray | null;

    while ((match = zodObjectPattern.exec(content)) !== null) {
      const objectContent = match[1];
      const lines = content.substring(0, match.index).split('\n');
      const baseLine = lines.length;

      // Extract individual field definitions
      const fieldPattern = /(\w+)\s*:\s*z\.(\w+)(?:\(([^)]*)\))?/g;
      let fieldMatch: RegExpExecArray | null;

      while ((fieldMatch = fieldPattern.exec(objectContent)) !== null) {
        const [, varName, zodType, args] = fieldMatch;
        const fieldLines = objectContent.substring(0, fieldMatch.index).split('\n');
        const fieldLine = baseLine + fieldLines.length - 1;

        // Determine type hint
        let typeHint: EnvDefinition['typeHint'] = 'string';
        let enumValues: string[] | undefined;
        let defaultValue: string | undefined;
        let required = true;

        if (zodType === 'enum') {
          typeHint = 'enum';
          const enumMatch = args?.match(/\[(.*?)\]/);
          if (enumMatch) {
            enumValues = enumMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
          }
        } else if (zodType === 'number' || zodType === 'coerce') {
          typeHint = 'number';
        } else if (zodType === 'boolean' || zodType === 'coerce') {
          typeHint = 'boolean';
        }

        // Check for .optional() or .default()
        const fieldDef = objectContent.substring(fieldMatch.index);
        if (fieldDef.includes('.optional()')) {
          required = false;
        }
        if (fieldDef.includes('.default(')) {
          const defaultMatch = fieldDef.match(/\.default\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (defaultMatch) {
            defaultValue = defaultMatch[1];
            required = false;
          }
        }

        definitions.push({
          name: varName,
          file: filePath,
          line: fieldLine,
          source: 'zod-schema',
          required,
          defaultValue,
          typeHint,
          enumValues,
          sensitive: isSensitiveVar(varName),
        });
      }
    }
  }

  return definitions;
}

/**
 * Extract from Kubernetes manifests
 */
export function extractFromKubernetes(
  projectRoot: string,
  filePaths: string[]
): EnvDefinition[] {
  const definitions: EnvDefinition[] = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Match env: section in YAML
    const envSectionPattern = /env\s*:/;
    let inEnvSection = false;
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (envSectionPattern.test(line)) {
        inEnvSection = true;
        indentLevel = line.match(/^(\s*)/)?.[1]?.length ?? 0;
        continue;
      }

      if (inEnvSection) {
        const currentIndent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
        
        // Exit env section if indentation decreases
        if (trimmed && currentIndent <= indentLevel && !trimmed.startsWith('-')) {
          inEnvSection = false;
          continue;
        }

        // Match - name: VAR_NAME
        const nameMatch = line.match(/^\s*-\s*name:\s*(.+)$/);
        if (nameMatch) {
          const varName = nameMatch[1].trim().replace(/['"]/g, '');
          
          // Check next line for value or valueFrom
          let defaultValue: string | undefined;
          let required = true;

          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const valueMatch = nextLine.match(/^\s+value:\s*(.+)$/);
            if (valueMatch) {
              defaultValue = valueMatch[1].trim().replace(/['"]/g, '');
              required = false;
            } else if (nextLine.includes('valueFrom:')) {
              required = true; // From secret/configmap
            }
          }

          definitions.push({
            name: varName,
            file: filePath,
            line: i + 1,
            source: 'kubernetes',
            required,
            defaultValue,
            sensitive: isSensitiveVar(varName) || varName.toLowerCase().includes('secret'),
          });
        }
      }
    }
  }

  return definitions;
}

/**
 * Extract from Dockerfile
 */
export function extractFromDockerfile(
  projectRoot: string,
  filePaths: string[] = ['Dockerfile', 'Dockerfile.*']
): EnvDefinition[] {
  const definitions: EnvDefinition[] = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(projectRoot, filePath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match ENV VAR_NAME=value or ENV VAR_NAME value
      const envMatch = line.match(/^ENV\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);
      if (envMatch) {
        const [, name, value] = envMatch;
        definitions.push({
          name,
          file: filePath,
          line: i + 1,
          source: 'dockerfile',
          required: false,
          defaultValue: value.trim(),
          sensitive: isSensitiveVar(name),
        });
      }
    }
  }

  return definitions;
}

/**
 * Check if variable name suggests sensitive data
 */
function isSensitiveVar(name: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /credential/i,
    /api[_-]?key/i,
    /auth/i,
    /private/i,
  ];

  return sensitivePatterns.some(pattern => pattern.test(name));
}
