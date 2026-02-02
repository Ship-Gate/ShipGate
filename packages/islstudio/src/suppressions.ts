/**
 * ISL Studio - Suppression Support
 * 
 * Allows inline suppressions with required justification:
 *   // islstudio-ignore pii/console-in-production: Used for debugging [expires:2026-03-01] [ticket:JIRA-123]
 */

export interface Suppression {
  ruleId: string;
  justification: string;
  line: number;
  file: string;
  expires?: string;  // ISO date string
  ticket?: string;   // Ticket URL or ID
}

/**
 * Parse suppressions from file content
 * 
 * Format: // islstudio-ignore <rule-id>: <justification> [expires:YYYY-MM-DD] [ticket:URL]
 */
export function parseSuppressions(content: string, filePath: string): Suppression[] {
  const suppressions: Suppression[] = [];
  const lines = content.split('\n');
  
  // Pattern: // islstudio-ignore <rule-id>: <justification> [optional metadata]
  const pattern = /\/\/\s*islstudio-ignore\s+([\w\/-]+):\s*(.+)/i;
  const expiresPattern = /\[expires?:([^\]]+)\]/i;
  const ticketPattern = /\[ticket:([^\]]+)\]/i;
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (match) {
      const fullText = match[2].trim();
      
      // Extract expires
      const expiresMatch = fullText.match(expiresPattern);
      const expires = expiresMatch ? expiresMatch[1].trim() : undefined;
      
      // Extract ticket
      const ticketMatch = fullText.match(ticketPattern);
      const ticket = ticketMatch ? ticketMatch[1].trim() : undefined;
      
      // Clean justification (remove metadata tags)
      let justification = fullText
        .replace(expiresPattern, '')
        .replace(ticketPattern, '')
        .trim();
      
      suppressions.push({
        ruleId: match[1],
        justification,
        line: i + 1,
        file: filePath,
        expires,
        ticket,
      });
    }
  }
  
  return suppressions;
}

/**
 * Check if a suppression has expired
 */
export function isExpired(suppression: Suppression): boolean {
  if (!suppression.expires) return false;
  
  try {
    const expiryDate = new Date(suppression.expires);
    return expiryDate < new Date();
  } catch {
    return false; // Invalid date = never expires
  }
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
        // Check if expired
        if (isExpired(sup)) {
          continue; // Expired suppressions don't count
        }
        return sup;
      }
    }
  }
  return null;
}

/**
 * Get all expired suppressions (for reporting)
 */
export function getExpiredSuppressions(suppressions: Suppression[]): Suppression[] {
  return suppressions.filter(isExpired);
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
