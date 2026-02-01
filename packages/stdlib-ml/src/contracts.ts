// ============================================================================
// ISL Machine Learning - Contract Validation
// ============================================================================

import type {
  ModelSpec,
  TrainingConfig,
  InferenceContract,
  TrainedModel,
  Prediction,
  FairnessConstraint,
  FairnessMetrics,
  SafetyConstraint,
  Feature,
  DatasetSpec,
} from './types.js';

/**
 * Contract validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

/**
 * Validate model specification
 */
export function validateModelSpec(spec: ModelSpec): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate name
  if (!spec.name || spec.name.length < 1) {
    errors.push({ code: 'INVALID_NAME', message: 'Model name is required', path: 'name' });
  }

  // Validate version
  if (!spec.version.match(/^\d+\.\d+\.\d+$/)) {
    warnings.push({
      code: 'INVALID_VERSION',
      message: 'Version should follow semver format',
      suggestion: 'Use format: major.minor.patch',
    });
  }

  // Validate architecture parameters
  validateArchitecture(spec.architecture, errors, warnings);

  // Validate input/output specs
  for (const feature of spec.inputSpec) {
    validateFeature(feature, 'inputSpec', errors);
  }
  validateFeature(spec.outputSpec, 'outputSpec', errors);

  // Validate requirements
  if (spec.requirements.minMemory < 0) {
    errors.push({ code: 'INVALID_MEMORY', message: 'Minimum memory must be positive', path: 'requirements.minMemory' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate architecture
 */
function validateArchitecture(
  arch: ModelSpec['architecture'],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  switch (arch.kind) {
    case 'MLP':
      if (arch.layers.length === 0) {
        errors.push({ code: 'INVALID_LAYERS', message: 'MLP must have at least one layer' });
      }
      if (arch.layers.some(l => l <= 0)) {
        errors.push({ code: 'INVALID_LAYER_SIZE', message: 'Layer sizes must be positive' });
      }
      break;

    case 'Transformer':
      if (arch.dModel % arch.numHeads !== 0) {
        errors.push({
          code: 'INVALID_TRANSFORMER',
          message: 'dModel must be divisible by numHeads',
        });
      }
      if (arch.numLayers < 1) {
        errors.push({ code: 'INVALID_LAYERS', message: 'Transformer must have at least one layer' });
      }
      break;

    case 'CNN':
      if (arch.layers.length === 0) {
        errors.push({ code: 'INVALID_LAYERS', message: 'CNN must have at least one layer' });
      }
      break;
  }
}

/**
 * Validate feature
 */
function validateFeature(feature: Feature, path: string, errors: ValidationError[]): void {
  if (!feature.name) {
    errors.push({ code: 'INVALID_FEATURE', message: 'Feature name is required', path });
  }

  if (feature.shape.length === 0) {
    errors.push({ code: 'INVALID_SHAPE', message: 'Feature shape cannot be empty', path });
  }

  if (feature.shape.some(d => d <= 0)) {
    errors.push({ code: 'INVALID_SHAPE', message: 'Shape dimensions must be positive', path });
  }

  if (feature.constraints) {
    if (feature.constraints.min !== undefined && feature.constraints.max !== undefined) {
      if (feature.constraints.min > feature.constraints.max) {
        errors.push({ code: 'INVALID_CONSTRAINTS', message: 'min must be <= max', path });
      }
    }
  }
}

/**
 * Validate training configuration
 */
export function validateTrainingConfig(config: TrainingConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (config.batchSize < 1) {
    errors.push({ code: 'INVALID_BATCH_SIZE', message: 'Batch size must be at least 1' });
  }

  if (config.epochs < 1) {
    errors.push({ code: 'INVALID_EPOCHS', message: 'Epochs must be at least 1' });
  }

  if (config.learningRate <= 0 || config.learningRate > 1) {
    warnings.push({
      code: 'UNUSUAL_LR',
      message: 'Learning rate is typically between 0 and 1',
      suggestion: 'Common values: 0.001, 0.01, 0.1',
    });
  }

  if (config.regularization) {
    if (config.regularization.dropout !== undefined) {
      if (config.regularization.dropout < 0 || config.regularization.dropout > 1) {
        errors.push({ code: 'INVALID_DROPOUT', message: 'Dropout must be between 0 and 1' });
      }
    }
  }

  if (config.earlyStopping) {
    if (config.earlyStopping.patience < 1) {
      errors.push({ code: 'INVALID_PATIENCE', message: 'Patience must be at least 1' });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate inference contract
 */
export function validateInferenceContract(contract: InferenceContract): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate latency
  if (contract.latencyP50 >= contract.latencyP99) {
    errors.push({
      code: 'INVALID_LATENCY',
      message: 'P50 latency must be less than P99 latency',
    });
  }

  // Validate accuracy
  if (contract.minAccuracy < 0 || contract.minAccuracy > 1) {
    errors.push({
      code: 'INVALID_ACCURACY',
      message: 'Accuracy must be between 0 and 1',
    });
  }

  // Validate error rate
  if (contract.maxErrorRate < 0 || contract.maxErrorRate > 1) {
    errors.push({
      code: 'INVALID_ERROR_RATE',
      message: 'Error rate must be between 0 and 1',
    });
  }

  // Check consistency
  if (contract.minAccuracy + contract.maxErrorRate > 1) {
    warnings.push({
      code: 'INCONSISTENT_CONTRACT',
      message: 'minAccuracy + maxErrorRate > 1 may be impossible to satisfy',
    });
  }

  // Validate model spec compatibility
  const modelValidation = validateModelSpec(contract.modelSpec);
  errors.push(...modelValidation.errors.map(e => ({ ...e, path: `modelSpec.${e.path}` })));
  warnings.push(...modelValidation.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check if trained model meets inference contract
 */
export function checkContractCompliance(
  model: TrainedModel,
  contract: InferenceContract
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check accuracy
  if (model.metrics.accuracy !== undefined && model.metrics.accuracy < contract.minAccuracy) {
    violations.push(
      `Model accuracy (${model.metrics.accuracy}) is below minimum required (${contract.minAccuracy})`
    );
  }

  // Check model requirements vs contract
  if (model.spec.requirements.minMemory > contract.maxMemory) {
    violations.push(
      `Model requires ${model.spec.requirements.minMemory} bytes but contract allows max ${contract.maxMemory}`
    );
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * Validate fairness constraints
 */
export function validateFairnessConstraint(constraint: FairnessConstraint): ValidationResult {
  const errors: ValidationError[] = [];

  if (!constraint.protectedAttribute) {
    errors.push({ code: 'MISSING_ATTRIBUTE', message: 'Protected attribute is required' });
  }

  if (constraint.threshold < 0 || constraint.threshold > 1) {
    errors.push({ code: 'INVALID_THRESHOLD', message: 'Threshold must be between 0 and 1' });
  }

  if (constraint.groups.length < 2) {
    errors.push({ code: 'INSUFFICIENT_GROUPS', message: 'At least 2 groups required for fairness comparison' });
  }

  const validMetrics = [
    'demographic_parity',
    'equalized_odds',
    'equal_opportunity',
    'predictive_parity',
    'individual_fairness',
  ];

  if (!validMetrics.includes(constraint.metric.toLowerCase())) {
    errors.push({
      code: 'INVALID_METRIC',
      message: `Unknown fairness metric: ${constraint.metric}. Valid: ${validMetrics.join(', ')}`,
    });
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Evaluate fairness metrics
 */
export function evaluateFairness(
  predictions: Array<{ prediction: unknown; actual: unknown; group: string }>,
  protectedAttribute: string
): FairnessMetrics {
  const groups = [...new Set(predictions.map(p => p.group))];
  
  if (groups.length < 2) {
    return {
      demographicParity: 1,
      equalizedOdds: 1,
      equalOpportunity: 1,
      predictiveParity: 1,
      individualFairness: 1,
    };
  }

  // Calculate positive rates per group
  const groupStats = new Map<string, { total: number; positive: number; tp: number; fp: number; fn: number }>();
  
  for (const g of groups) {
    groupStats.set(g, { total: 0, positive: 0, tp: 0, fp: 0, fn: 0 });
  }

  for (const p of predictions) {
    const stats = groupStats.get(p.group)!;
    stats.total++;
    
    const pred = Boolean(p.prediction);
    const actual = Boolean(p.actual);
    
    if (pred) stats.positive++;
    if (pred && actual) stats.tp++;
    if (pred && !actual) stats.fp++;
    if (!pred && actual) stats.fn++;
  }

  // Calculate demographic parity (difference in positive prediction rates)
  const positiveRates = groups.map(g => {
    const s = groupStats.get(g)!;
    return s.total > 0 ? s.positive / s.total : 0;
  });
  const demographicParity = 1 - (Math.max(...positiveRates) - Math.min(...positiveRates));

  // Calculate equalized odds (equal TPR and FPR across groups)
  const tprs = groups.map(g => {
    const s = groupStats.get(g)!;
    const positives = s.tp + s.fn;
    return positives > 0 ? s.tp / positives : 0;
  });
  const fprs = groups.map(g => {
    const s = groupStats.get(g)!;
    const negatives = s.total - s.tp - s.fn;
    return negatives > 0 ? s.fp / negatives : 0;
  });
  const equalizedOdds = 1 - 0.5 * (
    (Math.max(...tprs) - Math.min(...tprs)) +
    (Math.max(...fprs) - Math.min(...fprs))
  );

  // Calculate equal opportunity (equal TPR)
  const equalOpportunity = 1 - (Math.max(...tprs) - Math.min(...tprs));

  // Calculate predictive parity (equal PPV)
  const ppvs = groups.map(g => {
    const s = groupStats.get(g)!;
    return s.positive > 0 ? s.tp / s.positive : 0;
  });
  const predictiveParity = 1 - (Math.max(...ppvs) - Math.min(...ppvs));

  return {
    demographicParity,
    equalizedOdds,
    equalOpportunity,
    predictiveParity,
    individualFairness: 1, // Would need pairwise comparison
  };
}

/**
 * Validate safety constraints
 */
export function validateSafetyConstraint(constraint: SafetyConstraint): ValidationResult {
  const errors: ValidationError[] = [];

  switch (constraint.kind) {
    case 'ContentFilter':
      if (constraint.categories.length === 0) {
        errors.push({ code: 'NO_CATEGORIES', message: 'At least one category required' });
      }
      if (constraint.threshold < 0 || constraint.threshold > 1) {
        errors.push({ code: 'INVALID_THRESHOLD', message: 'Threshold must be between 0 and 1' });
      }
      break;

    case 'OutputBound':
      if (constraint.min !== undefined && constraint.max !== undefined) {
        if (constraint.min > constraint.max) {
          errors.push({ code: 'INVALID_BOUNDS', message: 'min must be <= max' });
        }
      }
      break;

    case 'Toxicity':
      if (constraint.maxScore < 0 || constraint.maxScore > 1) {
        errors.push({ code: 'INVALID_SCORE', message: 'Max score must be between 0 and 1' });
      }
      break;
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Check prediction against safety constraints
 */
export function checkSafetyConstraints<T>(
  prediction: Prediction<T>,
  constraints: SafetyConstraint[]
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const constraint of constraints) {
    switch (constraint.kind) {
      case 'OutputBound':
        const value = prediction.result as number;
        if (typeof value === 'number') {
          if (constraint.min !== undefined && value < constraint.min) {
            violations.push(`Output ${value} is below minimum ${constraint.min}`);
          }
          if (constraint.max !== undefined && value > constraint.max) {
            violations.push(`Output ${value} is above maximum ${constraint.max}`);
          }
        }
        break;

      // Other constraint checks would require external services
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Generate model card
 */
export function generateModelCard(
  model: TrainedModel,
  trainingData: DatasetSpec[],
  evaluationData: DatasetSpec[],
  options: {
    developedBy: string;
    license: string;
    intendedUses: string[];
    limitations: string[];
  }
): import('./types.js').ModelCard {
  return {
    modelDetails: {
      name: model.spec.name,
      version: model.spec.version,
      type: model.spec.task,
      developedBy: options.developedBy,
      license: options.license,
      finetuned: false,
    },
    intendedUse: {
      primaryUses: options.intendedUses,
      outOfScopeUses: [],
      users: [],
    },
    factors: [],
    metrics: {
      performanceMetrics: {
        loss: model.metrics.loss,
        ...(model.metrics.accuracy !== undefined && { accuracy: model.metrics.accuracy }),
        ...(model.metrics.precision !== undefined && { precision: model.metrics.precision }),
        ...(model.metrics.recall !== undefined && { recall: model.metrics.recall }),
        ...(model.metrics.f1 !== undefined && { f1: model.metrics.f1 }),
        ...model.metrics.custom,
      },
    },
    evaluationData,
    trainingData,
    ethicalConsiderations: [],
    limitations: options.limitations,
  };
}
