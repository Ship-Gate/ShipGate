/**
 * Types for ISL Verify benchmark system
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IssueCategory = 
  | 'hallucination' 
  | 'security' 
  | 'quality' 
  | 'dead-code' 
  | 'type-error';

export interface Issue {
  file: string;
  line: number;
  category: IssueCategory;
  subcategory: string;
  description: string;
  severity: IssueSeverity;
  planted: boolean;
}

export interface GroundTruth {
  project: string;
  generatedWith: {
    tool: string;
    prompt: string;
    date: string;
  };
  issues: Issue[];
}

export interface ToolFinding {
  tool: 'isl-verify' | 'eslint' | 'tsc' | 'semgrep';
  file: string;
  line: number;
  ruleId: string;
  message: string;
  severity: string;
}

export interface MatchResult {
  finding: ToolFinding;
  groundTruthMatch: Issue | null;
  matchType: 'true-positive' | 'false-positive';
}

export interface ToolResults {
  tool: string;
  findings: ToolFinding[];
  matches: MatchResult[];
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkResults {
  totalGroundTruthIssues: number;
  toolResults: ToolResults[];
  uniqueToIslVerify: Issue[];
  comparisonTable: {
    metric: string;
    islVerify: string;
    eslint: string;
    tsc: string;
    semgrep: string;
  }[];
  marketingClaims: string[];
}

export interface ProjectFixture {
  name: string;
  path: string;
  framework: 'nextjs' | 'express' | 'fastify' | 'react';
  description: string;
}
