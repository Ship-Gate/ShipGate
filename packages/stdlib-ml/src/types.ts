// ============================================================================
// ISL Machine Learning - Type Definitions
// ============================================================================

/**
 * Data types for tensors
 */
export type DataType = 'float32' | 'float64' | 'int32' | 'int64' | 'bool' | 'string';

/**
 * Tensor - multi-dimensional array
 */
export interface Tensor<T = number> {
  data: T[];
  shape: number[];
  dtype: DataType;
}

/**
 * Feature specification
 */
export interface Feature {
  name: string;
  dtype: DataType;
  shape: number[];
  description?: string;
  nullable: boolean;
  constraints?: FeatureConstraints;
}

export interface FeatureConstraints {
  min?: number;
  max?: number;
  categories?: string[];
  pattern?: string;
}

/**
 * Dataset specification
 */
export interface DatasetSpec {
  name: string;
  version: string;
  features: Feature[];
  target?: Feature;
  size: number;
  splits: Record<string, DatasetSplit>;
  license?: string;
  provenance?: DataProvenance;
}

export interface DatasetSplit {
  name: string;
  size: number;
  ratio: number;
}

export interface DataProvenance {
  source: string;
  collectedAt: Date;
  methodology?: string;
  biasWarnings: string[];
}

/**
 * ML Task types
 */
export type MLTask =
  | 'classification'
  | 'regression'
  | 'clustering'
  | 'generation'
  | 'sequence_to_sequence'
  | 'object_detection'
  | 'segmentation'
  | 'reinforcement_learning'
  | 'recommendation'
  | 'anomaly_detection'
  | 'time_series_forecasting';

/**
 * Model architecture
 */
export type Architecture =
  | { kind: 'Linear'; inputDim: number; outputDim: number }
  | { kind: 'MLP'; layers: number[]; activation: Activation }
  | { kind: 'CNN'; layers: ConvLayer[]; pooling: Pooling[] }
  | { kind: 'RNN'; cellType: RNNCellType; hiddenSize: number; numLayers: number }
  | { kind: 'Transformer'; numHeads: number; numLayers: number; dModel: number; dFF: number }
  | { kind: 'Custom'; name: string; config: Record<string, unknown> };

export type Activation = 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'gelu' | 'swish';

export interface ConvLayer {
  filters: number;
  kernelSize: number[];
  stride: number[];
  padding: string;
}

export interface Pooling {
  type: 'max' | 'avg';
  size: number[];
}

export type RNNCellType = 'lstm' | 'gru' | 'vanilla';

/**
 * Model specification
 */
export interface ModelSpec {
  name: string;
  version: string;
  task: MLTask;
  architecture: Architecture;
  inputSpec: Feature[];
  outputSpec: Feature;
  parameters: number;
  hyperparameters: Record<string, unknown>;
  requirements: ModelRequirements;
}

export interface ModelRequirements {
  minMemory: number;
  minCompute: number;
  accelerator?: Accelerator;
  framework: string[];
}

export type Accelerator = 'cpu' | 'gpu' | 'tpu' | 'npu';

/**
 * Training configuration
 */
export interface TrainingConfig {
  optimizer: Optimizer;
  lossFunction: LossFunction;
  batchSize: number;
  epochs: number;
  learningRate: number;
  scheduler?: LRScheduler;
  regularization?: Regularization;
  earlyStopping?: EarlyStopping;
  checkpointing?: Checkpointing;
}

export type Optimizer = 'sgd' | 'adam' | 'adamw' | 'rmsprop' | 'adagrad';

export type LossFunction =
  | 'cross_entropy'
  | 'mse'
  | 'mae'
  | 'huber'
  | 'focal'
  | 'contrastive'
  | 'triplet';

export interface LRScheduler {
  type: string;
  params: Record<string, unknown>;
}

export interface Regularization {
  l1?: number;
  l2?: number;
  dropout?: number;
}

export interface EarlyStopping {
  metric: string;
  patience: number;
  minDelta: number;
  mode: 'min' | 'max';
}

export interface Checkpointing {
  saveFrequency: number;
  maxToKeep: number;
  saveBest: boolean;
  metric: string;
}

/**
 * Inference contract
 */
export interface InferenceContract {
  id: string;
  modelSpec: ModelSpec;
  version: string;
  latencyP50: number;
  latencyP99: number;
  throughput: number;
  minAccuracy: number;
  maxErrorRate: number;
  maxMemory: number;
  maxBatchSize: number;
  monitoring: MonitoringConfig;
}

export interface MonitoringConfig {
  metricsEnabled: boolean;
  driftDetection: boolean;
  alertThresholds: Record<string, number>;
}

/**
 * Prediction result
 */
export interface Prediction<O = unknown> {
  result: O;
  confidence: number;
  probabilities?: Record<string, number>;
  latency: number;
  explanation?: Explanation;
}

export interface Explanation {
  method: string;
  featureImportance: Record<string, number>;
  visualizations?: string[];
}

/**
 * Trained model
 */
export interface TrainedModel {
  id: string;
  spec: ModelSpec;
  weights: string;
  metrics: TrainingMetrics;
  epochs: number;
  earlyStopped: boolean;
  trainingTime: number;
  checkpoint: string;
}

export interface TrainingMetrics {
  loss: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  auc?: number;
  custom: Record<string, number>;
}

/**
 * Evaluation result
 */
export interface EvaluationResult {
  metrics: Record<string, number>;
  confusionMatrix?: number[][];
  perClassMetrics?: Record<string, Record<string, number>>;
  sampleCount: number;
  evaluationTime: number;
}

/**
 * Deployed model
 */
export interface DeployedModel {
  id: string;
  model: TrainedModel;
  contract: InferenceContract;
  endpoint: string;
  status: DeploymentStatus;
  replicas: number;
  deployedAt: Date;
}

export type DeploymentStatus = 'pending' | 'deploying' | 'ready' | 'degraded' | 'failed';

/**
 * Fairness metrics
 */
export interface FairnessMetrics {
  demographicParity: number;
  equalizedOdds: number;
  equalOpportunity: number;
  predictiveParity: number;
  individualFairness: number;
}

/**
 * Fairness constraint
 */
export interface FairnessConstraint {
  protectedAttribute: string;
  metric: string;
  threshold: number;
  groups: string[];
}

/**
 * Safety constraint
 */
export type SafetyConstraint =
  | { kind: 'ContentFilter'; categories: string[]; threshold: number }
  | { kind: 'OutputBound'; min?: number; max?: number }
  | { kind: 'Toxicity'; maxScore: number }
  | { kind: 'Hallucination'; factCheckRequired: boolean }
  | { kind: 'Privacy'; noPersonalInfo: boolean; anonymization: boolean };

/**
 * Model card
 */
export interface ModelCard {
  modelDetails: ModelDetails;
  intendedUse: IntendedUse;
  factors: string[];
  metrics: MetricsSection;
  evaluationData: DatasetSpec[];
  trainingData: DatasetSpec[];
  ethicalConsiderations: string[];
  limitations: string[];
}

export interface ModelDetails {
  name: string;
  version: string;
  type: string;
  developedBy: string;
  license: string;
  finetuned: boolean;
  baseModel?: string;
}

export interface IntendedUse {
  primaryUses: string[];
  outOfScopeUses: string[];
  users: string[];
}

export interface MetricsSection {
  performanceMetrics: Record<string, number>;
  fairnessMetrics?: FairnessMetrics;
  safetyMetrics?: Record<string, number>;
}
