/**
 * ISL Studio - Suppression Support
 * 
 * Allows inline suppressions with required justification:
 *   // islstudio-ignore pii/console-in-production: Used for debugging in development only
 */

export interface Suppression {
  ruleId: string;
  justification: string;
  line: number;
  file: string;
}

/**
 * Parse suppressions from file content
 */
export function parseSuppressions(content: string, filePath: string): Suppression[] {
  const suppressions: Suppression[] = [];
  const lines = content.split('\n');
  
  // Pattern: // islstudio-ignore <rule-id>: <justification>
  const pattern = /\/\/\s*islstudio-ignore\s+([\w\/-]+):\s*(.+)/i;
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (match) {
      suppressions.push({
        ruleId: match[1],
        justification: match[2].trim(),
        line: i + 1,
        file: filePath,
      });
    }
  }
  
  return suppressions;
}

/**
 * Check if a violation is suppressed
 */
export function isSuppressed(
  ruleId: string,
  line: number | undefined,
  suppressions: Suppression[]
): Suppression | null {
  // Find suppression that matches rule and is on the line before the violation
  for (const sup of suppressions) {
    if (sup.ruleId === ruleId || sup.ruleId === '*') {
      // Suppression applies to the next line or same line
      if (line === undefined || sup.line === line || sup.line === line - 1) {
        return sup;
      }
    }
  }
  return null;
}

/**
 * Validate that all suppressions have justifications
 */
export function validateSuppressions(suppressions: Suppression[]): string[] {
  const errors: string[] = [];
  
  for (const sup of suppressions) {
    if (!sup.justification || sup.justification.length < 10) {
      errors.push(
        `${sup.file}:${sup.line} - Suppression for ${sup.ruleId} requires a justification (at least 10 characters)`
      );
    }
  }
  
  return errors;
}
