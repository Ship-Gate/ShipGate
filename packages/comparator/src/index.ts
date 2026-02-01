/**
 * ISL Implementation Comparator
 * 
 * Compare multiple implementations of the same ISL behavior across
 * equivalence, performance, and coverage dimensions.
 */

// Main comparison function
export { 
  compare,
  quickCompare,
  compareWithReference,
  type Implementation,
  type ImplementationFunction,
  type TestInput,
  type CompareOptions,
} from './comparator.js';

// Equivalence checking
export {
  checkEquivalence,
  checkAllEquivalence,
  deepEqual,
  isDeepEqual,
  type Difference,
  type DifferenceCategory,
  type DifferenceSeverity,
  type EquivalenceResult,
  type EquivalenceOptions,
  type ExecutionResult,
  type BehaviorGroup,
} from './equivalence.js';

// Output differencing
export {
  diff,
  generateDiff,
  generateOutputDiff,
  generateMultiDiff,
  formatChange,
  formatDiff,
  type DiffChange,
  type OutputDiff,
  type DiffSummary,
  type DiffOptions,
  type MultiDiff,
  type AggregatedDiff,
  type SimilarityGroup,
} from './differ.js';

// Performance comparison
export {
  benchmark,
  calculateMetrics,
  comparePerformance,
  formatMetrics,
  formatComparisonTable,
  type PerformanceMetrics,
  type PerformanceResult,
  type PerformanceRankings,
  type PerformanceSummary,
  type PerformanceOptions,
  type RankingWeights,
  type TimingData,
} from './performance.js';

// Coverage comparison
export {
  calculateCoverage,
  compareCoverage,
  analyzeCoverageGaps,
  formatCoverage,
  formatCoverageTable,
  type TestCaseResult,
  type TestCategory,
  type CoverageMetrics,
  type CategoryCoverage,
  type CoverageResult,
  type DivergentTest,
  type CoverageComparison,
  type CoverageOptions,
  type CoverageGap,
} from './coverage.js';

// Report generation
export {
  generateRecommendations,
  generateOverallRecommendation,
  generateReport,
  generateTextReport,
  generateMarkdownReport,
  generateJSONReport,
  type ComparisonResult,
  type ImplementationInfo,
  type Recommendation,
  type ReportOptions,
} from './reporter.js';

// Visualization
export {
  horizontalBarChart,
  groupedBarChart,
  visualizePerformance,
  visualizeCoverage,
  visualizeDifferences,
  similarityHeatmap,
  generateDashboard,
  Colors,
  type VisualizationOptions,
} from './visualizer.js';
