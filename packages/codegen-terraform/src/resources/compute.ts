// ============================================================================
// Compute Resource Generation
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { CloudProvider, ComputeRequirements } from '../types';
import { generateAwsLambda } from '../providers/aws';
import { generateGcpCloudRun } from '../providers/gcp';
import { generateAzureFunctionApp } from '../providers/azure';

/**
 * Generate compute infrastructure for the specified provider
 */
export function generateCompute(
  functionName: string,
  domainName: string,
  provider: CloudProvider,
  requirements: ComputeRequirements
): string {
  switch (provider) {
    case 'aws':
      return generateAwsLambda(
        functionName,
        domainName,
        requirements.timeout,
        requirements.memory,
        requirements.vpcEnabled,
        requirements.tracingEnabled
      );

    case 'gcp':
      return generateGcpCloudRun(
        functionName,
        domainName,
        requirements.timeout,
        `${requirements.memory}Mi`
      );

    case 'azure':
      return generateAzureFunctionApp(
        functionName,
        domainName,
        requirements.timeout
      );

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Extract compute requirements from ISL behavior
 */
export function extractComputeRequirements(
  behavior: AST.Behavior,
  compliance: string[]
): ComputeRequirements {
  // Extract timeout from temporal specs
  let timeout = 30; // default
  for (const temporal of behavior.temporal) {
    if (temporal.operator === 'within' && temporal.duration) {
      const durationMs = convertDurationToMs(temporal.duration);
      // Add buffer and convert to seconds
      timeout = Math.ceil((durationMs * 3) / 1000);
    }
  }

  // Determine memory based on complexity
  const memory = estimateMemory(behavior);

  // VPC and tracing enabled for compliance
  const isPciCompliant = compliance.includes('pci_dss');
  const isHipaaCompliant = compliance.includes('hipaa');

  return {
    name: behavior.name.name,
    runtime: 'nodejs20.x',
    timeout,
    memory,
    vpcEnabled: isPciCompliant || isHipaaCompliant,
    tracingEnabled: true,
  };
}

/**
 * Convert ISL duration to milliseconds
 */
function convertDurationToMs(duration: AST.DurationLiteral): number {
  switch (duration.unit) {
    case 'ms':
      return duration.value;
    case 'seconds':
      return duration.value * 1000;
    case 'minutes':
      return duration.value * 60 * 1000;
    case 'hours':
      return duration.value * 60 * 60 * 1000;
    case 'days':
      return duration.value * 24 * 60 * 60 * 1000;
    default:
      return duration.value;
  }
}

/**
 * Estimate memory requirements based on behavior complexity
 */
function estimateMemory(behavior: AST.Behavior): number {
  let complexity = 0;

  // More preconditions = more validation
  complexity += behavior.preconditions.length * 10;

  // More postconditions = more processing
  complexity += behavior.postconditions.length * 15;

  // Input fields add complexity
  complexity += behavior.input.fields.length * 5;

  // Error specs add complexity
  complexity += behavior.output.errors.length * 5;

  if (complexity < 50) {
    return 256;
  } else if (complexity < 100) {
    return 512;
  } else if (complexity < 200) {
    return 1024;
  } else {
    return 2048;
  }
}

/**
 * Generate compute variables
 */
export function generateComputeVariables(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
variable "lambda_package_path" {
  description = "Path to Lambda deployment package"
  type        = string
  default     = "lambda.zip"
}

variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"

  validation {
    condition     = contains(["nodejs18.x", "nodejs20.x", "python3.11", "python3.12"], var.lambda_runtime)
    error_message = "Unsupported Lambda runtime."
  }
}

variable "lambda_memory_size" {
  description = "Lambda memory size (MB)"
  type        = number
  default     = 512

  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "Memory size must be between 128 and 10240 MB."
  }
}
`.trim();

    case 'gcp':
      return `
variable "cloud_run_cpu" {
  description = "Cloud Run CPU limit"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run memory limit"
  type        = string
  default     = "512Mi"
}

variable "cloud_run_min_instances" {
  description = "Minimum instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum instances"
  type        = number
  default     = 100
}
`.trim();

    case 'azure':
      return `
variable "function_app_sku" {
  description = "App Service Plan SKU"
  type        = string
  default     = "Y1"
}

variable "function_runtime" {
  description = "Function runtime"
  type        = string
  default     = "node"
}

variable "function_runtime_version" {
  description = "Function runtime version"
  type        = string
  default     = "~20"
}
`.trim();
  }
}

/**
 * Generate compute outputs
 */
export function generateComputeOutputs(
  functionName: string,
  provider: CloudProvider
): string {
  const safeName = functionName.toLowerCase().replace(/-/g, '_');

  switch (provider) {
    case 'aws':
      return `
output "${safeName}_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.${safeName}.function_name
}

output "${safeName}_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.${safeName}.arn
}

output "${safeName}_invoke_arn" {
  description = "Lambda invoke ARN"
  value       = aws_lambda_function.${safeName}.invoke_arn
}
`.trim();

    case 'gcp':
      return `
output "${safeName}_service_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.${safeName}.uri
}

output "${safeName}_service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.${safeName}.name
}
`.trim();

    case 'azure':
      return `
output "${safeName}_function_app_name" {
  description = "Function App name"
  value       = azurerm_linux_function_app.${safeName}.name
}

output "${safeName}_function_app_url" {
  description = "Function App URL"
  value       = "https://\${azurerm_linux_function_app.${safeName}.default_hostname}"
}
`.trim();
  }
}
