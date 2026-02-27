/**
 * Fake Success UI Detector
 * 
 * Detects UI flows that display success while ignoring failures
 * (the most dangerous hallucination pattern).
 * 
 * @module @isl-lang/fake-success-ui-detector
 */

export {
  detectFakeSuccess,
  detectFakeSuccessBatch,
} from './detector.js';

export type {
  FakeSuccessClaim,
  DetectionResult,
  DetectionOptions,
  FrameworkType,
  PatternType,
  CallChainEvidence,
} from './types.js';

export {
  detectFramework,
  isSuccessNotification,
} from './frameworks/index.js';
