import type { MatchResult, Issue, ToolResults } from '../types.js';
import { calculateFalseNegatives } from '../matcher/match-findings.js';

export function calculateMetrics(
  toolName: string,
  matches: MatchResult[],
  groundTruth: Issue[]
): ToolResults {
  const truePositives = matches.filter(m => m.matchType === 'true-positive').length;
  const falsePositives = matches.filter(m => m.matchType === 'false-positive').length;
  const falseNegativesList = calculateFalseNegatives(matches, groundTruth);
  const falseNegatives = falseNegativesList.length;

  const precision = truePositives + falsePositives > 0
    ? truePositives / (truePositives + falsePositives)
    : 0;

  const recall = truePositives + falseNegatives > 0
    ? truePositives / (truePositives + falseNegatives)
    : 0;

  const f1 = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;

  return {
    tool: toolName,
    findings: matches.map(m => m.finding),
    matches,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
  };
}

export function findUniqueToTool(
  targetMatches: MatchResult[],
  otherToolsMatches: MatchResult[][]
): Issue[] {
  const targetIssues = new Set(
    targetMatches
      .filter(m => m.groundTruthMatch)
      .map(m => m.groundTruthMatch!)
  );

  const otherIssues = new Set<Issue>();
  for (const matches of otherToolsMatches) {
    for (const match of matches) {
      if (match.groundTruthMatch) {
        otherIssues.add(match.groundTruthMatch);
      }
    }
  }

  return Array.from(targetIssues).filter(issue => !otherIssues.has(issue));
}

export function categorizeUniqueIssues(uniqueIssues: Issue[]): {
  category: string;
  subcategory: string;
  count: number;
}[] {
  const categoryMap = new Map<string, Map<string, number>>();

  for (const issue of uniqueIssues) {
    if (!categoryMap.has(issue.category)) {
      categoryMap.set(issue.category, new Map());
    }
    const subMap = categoryMap.get(issue.category)!;
    const currentCount = subMap.get(issue.subcategory) || 0;
    subMap.set(issue.subcategory, currentCount + 1);
  }

  const result: { category: string; subcategory: string; count: number }[] = [];
  
  for (const [category, subMap] of categoryMap.entries()) {
    for (const [subcategory, count] of subMap.entries()) {
      result.push({ category, subcategory, count });
    }
  }

  return result.sort((a, b) => b.count - a.count);
}
