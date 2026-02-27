// ============================================================================
// Network Resource Generation
// ============================================================================

import type { CloudProvider, NetworkRequirements } from '../types';
import { generateAwsVpc } from '../providers/aws';
import { generateGcpVpc } from '../providers/gcp';
import { generateAzureVnet } from '../providers/azure';

/**
 * Generate network infrastructure for the specified provider
 */
export function generateNetwork(
  domainName: string,
  provider: CloudProvider,
  requirements: NetworkRequirements
): string {
  switch (provider) {
    case 'aws':
      return generateAwsVpc(domainName, requirements.flowLogs);

    case 'gcp':
      return generateGcpVpc(domainName);

    case 'azure':
      return generateAzureVnet(domainName);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Extract network requirements from ISL domain
 */
export function extractNetworkRequirements(
  compliance: string[],
  hasDatabase: boolean,
  hasCompute: boolean
): NetworkRequirements {
  const isPciCompliant = compliance.includes('pci_dss');
  const isHipaaCompliant = compliance.includes('hipaa');
  const requiresCompliance = isPciCompliant || isHipaaCompliant;

  return {
    vpcRequired: requiresCompliance || hasDatabase,
    privateSubnets: requiresCompliance || hasDatabase,
    publicSubnets: hasCompute,
    natGateway: requiresCompliance,
    flowLogs: requiresCompliance,
  };
}

/**
 * Generate network variables
 */
export function generateNetworkVariables(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "VPC CIDR must be a valid CIDR block."
  }
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_subnet_cidrs" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}
`.trim();

    case 'gcp':
      return `
variable "private_subnet_cidr" {
  description = "CIDR block for private subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "connector_cidr" {
  description = "CIDR block for VPC connector"
  type        = string
  default     = "10.8.0.0/28"
}
`.trim();

    case 'azure':
      return `
variable "vnet_cidr" {
  description = "CIDR block for VNet"
  type        = string
  default     = "10.0.0.0/16"
}

variable "app_subnet_cidr" {
  description = "CIDR block for app subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "database_subnet_cidr" {
  description = "CIDR block for database subnet"
  type        = string
  default     = "10.0.2.0/24"
}
`.trim();
  }
}

/**
 * Generate network outputs
 */
export function generateNetworkOutputs(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "database_subnet_group_name" {
  description = "Database subnet group name"
  value       = module.vpc.database_subnet_group_name
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = module.vpc.natgw_ids
}
`.trim();

    case 'gcp':
      return `
output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.main.name
}

output "network_id" {
  description = "VPC network ID"
  value       = google_compute_network.main.id
}

output "private_subnet_name" {
  description = "Private subnet name"
  value       = google_compute_subnetwork.private.name
}

output "vpc_connector_id" {
  description = "VPC Access Connector ID"
  value       = google_vpc_access_connector.main.id
}
`.trim();

    case 'azure':
      return `
output "vnet_id" {
  description = "Virtual Network ID"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Virtual Network name"
  value       = azurerm_virtual_network.main.name
}

output "app_subnet_id" {
  description = "App subnet ID"
  value       = azurerm_subnet.app.id
}

output "database_subnet_id" {
  description = "Database subnet ID"
  value       = azurerm_subnet.database.id
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}
`.trim();
  }
}
