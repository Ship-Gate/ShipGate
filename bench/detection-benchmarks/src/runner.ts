import type {
  TestCase,
  BenchmarkResult,
  ScannerFinding,
  ExpectedFinding,
} from './types.js';

interface ScannerAdapter {
  name: string;
  scan: (content: string, filePath?: string) => ScannerFinding[];
}

export class BenchmarkRunner {
  private scanner: ScannerAdapter;

  constructor(scanner: ScannerAdapter) {
    this.scanner = scanner;
  }

  run(testCases: TestCase[]): BenchmarkResult {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const testCase of testCases) {
      const findings = this.scanner.scan(testCase.content, testCase.file);
      const classification = this.classifyFindings(
        findings,
        testCase.expectedFindings,
      );

      truePositives += classification.truePositives;
      falsePositives += classification.falsePositives;
      trueNegatives += classification.trueNegatives;
      falseNegatives += classification.falseNegatives;
    }

    const precision = this.safeDivide(
      truePositives,
      truePositives + falsePositives,
    );
    const recall = this.safeDivide(
      truePositives,
      truePositives + falseNegatives,
    );
    const f1Score = this.safeDivide(
      2 * precision * recall,
      precision + recall,
    );

    return {
      scanner: this.scanner.name,
      totalCases: testCases.length,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      precision,
      recall,
      f1Score,
    };
  }

  private classifyFindings(
    actualFindings: ScannerFinding[],
    expectedFindings: ExpectedFinding[],
  ) {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    const matchedActual = new Set<number>();

    for (const expected of expectedFindings) {
      const matchIndex = actualFindings.findIndex((actual, idx) => {
        if (matchedActual.has(idx)) return false;
        return this.findingsMatch(actual, expected);
      });

      if (expected.shouldDetect) {
        if (matchIndex >= 0) {
          truePositives++;
          matchedActual.add(matchIndex);
        } else {
          falseNegatives++;
        }
      } else {
        if (matchIndex >= 0) {
          falsePositives++;
          matchedActual.add(matchIndex);
        } else {
          trueNegatives++;
        }
      }
    }

    for (let i = 0; i < actualFindings.length; i++) {
      if (!matchedActual.has(i)) {
        falsePositives++;
      }
    }

    return { truePositives, falsePositives, trueNegatives, falseNegatives };
  }

  private findingsMatch(
    actual: ScannerFinding,
    expected: ExpectedFinding,
  ): boolean {
    const typeMatch =
      actual.type === expected.type ||
      actual.type.toLowerCase().includes(expected.type.toLowerCase()) ||
      expected.type.toLowerCase().includes(actual.type.toLowerCase());

    if (!typeMatch) return false;

    if (expected.line !== undefined && actual.line !== undefined) {
      return Math.abs(actual.line - expected.line) <= 2;
    }

    return true;
  }

  private safeDivide(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 10000) / 10000;
  }
}
