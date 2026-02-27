/**
 * Message Formatting Utilities
 * 
 * Helper functions for formatting text in Slack messages.
 */

// ============================================================================
// Score & Verdict Formatting
// ============================================================================

/**
 * Format a verification score with visual indicator
 */
export function formatScore(score: number): string {
  if (score >= 90) {
    return `🟢 ${score}/100`;
  } else if (score >= 70) {
    return `🟡 ${score}/100`;
  } else if (score >= 50) {
    return `🟠 ${score}/100`;
  } else {
    return `🔴 ${score}/100`;
  }
}

/**
 * Format verdict with emoji
 */
export function formatVerdict(verdict: string): string {
  const emoji = getVerdictEmoji(verdict);
  return `${emoji} ${verdict.toUpperCase()}`;
}

/**
 * Get emoji for verdict
 */
export function getVerdictEmoji(verdict: string): string {
  switch (verdict.toLowerCase()) {
    case 'verified':
      return '✅';
    case 'risky':
      return '⚠️';
    case 'unsafe':
      return '❌';
    case 'checked':
      return '✓';
    case 'unchecked':
      return '❔';
    default:
      return '⚪';
  }
}

// ============================================================================
// Duration Formatting
// ============================================================================

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// ============================================================================
// Percentage Formatting
// ============================================================================

/**
 * Format percentage value
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Format percentage with color indicator
 */
export function formatPercentageWithColor(value: number): string {
  if (value >= 90) {
    return `🟢 ${Math.round(value)}%`;
  } else if (value >= 70) {
    return `🟡 ${Math.round(value)}%`;
  } else if (value >= 50) {
    return `🟠 ${Math.round(value)}%`;
  } else {
    return `🔴 ${Math.round(value)}%`;
  }
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape special markdown characters for Slack
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format code block
 */
export function formatCodeBlock(code: string, language?: string): string {
  return `\`\`\`${language || ''}\n${code}\n\`\`\``;
}

/**
 * Format inline code
 */
export function formatInlineCode(text: string): string {
  return `\`${text}\``;
}

/**
 * Format a list of items
 */
export function formatList(items: string[], ordered = false): string {
  return items
    .map((item, i) => ordered ? `${i + 1}. ${item}` : `• ${item}`)
    .join('\n');
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format error for display
 */
export function formatError(error: {
  code: string;
  message: string;
  file?: string;
  line?: number;
}): string {
  const location = error.file 
    ? `${formatInlineCode(`${error.file}:${error.line || 1}`)} `
    : '';
  return `${formatInlineCode(error.code)} ${location}${error.message}`;
}

/**
 * Format a list of errors
 */
export function formatErrors(
  errors: Array<{ code: string; message: string; file?: string; line?: number }>,
  maxItems = 5
): string {
  const items = errors.slice(0, maxItems).map(formatError);
  const remaining = errors.length - maxItems;
  
  let result = items.join('\n');
  if (remaining > 0) {
    result += `\n_...and ${remaining} more_`;
  }
  
  return result;
}

// ============================================================================
// Delta Formatting
// ============================================================================

/**
 * Format a numeric delta with sign and color
 */
export function formatDelta(delta: number, suffix = ''): string {
  if (delta > 0) {
    return `📈 +${delta}${suffix}`;
  } else if (delta < 0) {
    return `📉 ${delta}${suffix}`;
  } else {
    return `➡️ 0${suffix}`;
  }
}

/**
 * Format percentage delta
 */
export function formatPercentageDelta(oldValue: number, newValue: number): string {
  const delta = newValue - oldValue;
  return formatDelta(delta, '%');
}
