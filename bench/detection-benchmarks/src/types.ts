export interface ExpectedFinding {
  type: string;
  line?: number;
  shouldDetect: boolean;
}

export interface TestCase {
  id: string;
  file: string;
  content: string;
  expectedFindings: ExpectedFinding[];
  description: string;
}

export interface BenchmarkResult {
  scanner: string;
  totalCases: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ScannerFinding {
  type: string;
  line?: number;
  message?: string;
  severity?: string;
}

export interface Scanner {
  name: string;
  scan: (content: string, filePath?: string) => ScannerFinding[];
}

export interface BenchmarkSuite {
  name: string;
  category: string;
  testCases: TestCase[];
}

export interface FullReport {
  timestamp: string;
  results: BenchmarkResult[];
  suites: Record<string, BenchmarkResult[]>;
  overall: {
    averagePrecision: number;
    averageRecall: number;
    averageF1: number;
  };
}
