// ============================================================================
// API Gateway Module Generation
// ============================================================================

import type { CloudProvider, RateLimitConfig } from '../types';
import { generateAwsApiGateway, generateAwsWaf } from '../providers/aws';
import { generateGcpCloudArmor } from '../providers/gcp';
import { generateAzureApiManagement } from '../providers/azure';

/**
 * Generate API module for the specified provider
 */
export function generateApiModule(
  domainName: string,
  provider: CloudProvider,
  rateLimit: RateLimitConfig | null,
  enableWaf: boolean = true
): string {
  const rateLimitPerMinute = rateLimit?.requestsPerMinute ?? 1000;

  switch (provider) {
    case 'aws':
      let content = generateAwsApiGateway(domainName, rateLimitPerMinute);
      if (enableWaf) {
        content += '\n\n' + generateAwsWaf(domainName);
      }
      return content;

    case 'gcp':
      let gcpContent = generateGcpApiGateway(domainName, rateLimitPerMinute);
      if (enableWaf) {
        gcpContent += '\n\n' + generateGcpCloudArmor(domainName);
      }
      return gcpContent;

    case 'azure':
      return generateAzureApiManagement(domainName, rateLimitPerMinute);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Generate GCP API Gateway (using Cloud Endpoints)
 */
function generateGcpApiGateway(domainName: string, rateLimitPerMinute: number): string {
  return `
# API Gateway
resource "google_api_gateway_api" "${domainName.toLowerCase()}" {
  provider     = google-beta
  api_id       = "${domainName.toLowerCase()}-api"
  project      = var.project_id
  display_name = "${domainName} API"
  
  labels = local.labels
}

resource "google_api_gateway_api_config" "${domainName.toLowerCase()}" {
  provider             = google-beta
  api                  = google_api_gateway_api.${domainName.toLowerCase()}.api_id
  api_config_id_prefix = "${domainName.toLowerCase()}-config"
  project              = var.project_id

  openapi_documents {
    document {
      path     = "spec.yaml"
      contents = base64encode(file("\${path.module}/openapi.yaml"))
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_api_gateway_gateway" "${domainName.toLowerCase()}" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.${domainName.toLowerCase()}.id
  gateway_id = "${domainName.toLowerCase()}-gateway"
  project    = var.project_id
  region     = var.region

  labels = local.labels
}

# Load Balancer for rate limiting
resource "google_compute_backend_service" "api" {
  name                  = "${domainName.toLowerCase()}-api-backend-\${var.environment}"
  project               = var.project_id
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  
  security_policy = google_compute_security_policy.main.id

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }

  log_config {
    enable = true
  }
}
`.trim();
}

/**
 * Generate API route for Lambda/Cloud Run/Function integration
 */
export function generateApiRoute(
  behaviorName: string,
  domainName: string,
  provider: CloudProvider,
  method: string = 'POST'
): string {
  const path = `/${behaviorName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '')}`;
  const safeName = behaviorName.toLowerCase().replace(/-/g, '_');

  switch (provider) {
    case 'aws':
      return `
# API Route: ${behaviorName}
resource "aws_apigatewayv2_route" "${safeName}" {
  api_id    = aws_apigatewayv2_api.${domainName.toLowerCase()}.id
  route_key = "${method} ${path}"
  target    = "integrations/\${aws_apigatewayv2_integration.${safeName}.id}"
}

resource "aws_apigatewayv2_integration" "${safeName}" {
  api_id                 = aws_apigatewayv2_api.${domainName.toLowerCase()}.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.${safeName}.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_lambda_permission" "${safeName}_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.${safeName}.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "\${aws_apigatewayv2_api.${domainName.toLowerCase()}.execution_arn}/*/*"
}
`.trim();

    case 'gcp':
      return `
# Note: API routes are defined in OpenAPI spec for GCP API Gateway
# Cloud Run service is configured to handle ${path}
`.trim();

    case 'azure':
      return `
# API Route: ${behaviorName}
resource "azurerm_api_management_api_operation" "${safeName}" {
  operation_id        = "${behaviorName.toLowerCase()}"
  api_name            = azurerm_api_management_api.main.name
  api_management_name = azurerm_api_management.main.name
  resource_group_name = azurerm_resource_group.main.name
  display_name        = "${behaviorName}"
  method              = "${method}"
  url_template        = "${path}"
}

resource "azurerm_api_management_api_operation_policy" "${safeName}" {
  api_name            = azurerm_api_management_api.main.name
  api_management_name = azurerm_api_management.main.name
  resource_group_name = azurerm_resource_group.main.name
  operation_id        = azurerm_api_management_api_operation.${safeName}.operation_id

  xml_content = <<XML
<policies>
  <inbound>
    <set-backend-service base-url="https://\${azurerm_linux_function_app.${safeName}.default_hostname}/api" />
    <base />
  </inbound>
</policies>
XML
}
`.trim();
  }
}

/**
 * Generate API variables
 */
export function generateApiVariables(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit (requests/second)"
  type        = number
  default     = 1000
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 2000
}
`.trim();

    case 'gcp':
      return `
variable "api_rate_limit" {
  description = "API rate limit (requests/minute)"
  type        = number
  default     = 1000
}
`.trim();

    case 'azure':
      return `
variable "apim_rate_limit" {
  description = "API Management rate limit (requests/minute)"
  type        = number
  default     = 1000
}
`.trim();
  }
}

/**
 * Generate API outputs
 */
export function generateApiOutputs(
  domainName: string,
  provider: CloudProvider
): string {
  switch (provider) {
    case 'aws':
      return `
output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "api_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.${domainName.toLowerCase()}.id
}
`.trim();

    case 'gcp':
      return `
output "api_gateway_url" {
  description = "API Gateway URL"
  value       = google_api_gateway_gateway.${domainName.toLowerCase()}.default_hostname
}
`.trim();

    case 'azure':
      return `
output "apim_gateway_url" {
  description = "API Management gateway URL"
  value       = azurerm_api_management.main.gateway_url
}

output "apim_name" {
  description = "API Management name"
  value       = azurerm_api_management.main.name
}
`.trim();
  }
}
