// ============================================================================
// Azure Provider Configuration
// ============================================================================

/**
 * Generate Azure provider configuration
 */
export function generateAzureProvider(
  domainName: string,
  version: string,
  location: string = 'eastus'
): string {
  return `
terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = var.terraform_state_rg
    storage_account_name = var.terraform_state_sa
    container_name       = "tfstate"
    key                  = "${domainName.toLowerCase()}/terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

locals {
  domain_name = "${domainName.toLowerCase()}"
  version     = "${version}"
  common_tags = {
    Domain      = "${domainName.toLowerCase()}"
    Version     = "${version}"
    ManagedBy   = "terraform"
    Environment = var.environment
  }
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "rg-${domainName.toLowerCase()}-\${var.environment}"
  location = var.location

  tags = local.common_tags
}
`.trim();
}

/**
 * Generate Azure Virtual Network
 */
export function generateAzureVnet(domainName: string): string {
  return `
# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "vnet-${domainName.toLowerCase()}-\${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = [var.vnet_cidr]

  tags = local.common_tags
}

# Application Subnet
resource "azurerm_subnet" "app" {
  name                 = "snet-app"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.app_subnet_cidr]

  delegation {
    name = "app-delegation"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# Database Subnet
resource "azurerm_subnet" "database" {
  name                 = "snet-database"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.database_subnet_cidr]

  delegation {
    name = "db-delegation"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# Private DNS Zone for PostgreSQL
resource "azurerm_private_dns_zone" "postgres" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name

  tags = local.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "postgres-dns-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.main.id
}
`.trim();
}

/**
 * Generate Azure PostgreSQL Flexible Server
 */
export function generateAzurePostgres(
  domainName: string,
  encrypted: boolean = true
): string {
  return `
# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                = "psql-${domainName.toLowerCase()}-\${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  
  version                = "15"
  delegated_subnet_id    = azurerm_subnet.database.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres.id
  
  administrator_login    = "${domainName.toLowerCase()}_admin"
  administrator_password = random_password.postgres.result

  storage_mb = var.db_storage_mb
  sku_name   = var.db_sku

  zone = "1"

  high_availability {
    mode                      = var.environment == "production" ? "ZoneRedundant" : "Disabled"
    standby_availability_zone = var.environment == "production" ? "2" : null
  }

  backup_retention_days        = var.environment == "production" ? 35 : 7
  geo_redundant_backup_enabled = var.environment == "production"

  tags = local.common_tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

# Database
resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "${domainName.toLowerCase()}"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Random password
resource "random_password" "postgres" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store in Key Vault
resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "postgres-password"
  value        = random_password.postgres.result
  key_vault_id = azurerm_key_vault.main.id

  tags = local.common_tags
}

# Key Vault
resource "azurerm_key_vault" "main" {
  name                       = "kv-${domainName.toLowerCase()}-\${var.environment}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 90
  purge_protection_enabled   = true

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge"
    ]
  }

  tags = local.common_tags
}

data "azurerm_client_config" "current" {}
`.trim();
}

/**
 * Generate Azure Function App
 */
export function generateAzureFunctionApp(
  functionName: string,
  domainName: string,
  timeout: number = 30
): string {
  return `
# App Service Plan
resource "azurerm_service_plan" "main" {
  name                = "asp-${domainName.toLowerCase()}-\${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.environment == "production" ? "P1v3" : "Y1"

  tags = local.common_tags
}

# Storage Account for Function App
resource "azurerm_storage_account" "functions" {
  name                     = "st${domainName.toLowerCase()}\${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = local.common_tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "appi-${domainName.toLowerCase()}-\${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"

  tags = local.common_tags
}

# Function App
resource "azurerm_linux_function_app" "${functionName.toLowerCase().replace(/-/g, '_')}" {
  name                = "func-${domainName.toLowerCase()}-${functionName.toLowerCase()}-\${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key
  service_plan_id            = azurerm_service_plan.main.id

  virtual_network_subnet_id = azurerm_subnet.app.id

  site_config {
    application_stack {
      node_version = "20"
    }

    application_insights_key               = azurerm_application_insights.main.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.main.connection_string
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME       = "node"
    WEBSITE_NODE_DEFAULT_VERSION   = "~20"
    ENVIRONMENT                    = var.environment
    DATABASE_URL                   = "@Microsoft.KeyVault(VaultName=\${azurerm_key_vault.main.name};SecretName=database-url)"
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
  }

  identity {
    type = "SystemAssigned"
  }

  tags = local.common_tags
}

# Grant Key Vault access to Function App
resource "azurerm_key_vault_access_policy" "function_${functionName.toLowerCase().replace(/-/g, '_')}" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_function_app.${functionName.toLowerCase().replace(/-/g, '_')}.identity[0].principal_id

  secret_permissions = ["Get", "List"]
}
`.trim();
}

/**
 * Generate Azure API Management
 */
export function generateAzureApiManagement(
  domainName: string,
  rateLimitPerMinute: number = 1000
): string {
  return `
# API Management
resource "azurerm_api_management" "main" {
  name                = "apim-${domainName.toLowerCase()}-\${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  publisher_name      = var.publisher_name
  publisher_email     = var.publisher_email

  sku_name = var.environment == "production" ? "Standard_1" : "Developer_1"

  identity {
    type = "SystemAssigned"
  }

  tags = local.common_tags
}

# Rate Limit Policy
resource "azurerm_api_management_policy" "rate_limit" {
  api_management_id = azurerm_api_management.main.id
  xml_content = <<XML
<policies>
  <inbound>
    <rate-limit calls="${rateLimitPerMinute}" renewal-period="60" />
    <base />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
XML
}
`.trim();
}

/**
 * Generate Azure Service Bus
 */
export function generateAzureServiceBus(
  queueName: string,
  domainName: string
): string {
  return `
# Service Bus Namespace
resource "azurerm_servicebus_namespace" "main" {
  name                = "sb-${domainName.toLowerCase()}-\${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = var.environment == "production" ? "Premium" : "Standard"

  tags = local.common_tags
}

# Service Bus Queue
resource "azurerm_servicebus_queue" "${queueName.toLowerCase().replace(/-/g, '_')}" {
  name         = "${queueName.toLowerCase()}"
  namespace_id = azurerm_servicebus_namespace.main.id

  enable_partitioning   = true
  max_delivery_count    = 10
  lock_duration         = "PT5M"
  max_size_in_megabytes = 5120

  dead_lettering_on_message_expiration = true
}

# Dead Letter Queue is automatic with Service Bus
`.trim();
}

/**
 * Generate Azure Blob Storage
 */
export function generateAzureBlobStorage(
  containerName: string,
  domainName: string
): string {
  return `
# Storage Account
resource "azurerm_storage_account" "${containerName.toLowerCase().replace(/-/g, '_')}" {
  name                     = "st${domainName.toLowerCase()}${containerName.toLowerCase()}\${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = var.environment == "production" ? "GRS" : "LRS"
  min_tls_version          = "TLS1_2"
  
  blob_properties {
    versioning_enabled = true
    
    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  tags = local.common_tags
}

# Blob Container
resource "azurerm_storage_container" "${containerName.toLowerCase().replace(/-/g, '_')}" {
  name                  = "${containerName.toLowerCase()}"
  storage_account_name  = azurerm_storage_account.${containerName.toLowerCase().replace(/-/g, '_')}.name
  container_access_type = "private"
}

# Lifecycle Management
resource "azurerm_storage_management_policy" "${containerName.toLowerCase().replace(/-/g, '_')}" {
  storage_account_id = azurerm_storage_account.${containerName.toLowerCase().replace(/-/g, '_')}.id

  rule {
    name    = "archiveold"
    enabled = true

    filters {
      blob_types = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 30
        tier_to_archive_after_days_since_modification_greater_than = 90
        delete_after_days_since_modification_greater_than          = 365
      }
    }
  }
}
`.trim();
}

/**
 * Generate Azure Monitor Alert
 */
export function generateAzureMonitorAlert(
  alertName: string,
  metricName: string,
  threshold: number
): string {
  return `
# Monitor Alert: ${alertName}
resource "azurerm_monitor_metric_alert" "${alertName.toLowerCase().replace(/-/g, '_')}" {
  name                = "alert-${alertName.toLowerCase()}-\${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_linux_function_app.main.id]
  description         = "Alert when ${metricName} exceeds ${threshold}"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "${metricName}"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = ${threshold}
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# Action Group
resource "azurerm_monitor_action_group" "main" {
  name                = "ag-${alertName.toLowerCase()}-\${var.environment}"
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
