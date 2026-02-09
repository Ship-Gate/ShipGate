/**
 * Generic Framework Adapter
 * Detects generic notification patterns that aren't framework-specific
 */

/**
 * Generic notification patterns
 */
export const GENERIC_NOTIFICATION_PATTERNS = [
  /showNotification/i,
  /displayMessage/i,
  /showAlert/i,
  /notify/i,
  /alert\(/,
  /console\.(log|info|warn)/, // Less common but still a pattern
];

/**
 * Generic success indicators
 */
export const GENERIC_SUCCESS_INDICATORS = [
  /success/i,
  /Success/i,
  /SUCCESS/,
  /'success'/,
  /"success"/,
  /`success`/,
];

/**
 * Detect generic notification patterns
 */
export function detectGenericNotifications(content: string): Array<{
  method: string;
  line: number;
  column: number;
}> {
  const notifications: Array<{ method: string; line: number; column: number }> =
    [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    for (const pattern of GENERIC_NOTIFICATION_PATTERNS) {
      const match = line.match(pattern);
      if (match && match.index !== undefined) {
        // Check if it's a success notification
        const isSuccess = GENERIC_SUCCESS_INDICATORS.some(indicator =>
          line.match(indicator)
        );
        if (isSuccess) {
          notifications.push({
            method: match[0] || '',
            line: i + 1,
            column: match.index + 1,
          });
        }
      }
    }
  }

  return notifications;
}
