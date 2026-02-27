// ============================================================================
// ISL Machine Learning - Standard Library
// Contracts for ML models, training, inference, and fairness
// ============================================================================

domain MachineLearning
version "0.1.0"
owner "IntentOS"

// ============================================================================
// DATA TYPES
// ============================================================================

/**
 * Tensor - multi-dimensional array
 */
type Tensor<T> = {
  data: List<T>
  shape: List<Int>
  dtype: DataType
  
  invariant shape.length > 0
  invariant shape.all(dim => dim > 0)
  invariant data.length == shape.product()
}

type DataType = enum {
  FLOAT32
  FLOAT64
  INT32
  INT64
  BOOL
  STRING
}

/**
 * Feature specification
 */
type Feature = {
  name: String
  dtype: DataType
  shape: List<Int>
  description: Optional<String>
  nullable: Boolean
  constraints: Optional<FeatureConstraints>
}

type FeatureConstraints = {
  min: Optional<Decimal>
  max: Optional<Decimal>
  categories: Optional<List<String>>
  pattern: Optional<String>
}

/**
 * Dataset specification
 */
type DatasetSpec = {
  name: String
  version: String
  features: List<Feature>
  target: Optional<Feature>
  size: Int
  splits: Map<String, DatasetSplit>
  license: Optional<String>
  provenance: Optional<DataProvenance>
}

type DatasetSplit = {
  name: String      // train, val, test
  size: Int
  ratio: Decimal
}

type DataProvenance = {
  source: String
  collectedAt: Timestamp
  methodology: Optional<String>
  biasWarnings: List<String>
}

// ============================================================================
// MODEL SPECIFICATION
// ============================================================================

/**
 * Model architecture specification
 */
type ModelSpec = {
  name: String
  version: String
  task: MLTask
  architecture: Architecture
  inputSpec: List<Feature>
  outputSpec: Feature
  parameters: Int
  hyperparameters: Map<String, Any>
  requirements: ModelRequirements
}

type MLTask = enum {
  CLASSIFICATION
  REGRESSION
  CLUSTERING
  GENERATION
  SEQUENCE_TO_SEQUENCE
  OBJECT_DETECTION
  SEGMENTATION
  REINFORCEMENT_LEARNING
  RECOMMENDATION
  ANOMALY_DETECTION
  TIME_SERIES_FORECASTING
}

type Architecture = union {
  | Linear { inputDim: Int, outputDim: Int }
  | MLP { layers: List<Int>, activation: Activation }
  | CNN { layers: List<ConvLayer>, pooling: List<Pooling> }
  | RNN { cellType: RNNCellType, hiddenSize: Int, numLayers: Int }
  | Transformer { numHeads: Int, numLayers: Int, dModel: Int, dFF: Int }
  | Custom { name: String, config: Map<String, Any> }
}

type Activation = enum {
  RELU
  SIGMOID
  TANH
  SOFTMAX
  GELU
  SWISH
}

type ConvLayer = {
  filters: Int
  kernelSize: List<Int>
  stride: List<Int>
  padding: String
}

type Pooling = {
  type: String  // max, avg
  size: List<Int>
}

type RNNCellType = enum {
  LSTM
  GRU
  VANILLA
}

type ModelRequirements = {
  minMemory: Int      // bytes
  minCompute: Int     // FLOPs
  accelerator: Optional<Accelerator>
  framework: List<String>
}

type Accelerator = enum {
  CPU
  GPU
  TPU
  NPU
}

// ============================================================================
// TRAINING SPECIFICATION
// ============================================================================

/**
 * Training configuration
 */
type TrainingConfig = {
  optimizer: Optimizer
  lossFunction: LossFunction
  batchSize: Int { min: 1, max: 10000 }
  epochs: Int { min: 1 }
  learningRate: Decimal { min: 0, max: 1 }
  scheduler: Optional<LRScheduler>
  regularization: Optional<Regularization>
  earlyStopping: Optional<EarlyStopping>
  checkpointing: Optional<Checkpointing>
}

type Optimizer = enum {
  SGD
  ADAM
  ADAMW
  RMSPROP
  ADAGRAD
}

type LossFunction = enum {
  CROSS_ENTROPY
  MSE
  MAE
  HUBER
  FOCAL
  CONTRASTIVE
  TRIPLET
}

type LRScheduler = {
  type: String  // step, cosine, warmup
  params: Map<String, Any>
}

type Regularization = {
  l1: Optional<Decimal>
  l2: Optional<Decimal>
  dropout: Optional<Decimal>
}

type EarlyStopping = {
  metric: String
  patience: Int
  minDelta: Decimal
  mode: String  // min, max
}

type Checkpointing = {
  saveFrequency: Int
  maxToKeep: Int
  saveBest: Boolean
  metric: String
}

// ============================================================================
// INFERENCE CONTRACTS
// ============================================================================

/**
 * Inference contract
 */
entity InferenceContract {
  id: UUID
  modelSpec: ModelSpec
  version: String
  
  // Performance guarantees
  latencyP50: Duration { max: 10s }
  latencyP99: Duration { max: 30s }
  throughput: Int       // requests per second
  
  // Quality guarantees
  minAccuracy: Decimal { min: 0, max: 1 }
  maxErrorRate: Decimal { min: 0, max: 1 }
  
  // Resource bounds
  maxMemory: Int        // bytes
  maxBatchSize: Int
  
  // Monitoring
  monitoring: MonitoringConfig
}

type MonitoringConfig = {
  metricsEnabled: Boolean
  driftDetection: Boolean
  alertThresholds: Map<String, Decimal>
}

/**
 * Make inference
 */
behavior Predict<I, O> {
  description: "Make prediction using the model"
  
  input {
    model: ModelSpec
    data: I
    options: Optional<PredictOptions>
  }
  
  output {
    success: Prediction<O>
    errors {
      InvalidInput when "Input does not match model spec"
      ModelNotReady when "Model is not loaded"
      InferenceFailed when "Inference failed"
      Timeout when "Inference exceeded latency limit"
    }
  }
  
  temporal {
    complete within InferenceContract.latencyP99
  }
  
  postcondition {
    output.confidence >= 0 and output.confidence <= 1
    output.latency <= InferenceContract.latencyP99
  }
}

type PredictOptions = {
  returnProbabilities: Boolean
  topK: Optional<Int>
  threshold: Optional<Decimal>
  explain: Boolean
}

type Prediction<O> = {
  result: O
  confidence: Decimal
  probabilities: Optional<Map<String, Decimal>>
  latency: Duration
  explanation: Optional<Explanation>
}

type Explanation = {
  method: String  // SHAP, LIME, attention
  featureImportance: Map<String, Decimal>
  visualizations: Optional<List<String>>
}

// ============================================================================
// FAIRNESS & SAFETY
// ============================================================================

/**
 * Fairness metrics
 */
type FairnessMetrics = {
  demographicParity: Decimal
  equalizedOdds: Decimal
  equalOpportunity: Decimal
  predictiveParity: Decimal
  individualFairness: Decimal
}

/**
 * Fairness constraint
 */
type FairnessConstraint = {
  protectedAttribute: String
  metric: String
  threshold: Decimal
  groups: List<String>
}

/**
 * Safety constraint
 */
type SafetyConstraint = union {
  | ContentFilter { categories: List<String>, threshold: Decimal }
  | OutputBound { min: Optional<Decimal>, max: Optional<Decimal> }
  | Toxicity { maxScore: Decimal }
  | Hallucination { factCheckRequired: Boolean }
  | Privacy { noPersonalInfo: Boolean, anonymization: Boolean }
}

/**
 * Model card - documentation
 */
type ModelCard = {
  modelDetails: ModelDetails
  intendedUse: IntendedUse
  factors: List<String>
  metrics: MetricsSection
  evaluationData: List<DatasetSpec>
  trainingData: List<DatasetSpec>
  ethicalConsiderations: List<String>
  limitations: List<String>
}

type ModelDetails = {
  name: String
  version: String
  type: String
  developedBy: String
  license: String
  finetuned: Boolean
  baseModel: Optional<String>
}

type IntendedUse = {
  primaryUses: List<String>
  outOfScopeUses: List<String>
  users: List<String>
}

type MetricsSection = {
  performanceMetrics: Map<String, Decimal>
  fairnessMetrics: Optional<FairnessMetrics>
  safetyMetrics: Optional<Map<String, Decimal>>
}

// ============================================================================
// TRAINING BEHAVIORS
// ============================================================================

/**
 * Train a model
 */
behavior TrainModel {
  description: "Train a model on a dataset"
  
  input {
    modelSpec: ModelSpec
    datasetSpec: DatasetSpec
    config: TrainingConfig
  }
  
  output {
    success: TrainedModel
    errors {
      DatasetNotFound when "Dataset not available"
      ResourceExhausted when "Not enough compute resources"
      TrainingFailed when "Training diverged or failed"
    }
  }
  
  effects {
    creates TrainedModel
    uses Compute
  }
  
  postcondition {
    output.metrics.loss is finite
    output.epochs == config.epochs or output.earlyStopped
  }
}

type TrainedModel = {
  id: UUID
  spec: ModelSpec
  weights: String  // path or reference
  metrics: TrainingMetrics
  epochs: Int
  earlyStopped: Boolean
  trainingTime: Duration
  checkpoint: String
}

type TrainingMetrics = {
  loss: Decimal
  accuracy: Optional<Decimal>
  precision: Optional<Decimal>
  recall: Optional<Decimal>
  f1: Optional<Decimal>
  auc: Optional<Decimal>
  custom: Map<String, Decimal>
}

/**
 * Evaluate a model
 */
behavior EvaluateModel {
  description: "Evaluate model on a test set"
  
  input {
    model: TrainedModel
    testSet: DatasetSpec
    metrics: List<String>
  }
  
  output {
    success: EvaluationResult
    errors {
      ModelNotFound when "Model not available"
      DatasetNotFound when "Dataset not available"
    }
  }
  
  postcondition {
    output.sampleCount == testSet.size
  }
}

type EvaluationResult = {
  metrics: Map<String, Decimal>
  confusionMatrix: Optional<List<List<Int>>>
  perClassMetrics: Optional<Map<String, Map<String, Decimal>>>
  sampleCount: Int
  evaluationTime: Duration
}

/**
 * Deploy a model
 */
behavior DeployModel {
  description: "Deploy model to inference endpoint"
  
  input {
    model: TrainedModel
    contract: InferenceContract
    replicas: Int { min: 1, max: 100 }
  }
  
  output {
    success: DeployedModel
    errors {
      InsufficientResources when "Not enough resources for deployment"
      ContractViolation when "Model cannot meet contract requirements"
    }
  }
  
  effects {
    creates DeployedModel
  }
  
  postcondition {
    DeployedModel.status == READY
    DeployedModel.replicas >= input.replicas
  }
}

type DeployedModel = {
  id: UUID
  model: TrainedModel
  contract: InferenceContract
  endpoint: String
  status: DeploymentStatus
  replicas: Int
  deployedAt: Timestamp
}

type DeploymentStatus = enum {
  PENDING
  DEPLOYING
  READY
  DEGRADED
  FAILED
}

// ============================================================================
// INVARIANTS
// ============================================================================

invariants MLInvariants {
  // Model accuracy must be above random baseline
  forall m: TrainedModel where m.spec.task == CLASSIFICATION =>
    m.metrics.accuracy > 1.0 / m.spec.outputSpec.shape[0]
  
  // Deployed models must meet their contracts
  forall d: DeployedModel where d.status == READY =>
    d.model.metrics.accuracy >= d.contract.minAccuracy
  
  // Fairness constraints must be satisfied
  forall d: DeployedModel with fairnessConstraints: List<FairnessConstraint> =>
    fairnessConstraints.all(c => 
      evaluateFairness(d.model, c.protectedAttribute, c.metric) >= c.threshold
    )
  
  // Training data and test data must not overlap
  forall m: TrainedModel, e: EvaluationResult =>
    m.trainingData intersect e.testSet == empty
}
