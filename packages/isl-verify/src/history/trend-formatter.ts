/**
 * Trend Formatters
 * 
 * Format trend data for terminal display and export.
 */

import type { TrendData } from './bundle-history.js';

export interface TrendChartOptions {
  width?: number;
  height?: number;
  showLegend?: boolean;
}

/**
 * Generate ASCII chart for trust score trend
 */
export function formatTrendChart(data: TrendData[], options: TrendChartOptions = {}): string {
  const width = options.width || 60;
  const height = options.height || 15;

  if (data.length === 0) {
    return 'No trend data available';
  }

  const scores = data.map(d => d.trust_score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const lines: string[] = [];

  // Y-axis labels and chart
  for (let y = height - 1; y >= 0; y--) {
    const value = minScore + (range * y / (height - 1));
    const label = value.toFixed(0).padStart(3, ' ');
    
    let line = `${label} │`;

    for (let x = 0; x < Math.min(width, data.length); x++) {
      const dataIndex = Math.floor(x * data.length / width);
      const score = data[dataIndex].trust_score;
      const normalizedScore = (score - minScore) / range;
      const chartY = Math.round(normalizedScore * (height - 1));

      if (chartY === y) {
        line += '●';
      } else if (chartY > y) {
        line += '│';
      } else {
        line += ' ';
      }
    }

    lines.push(line);
  }

  // X-axis
  lines.push('    └' + '─'.repeat(Math.min(width, data.length)));

  // Date labels (first, middle, last)
  if (data.length > 0) {
    const firstDate = new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const lastDate = new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    lines.push(`     ${firstDate}${' '.repeat(Math.max(0, width - firstDate.length - lastDate.length))}${lastDate}`);
  }

  if (options.showLegend !== false) {
    lines.push('');
    lines.push(`Trust Score Trend (${data.length} data points)`);
    lines.push(`Range: ${minScore.toFixed(0)} - ${maxScore.toFixed(0)}`);
    lines.push(`Current: ${scores[scores.length - 1].toFixed(0)}`);
    lines.push(`Average: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0)}`);
  }

  return lines.join('\n');
}

/**
 * Format trend data as JSON for external systems
 */
export function formatTrendJSON(data: TrendData[]): string {
  return JSON.stringify({
    data_points: data.length,
    period: {
      start: data[0]?.date,
      end: data[data.length - 1]?.date,
    },
    metrics: {
      trust_score: {
        current: data[data.length - 1]?.trust_score,
        min: Math.min(...data.map(d => d.trust_score)),
        max: Math.max(...data.map(d => d.trust_score)),
        average: data.reduce((sum, d) => sum + d.trust_score, 0) / data.length,
      },
      properties_proven: {
        current: data[data.length - 1]?.properties_proven,
        average: data.reduce((sum, d) => sum + d.properties_proven, 0) / data.length,
      },
      findings: {
        current: data[data.length - 1]?.findings_count,
        total: data.reduce((sum, d) => sum + d.findings_count, 0),
      },
    },
    data,
  }, null, 2);
}

/**
 * Generate project health badge data
 */
export function generateBadgeData(currentScore: number): {
  score: number;
  color: string;
  label: string;
  message: string;
} {
  let color: string;
  let label: string;

  if (currentScore >= 95) {
    color = 'brightgreen';
    label = 'verified';
  } else if (currentScore >= 85) {
    color = 'green';
    label = 'staging ready';
  } else if (currentScore >= 70) {
    color = 'yellow';
    label = 'shadow mode';
  } else if (currentScore >= 50) {
    color = 'orange';
    label = 'not ready';
  } else {
    color = 'red';
    label = 'critical';
  }

  return {
    score: currentScore,
    color,
    label: 'trust',
    message: `${currentScore}% (${label})`,
  };
}
