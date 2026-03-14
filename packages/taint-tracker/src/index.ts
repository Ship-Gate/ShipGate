export type {
  SourceLocation,
  TaintSourceCategory,
  TaintSource,
  TaintSinkCategory,
  TaintSink,
  SanitizerMethod,
  Sanitizer,
  TaintPathStepKind,
  TaintPathStep,
  TaintFlow,
  FindingSeverity,
  TaintFinding,
} from './model.js';

export type {
  SourcePattern,
  SinkPattern,
  SanitizerPattern,
} from './patterns.js';

export {
  SOURCE_PATTERNS,
  SINK_PATTERNS,
  SANITIZER_PATTERNS,
} from './patterns.js';

export { TaintAnalyzer } from './analyzer.js';
export type { ModuleSummary } from './analyzer.js';

export type { TaintReport } from './reporter.js';
export { formatFinding, formatReport } from './reporter.js';
