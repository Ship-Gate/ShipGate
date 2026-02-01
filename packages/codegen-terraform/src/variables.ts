// ============================================================================
// Variable Generation
// ============================================================================

import type { CloudProvider, VariableDefinition } from './types';
import { generateNetworkVariables } from './resources/network';
import { generateDatabaseVariables } from './resources/database';
import { generateComputeVariables } from './resources/compute';
import { generateQueueVariables } from './resources/queue';
import { generateStorageVariables } from './resources/storage';

/**
 * Generate common variables for all providers
 */
export function generateCommonVariables(): string {
  return `
variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}
`.trim();
}

/**
 * Generate provider-specific variables
 */
export function generateProviderVariables(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "terraform_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
}

variable "terraform_lock_table" {
  description = "DynamoDB table for state locking"
  type        = string
  default     = "terraform-locks"
}
`.trim();

    case 'gcp':
      return `
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "terraform_state_bucket" {
  description = "GCS bucket for Terraform state"
  type        = string
}
`.trim();

    case 'azure':
      return `
variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "terraform_state_rg" {
  description = "Resource group for Terraform state"
  type        = string
}

variable "terraform_state_sa" {
  description = "Storage account for Terraform state"
  type        = string
}

variable "publisher_name" {
  description = "API Management publisher name"
  type        = string
}

variable "publisher_email" {
  description = "API Management publisher email"
  type        = string
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
}
`.trim();
  }
}

/**
 * Generate all variables file content
 */
export function generateVariablesFile(
  provider: CloudProvider,
  features: {
    database: boolean;
    queue: boolean;
    storage: boolean;
    compute: boolean;
    network: boolean;
  }
): string {
  const sections: string[] = [
    '# ============================================================================',
    '# Variables',
    '# Generated from ISL specification',
    '# ============================================================================',
    '',
    '# Common Variables',
    generateCommonVariables(),
    '',
    '# Provider Variables',
    generateProviderVariables(provider),
  ];

  if (features.network) {
    sections.push('', '# Network Variables', generateNetworkVariables(provider));
  }

  if (features.database) {
    sections.push('', '# Database Variables', generateDatabaseVariables(provider));
  }

  if (features.compute) {
    sections.push('', '# Compute Variables', generateComputeVariables(provider));
  }

  if (features.queue) {
    sections.push('', '# Queue Variables', generateQueueVariables(provider));
  }

  if (features.storage) {
    sections.push('', '# Storage Variables', generateStorageVariables(provider));
  }

  return sections.join('\n');
}

/**
 * Generate outputs file content
 */
export function generateOutputsFile(
  domainName: string,
  provider: CloudProvider,
  computeNames: string[],
  queueNames: string[],
  storageNames: string[]
): string {
  const { generateNetworkOutputs } = require('./resources/network');
  const { generateDatabaseOutputs } = require('./resources/database');
  const { generateComputeOutputs } = require('./resources/compute');
  const { generateQueueOutputs } = require('./resources/queue');
  const { generateStorageOutputs } = require('./resources/storage');

  const sections: string[] = [
    '# ============================================================================',
    '# Outputs',
    '# Generated from ISL specification',
    '# ============================================================================',
    '',
    '# Network Outputs',
    generateNetworkOutputs(provider),
    '',
    '# Database Outputs',
    generateDatabaseOutputs(domainName, provider),
  ];

  // Compute outputs
  for (const name of computeNames) {
    sections.push('', `# ${name} Outputs`, generateComputeOutputs(name, provider));
  }

  // Queue outputs
  for (const name of queueNames) {
    sections.push('', `# ${name} Queue Outputs`, generateQueueOutputs(name, provider));
  }

  // Storage outputs
  for (const name of storageNames) {
    sections.push('', `# ${name} Storage Outputs`, generateStorageOutputs(name, provider));
  }

  return sections.join('\n');
}

/**
 * Generate terraform.tfvars.example file
 */
export function generateTfvarsExample(
  provider: CloudProvider,
  domainName: string
): string {
  const common = `
# Environment
environment = "dev"

# CORS origins (production example)
# cors_origins = ["https://app.example.com", "https://admin.example.com"]
`;

  switch (provider) {
    case 'aws':
      return `
# ${domainName} Terraform Variables Example
# Copy this file to terraform.tfvars and fill in the values
${common}
# AWS Configuration
aws_region              = "us-east-1"
terraform_state_bucket  = "${domainName.toLowerCase()}-terraform-state"
terraform_lock_table    = "terraform-locks"

# Network
vpc_cidr                = "10.0.0.0/16"
availability_zones      = ["us-east-1a", "us-east-1b", "us-east-1c"]
private_subnet_cidrs    = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
database_subnet_cidrs   = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

# Database
db_instance_class       = "db.t3.medium"
db_allocated_storage    = 20
db_max_allocated_storage = 100

# Lambda
lambda_package_path     = "lambda.zip"
`.trim();

    case 'gcp':
      return `
# ${domainName} Terraform Variables Example
# Copy this file to terraform.tfvars and fill in the values
${common}
# GCP Configuration
project_id              = "your-project-id"
region                  = "us-central1"
terraform_state_bucket  = "${domainName.toLowerCase()}-terraform-state"

# Network
private_subnet_cidr     = "10.0.1.0/24"
connector_cidr          = "10.8.0.0/28"

# Database
db_tier                 = "db-custom-2-4096"
db_disk_size            = 20
`.trim();

    case 'azure':
      return `
# ${domainName} Terraform Variables Example
# Copy this file to terraform.tfvars and fill in the values
${common}
# Azure Configuration
location                = "eastus"
terraform_state_rg      = "${domainName.toLowerCase()}-terraform-state-rg"
terraform_state_sa      = "${domainName.toLowerCase()}tfstate"

# API Management
publisher_name          = "Your Organization"
publisher_email         = "admin@example.com"

# Alerts
alert_email             = "oncall@example.com"

# Network
vnet_cidr               = "10.0.0.0/16"
app_subnet_cidr         = "10.0.1.0/24"
database_subnet_cidr    = "10.0.2.0/24"

# Database
db_sku                  = "GP_Standard_D2s_v3"
db_storage_mb           = 32768
`.trim();
  }
}
