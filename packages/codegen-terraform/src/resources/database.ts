// ============================================================================
// Database Resource Generation
// ============================================================================

import type { CloudProvider, DatabaseRequirements } from '../types';
import { generateAwsRds } from '../providers/aws';
import { generateGcpCloudSql } from '../providers/gcp';
import { generateAzurePostgres } from '../providers/azure';

/**
 * Generate database infrastructure for the specified provider
 */
export function generateDatabase(
  domainName: string,
  provider: CloudProvider,
  requirements: DatabaseRequirements
): string {
  switch (provider) {
    case 'aws':
      return generateAwsRds(
        domainName,
        requirements.engine === 'postgres' ? 'postgres' : 'mysql',
        requirements.encrypted,
        requirements.multiAz
      );

    case 'gcp':
      return generateGcpCloudSql(
        domainName,
        requirements.encrypted,
        requirements.multiAz
      );

    case 'azure':
      return generateAzurePostgres(
        domainName,
        requirements.encrypted
      );

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Extract database requirements from ISL domain
 */
export function extractDatabaseRequirements(
  hasEntities: boolean,
  compliance: string[]
): DatabaseRequirements | null {
  if (!hasEntities) {
    return null;
  }

  const isPciCompliant = compliance.includes('pci_dss');
  const isHipaaCompliant = compliance.includes('hipaa');

  return {
    engine: 'postgres',
    encrypted: true,
    multiAz: isPciCompliant || isHipaaCompliant,
    backupRetention: isPciCompliant ? 30 : 7,
    performanceInsights: true,
  };
}

/**
 * Generate database variables
 */
export function generateDatabaseVariables(provider: CloudProvider): string {
  const common = `
variable "db_allocated_storage" {
  description = "Allocated storage for database (GB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for database (GB)"
  type        = number
  default     = 100
}
`;

  switch (provider) {
    case 'aws':
      return `
${common}
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"

  validation {
    condition     = can(regex("^db\\.", var.db_instance_class))
    error_message = "Instance class must start with 'db.'"
  }
}
`.trim();

    case 'gcp':
      return `
${common}
variable "db_tier" {
  description = "Cloud SQL tier"
  type        = string
  default     = "db-custom-2-4096"
}

variable "db_disk_size" {
  description = "Database disk size (GB)"
  type        = number
  default     = 20
}
`.trim();

    case 'azure':
      return `
${common}
variable "db_sku" {
  description = "PostgreSQL Flexible Server SKU"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "db_storage_mb" {
  description = "Database storage size (MB)"
  type        = number
  default     = 32768
}
`.trim();
  }
}

/**
 * Generate database outputs
 */
export function generateDatabaseOutputs(
  domainName: string,
  provider: CloudProvider
): string {
  switch (provider) {
    case 'aws':
      return `
output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.db_instance_endpoint
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = module.database.db_instance_name
}

output "database_port" {
  description = "Database port"
  value       = module.database.db_instance_port
}
`.trim();

    case 'gcp':
      return `
output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "database_private_ip" {
  description = "Database private IP"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}
`.trim();

    case 'azure':
      return `
output "database_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = azurerm_postgresql_flexible_server_database.main.name
}
`.trim();
  }
}
