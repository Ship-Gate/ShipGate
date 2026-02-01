/**
 * ISL Dependency Analyzer
 * 
 * Analyze dependencies between ISL domains.
 */

export {
  DependencyAnalyzer,
  analyzeDependencies,
  type DependencyGraph,
  type DependencyNode,
  type DependencyEdge,
  type AnalyzerOptions,
} from './analyzer.js';

export {
  detectCycles,
  type Cycle,
  type CycleDetectionResult,
} from './cycles.js';

export {
  analyzeImpact,
  type ImpactAnalysis,
  type ImpactNode,
  type ChangeType,
} from './impact.js';

export {
  findOrphans,
  type OrphanAnalysis,
  type OrphanEntity,
  type OrphanBehavior,
  type OrphanType,
} from './orphans.js';

export {
  generateMermaid,
  generateD2,
  generateDot,
  type VisualizationOptions,
  type DiagramFormat,
} from './visualizer.js';
