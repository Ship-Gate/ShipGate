export { RaceDetector } from './detector.js';

export { SharedStateAnalyzer } from './analyzers/shared-state.js';
export { ToctouAnalyzer } from './analyzers/toctou.js';
export { DatabaseRaceAnalyzer } from './analyzers/database-race.js';
export { AsyncPatternsAnalyzer } from './analyzers/async-patterns.js';

export { raceDetectorCheck, createRaceDetectorAdapter } from './adapter.js';

export type {
  RaceType,
  Severity,
  RaceFinding,
  RaceDetectorConfig,
  AnalyzerResult,
  Analyzer,
} from './types.js';
