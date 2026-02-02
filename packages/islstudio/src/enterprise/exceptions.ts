/**
 * ISL Studio - Exception Workflow
 * 
 * Break-glass overrides with expiry and owner.
 */

export interface Exception {
  id: string;
  ruleId: string;
  scope: 'file' | 'repo' | 'org';
  scopeValue: string; // file path, repo name, or org name
  
  // Justification
  reason: string;
  ticket?: string;
  
  // Ownership
  requestedBy: string;
  approvedBy: string;
  approvedAt: string;
  
  // Expiry
  expiresAt: string;
  
  // Status
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: string;
  revokedBy?: string;
}

export interface ExceptionRequest {
  ruleId: string;
  scope: Exception['scope'];
  scopeValue: string;
  reason: string;
  ticket?: string;
  requestedBy: string;
  durationDays: number;
}

/**
 * Create a new exception
 */
export function createException(
  request: ExceptionRequest,
  approvedBy: string
): Exception {
  const now = new Date();
  const expiry = new Date(now.getTime() + request.durationDays * 24 * 60 * 60 * 1000);
  
  return {
    id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ruleId: request.ruleId,
    scope: request.scope,
    scopeValue: request.scopeValue,
    reason: request.reason,
    ticket: request.ticket,
    requestedBy: request.requestedBy,
    approvedBy,
    approvedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    status: 'active',
  };
}

/**
 * Check if an exception applies to a violation
 */
export function checkException(
  ruleId: string,
  filePath: string,
  exceptions: Exception[]
): Exception | null {
  const now = new Date();
  
  for (const exc of exceptions) {
    // Skip non-active
    if (exc.status !== 'active') continue;
    
    // Check expiry
    if (new Date(exc.expiresAt) < now) {
      exc.status = 'expired';
      continue;
    }
    
    // Check rule match
    if (exc.ruleId !== ruleId && exc.ruleId !== '*') continue;
    
    // Check scope
    switch (exc.scope) {
      case 'file':
        if (filePath === exc.scopeValue || filePath.endsWith(exc.scopeValue)) {
          return exc;
        }
        break;
      case 'repo':
        // Repo-wide exception
        return exc;
      case 'org':
        // Org-wide exception (always applies)
        return exc;
    }
  }
  
  return null;
}

/**
 * Revoke an exception
 */
export function revokeException(exception: Exception, revokedBy: string): Exception {
  return {
    ...exception,
    status: 'revoked',
    revokedAt: new Date().toISOString(),
    revokedBy,
  };
}

/**
 * Get active exceptions
 */
export function getActiveExceptions(exceptions: Exception[]): Exception[] {
  const now = new Date();
  return exceptions.filter(exc => {
    if (exc.status !== 'active') return false;
    if (new Date(exc.expiresAt) < now) return false;
    return true;
  });
}

/**
 * Get expiring soon (within 7 days)
 */
export function getExpiringSoon(exceptions: Exception[], days: number = 7): Exception[] {
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  return exceptions.filter(exc => {
    if (exc.status !== 'active') return false;
    const expiry = new Date(exc.expiresAt);
    return expiry > now && expiry < threshold;
  });
}

/**
 * Format exception for display
 */
export function formatException(exc: Exception): string {
  const lines: string[] = [];
  
  lines.push(`Exception: ${exc.id}`);
  lines.push(`  Rule: ${exc.ruleId}`);
  lines.push(`  Scope: ${exc.scope} (${exc.scopeValue})`);
  lines.push(`  Reason: ${exc.reason}`);
  
  if (exc.ticket) {
    lines.push(`  Ticket: ${exc.ticket}`);
  }
  
  lines.push(`  Requested By: ${exc.requestedBy}`);
  lines.push(`  Approved By: ${exc.approvedBy}`);
  lines.push(`  Approved At: ${exc.approvedAt}`);
  lines.push(`  Expires At: ${exc.expiresAt}`);
  lines.push(`  Status: ${exc.status}`);
  
  return lines.join('\n');
}
