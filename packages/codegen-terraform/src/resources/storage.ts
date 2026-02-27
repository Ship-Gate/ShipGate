// ============================================================================
// Storage Resource Generation
// ============================================================================

import type { CloudProvider, StorageRequirements } from '../types';
import { generateAwsS3 } from '../providers/aws';
import { generateGcpStorage } from '../providers/gcp';
import { generateAzureBlobStorage } from '../providers/azure';

/**
 * Generate storage infrastructure for the specified provider
 */
export function generateStorage(
  bucketName: string,
  domainName: string,
  provider: CloudProvider,
  requirements: StorageRequirements
): string {
  switch (provider) {
    case 'aws':
      return generateAwsS3(
        bucketName,
        domainName,
        requirements.encrypted,
        requirements.versioning
      );

    case 'gcp':
      return generateGcpStorage(bucketName, domainName);

    case 'azure':
      return generateAzureBlobStorage(bucketName, domainName);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Extract storage requirements from ISL domain
 */
export function extractStorageRequirements(
  compliance: string[]
): StorageRequirements {
  const isPciCompliant = compliance.includes('pci_dss');

  return {
    encrypted: true,
    versioning: true,
    replication: isPciCompliant,
    lifecycle: true,
  };
}

/**
 * Generate storage variables
 */
export function generateStorageVariables(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
variable "s3_versioning_enabled" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "s3_lifecycle_glacier_days" {
  description = "Days before transitioning to Glacier"
  type        = number
  default     = 90
}

variable "s3_lifecycle_expiration_days" {
  description = "Days before expiring old versions"
  type        = number
  default     = 365
}
`.trim();

    case 'gcp':
      return `
variable "storage_class" {
  description = "Default storage class"
  type        = string
  default     = "STANDARD"

  validation {
    condition     = contains(["STANDARD", "NEARLINE", "COLDLINE", "ARCHIVE"], var.storage_class)
    error_message = "Storage class must be STANDARD, NEARLINE, COLDLINE, or ARCHIVE."
  }
}

variable "storage_versioning_enabled" {
  description = "Enable versioning"
  type        = bool
  default     = true
}
`.trim();

    case 'azure':
      return `
variable "storage_replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"

  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.storage_replication_type)
    error_message = "Invalid replication type."
  }
}

variable "storage_tier" {
  description = "Storage account tier"
  type        = string
  default     = "Standard"
}
`.trim();
  }
}

/**
 * Generate storage outputs
 */
export function generateStorageOutputs(
  bucketName: string,
  provider: CloudProvider
): string {
  const safeName = bucketName.toLowerCase().replace(/-/g, '_');

  switch (provider) {
    case 'aws':
      return `
output "${safeName}_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.${safeName}.id
}

output "${safeName}_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.${safeName}.arn
}

output "${safeName}_bucket_domain" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.${safeName}.bucket_domain_name
}
`.trim();

    case 'gcp':
      return `
output "${safeName}_bucket_name" {
  description = "GCS bucket name"
  value       = google_storage_bucket.${safeName}.name
}

output "${safeName}_bucket_url" {
  description = "GCS bucket URL"
  value       = google_storage_bucket.${safeName}.url
}
`.trim();

    case 'azure':
      return `
output "${safeName}_storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.${safeName}.name
}

output "${safeName}_container_name" {
  description = "Blob container name"
  value       = azurerm_storage_container.${safeName}.name
}

output "${safeName}_primary_blob_endpoint" {
  description = "Primary blob endpoint"
  value       = azurerm_storage_account.${safeName}.primary_blob_endpoint
}
`.trim();
  }
}
