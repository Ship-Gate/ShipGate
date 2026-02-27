/**
 * ASCII Charts
 * 
 * Create ASCII-based charts for Slack messages.
 */

// ============================================================================
// Progress Bars
// ============================================================================

/**
 * Create an ASCII progress bar
 */
export function createProgressBar(
  percentage: number,
  options: {
    width?: number;
    filled?: string;
    empty?: string;
    showPercentage?: boolean;
  } = {}
): string {
  const {
    width = 10,
    filled = '█',
    empty = '░',
    showPercentage = false,
  } = options;

  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round((clampedPercentage / 100) * width);
  const emptyCount = width - filledCount;

  let bar = filled.repeat(filledCount) + empty.repeat(emptyCount);
  
  if (showPercentage) {
    bar += ` ${Math.round(clampedPercentage)}%`;
  }

  return bar;
}

/**
 * Create a colored progress bar using Slack emoji
 */
export function createEmojiProgressBar(
  percentage: number,
  width = 10
): string {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round((clampedPercentage / 100) * width);
  const emptyCount = width - filledCount;

  // Choose color based on percentage
  let filled: string;
  if (clampedPercentage >= 80) {
    filled = '🟩';
  } else if (clampedPercentage >= 60) {
    filled = '🟨';
  } else if (clampedPercentage >= 40) {
    filled = '🟧';
  } else {
    filled = '🟥';
  }

  return filled.repeat(filledCount) + '⬜'.repeat(emptyCount);
}

// ============================================================================
// Comparison Bars
// ============================================================================

/**
 * Create a comparison bar showing old vs new value
 */
export function createComparisonBar(
  oldValue: number,
  newValue: number,
  width = 10
): string {
  const oldBar = createProgressBar(oldValue, { width: width / 2, showPercentage: false });
  const newBar = createProgressBar(newValue, { width: width / 2, showPercentage: false });
  const delta = newValue - oldValue;
  const deltaSymbol = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  
  return `${oldValue}% ${oldBar} → ${newBar} ${newValue}% ${deltaSymbol}`;
}

/**
 * Create a simple delta indicator
 */
export function createDeltaIndicator(delta: number): string {
  if (delta > 10) return '⬆️⬆️';
  if (delta > 0) return '⬆️';
  if (delta < -10) return '⬇️⬇️';
  if (delta < 0) return '⬇️';
  return '➡️';
}

// ============================================================================
// Sparklines
// ============================================================================

/**
 * Create a sparkline from values
 */
export function createSparkline(values: number[]): string {
  if (values.length === 0) return '';
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  return values
    .map(v => {
      const normalized = (v - min) / range;
      const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
      return chars[index];
    })
    .join('');
}

/**
 * Create a trend indicator from recent values
 */
export function createTrendIndicator(values: number[]): string {
  if (values.length < 2) return '➡️';
  
  const recent = values.slice(-5);
  const first = recent[0] || 0;
  const last = recent[recent.length - 1] || 0;
  const diff = last - first;
  
  if (diff > 5) return '📈 Improving';
  if (diff < -5) return '📉 Declining';
  return '➡️ Stable';
}

// ============================================================================
// Coverage Charts
// ============================================================================

/**
 * Create a coverage summary chart
 */
export function createCoverageChart(coverage: {
  preconditions: number;
  postconditions: number;
  invariants: number;
  temporal: number;
}): string {
  const lines = [
    `Pre:  ${createProgressBar(coverage.preconditions)} ${coverage.preconditions}%`,
    `Post: ${createProgressBar(coverage.postconditions)} ${coverage.postconditions}%`,
    `Inv:  ${createProgressBar(coverage.invariants)} ${coverage.invariants}%`,
    `Temp: ${createProgressBar(coverage.temporal)} ${coverage.temporal}%`,
  ];
  
  return lines.join('\n');
}

/**
 * Create a compact coverage summary
 */
export function createCompactCoverage(coverage: {
  preconditions: number;
  postconditions: number;
  invariants: number;
  temporal: number;
}): string {
  const avg = Math.round(
    (coverage.preconditions + coverage.postconditions + coverage.invariants + coverage.temporal) / 4
  );
  
  return `${createEmojiProgressBar(avg, 5)} ${avg}% avg`;
}

// ============================================================================
// Verdict Distribution
// ============================================================================

/**
 * Create a verdict distribution chart
 */
export function createVerdictDistribution(
  verified: number,
  risky: number,
  unsafe: number
): string {
  const total = verified + risky + unsafe;
  if (total === 0) return '_No data_';

  const verifiedPct = Math.round((verified / total) * 100);
  const riskyPct = Math.round((risky / total) * 100);
  const unsafePct = Math.round((unsafe / total) * 100);

  const width = 20;
  const verifiedWidth = Math.round((verifiedPct / 100) * width);
  const riskyWidth = Math.round((riskyPct / 100) * width);
  const unsafeWidth = width - verifiedWidth - riskyWidth;

  const bar = '🟩'.repeat(verifiedWidth) + '🟨'.repeat(riskyWidth) + '🟥'.repeat(unsafeWidth);
  
  return `${bar}\n✅ ${verified} (${verifiedPct}%) | ⚠️ ${risky} (${riskyPct}%) | ❌ ${unsafe} (${unsafePct}%)`;
}

// ============================================================================
// Time Series
// ============================================================================

/**
 * Format a time series of scores
 */
export function formatScoreHistory(
  history: Array<{ date: Date; score: number }>
): string {
  if (history.length === 0) return '_No history_';

  const scores = history.map(h => h.score);
  const sparkline = createSparkline(scores);
  const trend = createTrendIndicator(scores);
  
  const latest = history[history.length - 1];
  const oldest = history[0];
  
  return `${sparkline}\n${oldest?.score || 0} → ${latest?.score || 0} ${trend}`;
}

// ============================================================================
// Horizontal Bar Chart
// ============================================================================

/**
 * Create a horizontal bar chart
 */
export function createHorizontalBarChart(
  data: Array<{ label: string; value: number }>,
  options: {
    maxLabelWidth?: number;
    barWidth?: number;
    showValues?: boolean;
  } = {}
): string {
  const {
    maxLabelWidth = 15,
    barWidth = 20,
    showValues = true,
  } = options;

  if (data.length === 0) return '_No data_';

  const maxValue = Math.max(...data.map(d => d.value));
  
  return data.map(({ label, value }) => {
    const truncatedLabel = label.length > maxLabelWidth 
      ? label.substring(0, maxLabelWidth - 2) + '..'
      : label.padEnd(maxLabelWidth);
    
    const barLength = maxValue > 0 ? Math.round((value / maxValue) * barWidth) : 0;
    const bar = '█'.repeat(barLength);
    
    const valueStr = showValues ? ` ${value}` : '';
    
    return `${truncatedLabel} ${bar}${valueStr}`;
  }).join('\n');
}
