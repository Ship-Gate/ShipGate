// ============================================================================
// ISL Machine Learning - Public API
// Contracts for ML models, training, inference, and fairness
// ============================================================================

// Types
export type {
  DataType,
  Tensor,
  Feature,
  FeatureConstraints,
  DatasetSpec,
  DatasetSplit,
  DataProvenance,
  MLTask,
  Architecture,
  Activation,
  ConvLayer,
  Pooling,
  RNNCellType,
  ModelSpec,
  ModelRequirements,
  Accelerator,
  TrainingConfig,
  Optimizer,
  LossFunction,
  LRScheduler,
  Regularization,
  EarlyStopping,
  Checkpointing,
  InferenceContract,
  MonitoringConfig,
  Prediction,
  Explanation,
  TrainedModel,
  TrainingMetrics,
  EvaluationResult,
  DeployedModel,
  DeploymentStatus,
  FairnessMetrics,
  FairnessConstraint,
  SafetyConstraint,
  ModelCard,
  ModelDetails,
  IntendedUse,
  MetricsSection,
} from './types.js';

// Contracts
export {
  validateModelSpec,
  validateTrainingConfig,
  validateInferenceContract,
  checkContractCompliance,
  validateFairnessConstraint,
  evaluateFairness,
  validateSafetyConstraint,
  checkSafetyConstraints,
  generateModelCard,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './contracts.js';

// ============================================================================
// Builder Functions
// ============================================================================

import type {
  ModelSpec,
  Feature,
  TrainingConfig,
  InferenceContract,
  FairnessConstraint,
  Architecture,
} from './types.js';

/**
 * Create a feature specification
 */
export function feature(
  name: string,
  dtype: Feature['dtype'],
  shape: number[],
  options?: Partial<Omit<Feature, 'name' | 'dtype' | 'shape'>>
): Feature {
  return {
    name,
    dtype,
    shape,
    nullable: false,
    ...options,
  };
}

/**
 * Create an MLP architecture
 */
export function mlp(
  layers: number[],
  activation: Architecture extends { kind: 'MLP' } ? Architecture['activation'] : string = 'relu'
): Architecture {
  return {
    kind: 'MLP',
    layers,
    activation: activation as 'relu',
  };
}

/**
 * Create a Transformer architecture
 */
export function transformer(options: {
  numHeads: number;
  numLayers: number;
  dModel: number;
  dFF: number;
}): Architecture {
  return {
    kind: 'Transformer',
    ...options,
  };
}

/**
 * Create a model specification builder
 */
export function modelSpec(name: string, version: string): ModelSpecBuilder {
  return new ModelSpecBuilder(name, version);
}

class ModelSpecBuilder {
  private spec: Partial<ModelSpec>;

  constructor(name: string, version: string) {
    this.spec = {
      name,
      version,
      hyperparameters: {},
      requirements: {
        minMemory: 0,
        minCompute: 0,
        framework: [],
      },
    };
  }

  task(task: ModelSpec['task']): this {
    this.spec.task = task;
    return this;
  }

  architecture(arch: Architecture): this {
    this.spec.architecture = arch;
    return this;
  }

  input(...features: Feature[]): this {
    this.spec.inputSpec = features;
    return this;
  }

  output(feature: Feature): this {
    this.spec.outputSpec = feature;
    return this;
  }

  parameters(count: number): this {
    this.spec.parameters = count;
    return this;
  }

  hyperparameters(params: Record<string, unknown>): this {
    this.spec.hyperparameters = params;
    return this;
  }

  requirements(reqs: Partial<ModelSpec['requirements']>): this {
    this.spec.requirements = { ...this.spec.requirements!, ...reqs };
    return this;
  }

  build(): ModelSpec {
    if (!this.spec.task) throw new Error('Task is required');
    if (!this.spec.architecture) throw new Error('Architecture is required');
    if (!this.spec.inputSpec) throw new Error('Input spec is required');
    if (!this.spec.outputSpec) throw new Error('Output spec is required');

    return this.spec as ModelSpec;
  }
}

/**
 * Create a training configuration builder
 */
export function trainingConfig(): TrainingConfigBuilder {
  return new TrainingConfigBuilder();
}

class TrainingConfigBuilder {
  private config: Partial<TrainingConfig> = {
    optimizer: 'adam',
    lossFunction: 'cross_entropy',
    batchSize: 32,
    epochs: 10,
    learningRate: 0.001,
  };

  optimizer(opt: TrainingConfig['optimizer']): this {
    this.config.optimizer = opt;
    return this;
  }

  loss(loss: TrainingConfig['lossFunction']): this {
    this.config.lossFunction = loss;
    return this;
  }

  batchSize(size: number): this {
    this.config.batchSize = size;
    return this;
  }

  epochs(n: number): this {
    this.config.epochs = n;
    return this;
  }

  learningRate(lr: number): this {
    this.config.learningRate = lr;
    return this;
  }

  withScheduler(scheduler: TrainingConfig['scheduler']): this {
    this.config.scheduler = scheduler;
    return this;
  }

  withRegularization(reg: TrainingConfig['regularization']): this {
    this.config.regularization = reg;
    return this;
  }

  withEarlyStopping(options: TrainingConfig['earlyStopping']): this {
    this.config.earlyStopping = options;
    return this;
  }

  withCheckpointing(options: TrainingConfig['checkpointing']): this {
    this.config.checkpointing = options;
    return this;
  }

  build(): TrainingConfig {
    return this.config as TrainingConfig;
  }
}

/**
 * Create an inference contract builder
 */
export function inferenceContract(modelSpec: ModelSpec): InferenceContractBuilder {
  return new InferenceContractBuilder(modelSpec);
}

class InferenceContractBuilder {
  private contract: Partial<InferenceContract>;

  constructor(modelSpec: ModelSpec) {
    this.contract = {
      id: `contract-${Date.now()}`,
      modelSpec,
      version: modelSpec.version,
      latencyP50: 100,
      latencyP99: 1000,
      throughput: 100,
      minAccuracy: 0.9,
      maxErrorRate: 0.05,
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxBatchSize: 32,
      monitoring: {
        metricsEnabled: true,
        driftDetection: true,
        alertThresholds: {},
      },
    };
  }

  latency(p50: number, p99: number): this {
    this.contract.latencyP50 = p50;
    this.contract.latencyP99 = p99;
    return this;
  }

  throughput(rps: number): this {
    this.contract.throughput = rps;
    return this;
  }

  accuracy(min: number): this {
    this.contract.minAccuracy = min;
    return this;
  }

  errorRate(max: number): this {
    this.contract.maxErrorRate = max;
    return this;
  }

  memory(max: number): this {
    this.contract.maxMemory = max;
    return this;
  }

  batchSize(max: number): this {
    this.contract.maxBatchSize = max;
    return this;
  }

  monitoring(config: Partial<InferenceContract['monitoring']>): this {
    this.contract.monitoring = { ...this.contract.monitoring!, ...config };
    return this;
  }

  build(): InferenceContract {
    return this.contract as InferenceContract;
  }
}

/**
 * Create a fairness constraint
 */
export function fairnessConstraint(
  protectedAttribute: string,
  metric: string,
  threshold: number,
  groups: string[]
): FairnessConstraint {
  return {
    protectedAttribute,
    metric,
    threshold,
    groups,
  };
}
