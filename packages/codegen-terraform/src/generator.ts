// ============================================================================
// Terraform Generator - Main Logic
// Generates Terraform/OpenTofu infrastructure from ISL domains
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  GenerateOptions,
  GeneratedFile,
  CloudProvider,
  InfrastructureRequirements,
  InfraFeature,
} from './types';

// Providers
import { generateAwsProvider } from './providers/aws';
import { generateGcpProvider } from './providers/gcp';
import { generateAzureProvider } from './providers/azure';

// Resources
import { generateNetwork, extractNetworkRequirements } from './resources/network';
import { generateDatabase, extractDatabaseRequirements } from './resources/database';
import { generateCompute, extractComputeRequirements } from './resources/compute';
import { generateQueue, extractQueueRequirements } from './resources/queue';
import { generateStorage, extractStorageRequirements } from './resources/storage';

// Modules
import { generateApiModule, generateApiRoute } from './modules/api';
import { generateServiceModule, extractMonitoringRequirements, extractSecurityRequirements } from './modules/service';

// Variables
import { generateVariablesFile, generateOutputsFile, generateTfvarsExample } from './variables';

/**
 * Generate Terraform infrastructure from an ISL domain
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const {
    provider,
    environment = 'dev',
    features = ['database', 'api', 'compute'],
  } = options;

  const files: GeneratedFile[] = [];
  const domainName = domain.name.name;
  const version = domain.version.value;

  // Analyze domain and extract requirements
  const requirements = analyzeInfrastructureRequirements(domain, features);

  // Generate main.tf
  const mainContent = generateMainTf(domain, provider, requirements, features);
  files.push({
    path: 'main.tf',
    content: mainContent,
    type: 'main',
  });

  // Generate variables.tf
  const variablesContent = generateVariablesFile(provider, {
    database: requirements.database !== null,
    queue: requirements.queue !== null,
    storage: requirements.storage !== null,
    compute: requirements.compute.length > 0,
    network: requirements.network.vpcRequired,
  });
  files.push({
    path: 'variables.tf',
    content: variablesContent,
    type: 'variables',
  });

  // Generate outputs.tf
  const computeNames = requirements.compute.map((c) => c.name);
  const queueNames = features.includes('queue') ? ['events'] : [];
  const storageNames = features.includes('storage') ? ['data'] : [];
  const outputsContent = generateOutputsFile(domainName, provider, computeNames, queueNames, storageNames);
  files.push({
    path: 'outputs.tf',
    content: outputsContent,
    type: 'outputs',
  });

  // Generate terraform.tfvars.example
  const tfvarsExample = generateTfvarsExample(provider, domainName);
  files.push({
    path: 'terraform.tfvars.example',
    content: tfvarsExample,
    type: 'variables',
  });

  // Generate data.tf for data sources
  const dataContent = generateDataSources(provider);
  files.push({
    path: 'data.tf',
    content: dataContent,
    type: 'data',
  });

  // Generate provider-specific modules if needed
  if (features.includes('api')) {
    const apiModuleContent = generateApiModuleFile(domain, provider, requirements);
    files.push({
      path: 'api.tf',
      content: apiModuleContent,
      type: 'module',
    });
  }

  return files;
}

/**
 * Generate main.tf content
 */
function generateMainTf(
  domain: AST.Domain,
  provider: CloudProvider,
  requirements: InfrastructureRequirements,
  features: InfraFeature[]
): string {
  const domainName = domain.name.name;
  const version = domain.version.value;
  const sections: string[] = [];

  // Provider configuration
  switch (provider) {
    case 'aws':
      sections.push(generateAwsProvider(domainName, version));
      break;
    case 'gcp':
      sections.push(generateGcpProvider(domainName, version));
      break;
    case 'azure':
      sections.push(generateAzureProvider(domainName, version));
      break;
  }

  // Network
  if (requirements.network.vpcRequired) {
    sections.push('');
    sections.push('# ============================================================================');
    sections.push('# Network Infrastructure');
    sections.push('# ============================================================================');
    sections.push('');
    sections.push(generateNetwork(domainName, provider, requirements.network));
  }

  // Database
  if (requirements.database && features.includes('database')) {
    sections.push('');
    sections.push('# ============================================================================');
    sections.push('# Database Infrastructure');
    sections.push('# ============================================================================');
    sections.push('');
    sections.push(generateDatabase(domainName, provider, requirements.database));
  }

  // Compute (Lambda/Cloud Run/Functions)
  if (requirements.compute.length > 0 && features.includes('compute')) {
    sections.push('');
    sections.push('# ============================================================================');
    sections.push('# Compute Infrastructure');
    sections.push('# ============================================================================');

    for (const compute of requirements.compute) {
      sections.push('');
      sections.push(generateCompute(compute.name, domainName, provider, compute));
    }
  }

  // Queue
  if (requirements.queue && features.includes('queue')) {
    sections.push('');
    sections.push('# ============================================================================');
    sections.push('# Queue Infrastructure');
    sections.push('# ============================================================================');
    sections.push('');
    sections.push(generateQueue('events', domainName, provider, requirements.queue));
  }

  // Storage
  if (requirements.storage && features.includes('storage')) {
    sections.push('');
    sections.push('# ============================================================================');
    sections.push('# Storage Infrastructure');
    sections.push('# ============================================================================');
    sections.push('');
    sections.push(generateStorage('data', domainName, provider, requirements.storage));
  }

  // Monitoring
  if (requirements.monitoring.alarms.length > 0) {
    sections.push('');
    sections.push('# ============================================================================');
    sections.push('# Monitoring Infrastructure');
    sections.push('# ============================================================================');
    sections.push('');
    sections.push(generateMonitoringInfra(domainName, provider, requirements.monitoring));
  }

  return sections.join('\n');
}

/**
 * Analyze domain and extract infrastructure requirements
 */
function analyzeInfrastructureRequirements(
  domain: AST.Domain,
  features: InfraFeature[]
): InfrastructureRequirements {
  // Extract compliance requirements from behaviors
  const compliance: string[] = [];
  for (const behavior of domain.behaviors) {
    for (const comp of behavior.compliance) {
      if (!compliance.includes(comp.standard.name)) {
        compliance.push(comp.standard.name);
      }
    }
  }

  // Database requirements
  const database = features.includes('database')
    ? extractDatabaseRequirements(domain.entities.length > 0, compliance)
    : null;

  // Queue requirements
  const queue = features.includes('queue')
    ? extractQueueRequirements(domain.behaviors.length > 0, compliance)
    : null;

  // Storage requirements
  const storage = features.includes('storage')
    ? extractStorageRequirements(compliance)
    : null;

  // Compute requirements (one per behavior)
  const compute = features.includes('compute')
    ? domain.behaviors.map((b) => extractComputeRequirements(b, compliance))
    : [];

  // Network requirements
  const network = extractNetworkRequirements(
    compliance,
    database !== null,
    compute.length > 0
  );

  // Security requirements (aggregate from all behaviors)
  const security = aggregateSecurityRequirements(domain.behaviors);

  // Monitoring requirements (aggregate from all behaviors)
  const monitoring = aggregateMonitoringRequirements(domain.behaviors);

  return {
    database,
    queue,
    storage,
    cache: null, // Could be derived from caching annotations
    compute,
    network,
    security,
    monitoring,
  };
}

/**
 * Aggregate security requirements from all behaviors
 */
function aggregateSecurityRequirements(behaviors: AST.Behavior[]): InfrastructureRequirements['security'] {
  let maxRateLimit = 0;
  const compliance: string[] = [];

  for (const behavior of behaviors) {
    const reqs = extractSecurityRequirements(behavior);

    if (reqs.rateLimiting && reqs.rateLimiting.requestsPerMinute > maxRateLimit) {
      maxRateLimit = reqs.rateLimiting.requestsPerMinute;
    }

    for (const comp of reqs.compliance) {
      if (!compliance.includes(comp)) {
        compliance.push(comp);
      }
    }
  }

  return {
    waf: compliance.length > 0,
    rateLimiting: maxRateLimit > 0 ? { requestsPerMinute: maxRateLimit, burstLimit: maxRateLimit * 2 } : null,
    encryption: true,
    compliance,
  };
}

/**
 * Aggregate monitoring requirements from all behaviors
 */
function aggregateMonitoringRequirements(behaviors: AST.Behavior[]): InfrastructureRequirements['monitoring'] {
  const alarms: InfrastructureRequirements['monitoring']['alarms'] = [];

  for (const behavior of behaviors) {
    const reqs = extractMonitoringRequirements(behavior);
    alarms.push(...reqs.alarms.map((a) => ({
      ...a,
      name: `${behavior.name.name}-${a.name}`,
    })));
  }

  return {
    alarms,
    dashboards: true,
    tracing: true,
    logging: true,
  };
}

/**
 * Generate API module file
 */
function generateApiModuleFile(
  domain: AST.Domain,
  provider: CloudProvider,
  requirements: InfrastructureRequirements
): string {
  const domainName = domain.name.name;
  const sections: string[] = [];

  sections.push('# ============================================================================');
  sections.push('# API Gateway Configuration');
  sections.push('# Generated from ISL specification');
  sections.push('# ============================================================================');
  sections.push('');

  // API Gateway with WAF
  sections.push(generateApiModule(
    domainName,
    provider,
    requirements.security.rateLimiting,
    requirements.security.waf
  ));

  // API routes for each behavior
  for (const behavior of domain.behaviors) {
    sections.push('');
    sections.push(generateApiRoute(behavior.name.name, domainName, provider));
  }

  return sections.join('\n');
}

/**
 * Generate monitoring infrastructure
 */
function generateMonitoringInfra(
  domainName: string,
  provider: CloudProvider,
  monitoring: InfrastructureRequirements['monitoring']
): string {
  switch (provider) {
    case 'aws':
      return `
# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${domainName.toLowerCase()}-alerts-\${var.environment}"

  tags = {
    Name = "${domainName.toLowerCase()}-alerts"
  }
}
`.trim();

    case 'gcp':
      return `
# Notification Channel
resource "google_monitoring_notification_channel" "email" {
  display_name = "${domainName} Alerts"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.alert_email
  }
}
`.trim();

    case 'azure':
      return `
# Action Group for Alerts
resource "azurerm_monitor_action_group" "main" {
  name                = "ag-${domainName.toLowerCase()}-\${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = "alerts"

  email_receiver {
    name          = "oncall"
    email_address = var.alert_email
  }

  tags = local.common_tags
}
`.trim();
  }
}

/**
 * Generate data sources file
 */
function generateDataSources(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
# Data Sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_iam_policy_document" "kms_policy" {
  statement {
    sid = "Enable IAM User Permissions"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::\${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }
}
`.trim();

    case 'gcp':
      return `
# Data Sources
data "google_project" "current" {
  project_id = var.project_id
}

data "google_client_config" "current" {}
`.trim();

    case 'azure':
      return `
# Data Sources
data "azurerm_client_config" "current" {}
data "azurerm_subscription" "current" {}
`.trim();
  }
}
