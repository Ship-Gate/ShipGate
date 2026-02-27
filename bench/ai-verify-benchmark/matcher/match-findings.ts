import type { ToolFinding, Issue, MatchResult } from '../types.js';

/**
 * Matches tool findings to ground truth issues
 * 
 * Matching criteria:
 * - Same file (exact match)
 * - Line number within ±5 lines (tools may report slightly different lines)
 * - Semantic similarity of messages (optional fuzzy matching)
 */
export function matchFindings(
  findings: ToolFinding[],
  groundTruth: Issue[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const matchedIssues = new Set<number>();

  for (const finding of findings) {
    let bestMatch: Issue | null = null;
    let bestScore = 0;

    for (let i = 0; i < groundTruth.length; i++) {
      if (matchedIssues.has(i)) continue;

      const issue = groundTruth[i];
      const score = calculateMatchScore(finding, issue);

      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = issue;
        if (score >= 0.9) {
          matchedIssues.add(i);
          break; // Perfect match, stop searching
        }
      }
    }

    results.push({
      finding,
      groundTruthMatch: bestMatch,
      matchType: bestMatch ? 'true-positive' : 'false-positive',
    });

    if (bestMatch) {
      const matchedIndex = groundTruth.indexOf(bestMatch);
      if (matchedIndex !== -1) {
        matchedIssues.add(matchedIndex);
      }
    }
  }

  return results;
}

function calculateMatchScore(finding: ToolFinding, issue: Issue): number {
  let score = 0;

  // File match (required)
  const findingFile = normalizePath(finding.file);
  const issueFile = normalizePath(issue.file);
  
  if (findingFile !== issueFile) {
    return 0;
  }
  score += 0.5;

  // Line proximity (within ±5 lines)
  const lineDiff = Math.abs(finding.line - issue.line);
  if (lineDiff === 0) {
    score += 0.5;
  } else if (lineDiff <= 2) {
    score += 0.3;
  } else if (lineDiff <= 5) {
    score += 0.2;
  } else {
    return score * 0.3; // Too far, unlikely match
  }

  return score;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function calculateFalseNegatives(
  matches: MatchResult[],
  groundTruth: Issue[]
): Issue[] {
  const matchedIssues = new Set<Issue>();
  
  for (const match of matches) {
    if (match.groundTruthMatch) {
      matchedIssues.add(match.groundTruthMatch);
    }
  }

  return groundTruth.filter(issue => !matchedIssues.has(issue));
}
