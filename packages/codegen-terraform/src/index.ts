// ============================================================================
// ISL Terraform Generator
// Generates Terraform/OpenTofu infrastructure from ISL domain specifications
// ============================================================================

export { generate, extractInfrastructureRequirements } from './generator';

// Types
export type {
  CloudProvider,
  InfraFeature,
  GenerateOptions,
  GeneratedFile,
  TerraformBlock,
  TerraformValue,
  TerraformReference,
  TerraformExpression,
  InfrastructureRequirements,
  DatabaseRequirements,
  QueueRequirements,
  StorageRequirements,
  CacheRequirements,
  ComputeRequirements,
  NetworkRequirements,
  SecurityRequirements,
  RateLimitConfig,
  MonitoringRequirements,
  AlarmConfig,
  VariableDefinition,
  OutputDefinition,
} from './types';

// Providers
export {
  generateAwsProvider,
  generateAwsVpc,
  generateAwsRds,
  generateAwsLambda,
  generateAwsApiGateway,
  generateAwsWaf,
  generateAwsSqs,
  generateAwsS3,
  generateAwsCloudWatchAlarm,
  generateAwsSnsAlerts,
} from './providers/aws';

export {
  generateGcpProvider,
  generateGcpVpc,
  generateGcpCloudSql,
  generateGcpCloudRun,
  generateGcpCloudArmor,
  generateGcpPubSub,
  generateGcpStorage,
} from './providers/gcp';

export {
  generateAzureProvider,
  generateAzureVnet,
  generateAzurePostgres,
  generateAzureFunctionApp,
  generateAzureApiManagement,
  generateAzureServiceBus,
  generateAzureBlobStorage,
  generateAzureMonitorAlert,
} from './providers/azure';

// Resources
export {
  generateDatabase,
  extractDatabaseRequirements,
  generateDatabaseVariables,
  generateDatabaseOutputs,
} from './resources/database';

export {
  generateQueue,
  extractQueueRequirements,
  generateQueueVariables,
  generateQueueOutputs,
} from './resources/queue';

export {
  generateStorage,
  extractStorageRequirements,
  generateStorageVariables,
  generateStorageOutputs,
} from './resources/storage';

export {
  generateCompute,
  extractComputeRequirements,
  generateComputeVariables,
  generateComputeOutputs,
} from './resources/compute';

export {
  generateNetwork,
  extractNetworkRequirements,
  generateNetworkVariables,
  generateNetworkOutputs,
} from './resources/network';

// Modules
export {
  generateApiModule,
  generateApiRoute,
  generateApiVariables,
  generateApiOutputs,
} from './modules/api';

export {
  generateServiceModule,
  extractMonitoringRequirements,
  extractSecurityRequirements,
  generateServiceVariables,
} from './modules/service';

// Variables
export {
  generateCommonVariables,
  generateProviderVariables,
  generateVariablesFile,
  generateOutputsFile,
  generateTfvarsExample,
} from './variables';
