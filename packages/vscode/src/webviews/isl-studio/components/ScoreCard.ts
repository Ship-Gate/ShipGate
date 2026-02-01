/**
 * Score Card Component
 * 
 * Displays the overall verification score with breakdown.
 */

import type { ScoreBreakdown, VerificationResult } from '../evidenceViewState';
import { calculateSummary } from '../evidenceViewState';

/**
 * Get score class based on value
 */
function getScoreClass(score: number): string {
  if (score >= 80) return 'pass';
  if (score >= 50) return 'partial';
  return 'fail';
}

/**
 * Build the score card HTML
 */
export function buildScoreCard(
  score: number,
  results: ReadonlyArray<VerificationResult>,
  breakdown?: ScoreBreakdown
): string {
  const scoreClass = getScoreClass(score);
  const summary = calculateSummary(results);

  const breakdownHtml = breakdown
    ? `
      <div class="score-breakdown">
        ${breakdown.preconditions !== undefined ? `
          <div class="breakdown-item">
            <div class="breakdown-value">${breakdown.preconditions}%</div>
            <div class="breakdown-label">Preconditions</div>
          </div>
        ` : ''}
        ${breakdown.postconditions !== undefined ? `
          <div class="breakdown-item">
            <div class="breakdown-value">${breakdown.postconditions}%</div>
            <div class="breakdown-label">Postconditions</div>
          </div>
        ` : ''}
        ${breakdown.invariants !== undefined ? `
          <div class="breakdown-item">
            <div class="breakdown-value">${breakdown.invariants}%</div>
            <div class="breakdown-label">Invariants</div>
          </div>
        ` : ''}
        ${breakdown.scenarios !== undefined ? `
          <div class="breakdown-item">
            <div class="breakdown-value">${breakdown.scenarios}%</div>
            <div class="breakdown-label">Scenarios</div>
          </div>
        ` : ''}
      </div>
    `
    : '';

  return `
    <div class="score-card">
      <div class="score-value ${scoreClass}">${score}</div>
      <div class="score-label">Verification Score</div>
      
      <div class="summary-badges">
        ${summary.pass > 0 ? `
          <span class="badge pass">
            <span class="badge-count">${summary.pass}</span> PASS
          </span>
        ` : ''}
        ${summary.partial > 0 ? `
          <span class="badge partial">
            <span class="badge-count">${summary.partial}</span> PARTIAL
          </span>
        ` : ''}
        ${summary.fail > 0 ? `
          <span class="badge fail">
            <span class="badge-count">${summary.fail}</span> FAIL
          </span>
        ` : ''}
      </div>
      
      ${breakdownHtml}
    </div>
  `;
}
