// ============================================================================
// Queue Resource Generation
// ============================================================================

import type { CloudProvider, QueueRequirements } from '../types';
import { generateAwsSqs } from '../providers/aws';
import { generateGcpPubSub } from '../providers/gcp';
import { generateAzureServiceBus } from '../providers/azure';

/**
 * Generate queue infrastructure for the specified provider
 */
export function generateQueue(
  queueName: string,
  domainName: string,
  provider: CloudProvider,
  requirements: QueueRequirements
): string {
  switch (provider) {
    case 'aws':
      return generateAwsSqs(
        queueName,
        domainName,
        requirements.type === 'fifo',
        requirements.encrypted
      );

    case 'gcp':
      return generateGcpPubSub(queueName, domainName);

    case 'azure':
      return generateAzureServiceBus(queueName, domainName);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Extract queue requirements from ISL domain
 */
export function extractQueueRequirements(
  hasBehaviors: boolean,
  compliance: string[]
): QueueRequirements | null {
  if (!hasBehaviors) {
    return null;
  }

  return {
    type: 'standard',
    encrypted: true,
    deadLetterQueue: true,
    visibilityTimeout: 30,
  };
}

/**
 * Generate queue variables
 */
export function generateQueueVariables(provider: CloudProvider): string {
  switch (provider) {
    case 'aws':
      return `
variable "sqs_visibility_timeout" {
  description = "SQS visibility timeout in seconds"
  type        = number
  default     = 30

  validation {
    condition     = var.sqs_visibility_timeout >= 0 && var.sqs_visibility_timeout <= 43200
    error_message = "Visibility timeout must be between 0 and 43200 seconds."
  }
}

variable "sqs_message_retention" {
  description = "SQS message retention in seconds"
  type        = number
  default     = 1209600  # 14 days
}
`.trim();

    case 'gcp':
      return `
variable "pubsub_ack_deadline" {
  description = "Pub/Sub acknowledgment deadline in seconds"
  type        = number
  default     = 60
}

variable "pubsub_retention" {
  description = "Pub/Sub message retention duration"
  type        = string
  default     = "604800s"  # 7 days
}
`.trim();

    case 'azure':
      return `
variable "servicebus_sku" {
  description = "Service Bus SKU"
  type        = string
  default     = "Standard"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.servicebus_sku)
    error_message = "Service Bus SKU must be Basic, Standard, or Premium."
  }
}
`.trim();
  }
}

/**
 * Generate queue outputs
 */
export function generateQueueOutputs(
  queueName: string,
  provider: CloudProvider
): string {
  const safeName = queueName.toLowerCase().replace(/-/g, '_');

  switch (provider) {
    case 'aws':
      return `
output "${safeName}_queue_url" {
  description = "SQS Queue URL"
  value       = aws_sqs_queue.${safeName}.url
}

output "${safeName}_queue_arn" {
  description = "SQS Queue ARN"
  value       = aws_sqs_queue.${safeName}.arn
}

output "${safeName}_dlq_url" {
  description = "Dead Letter Queue URL"
  value       = aws_sqs_queue.${safeName}_dlq.url
}
`.trim();

    case 'gcp':
      return `
output "${safeName}_topic_name" {
  description = "Pub/Sub topic name"
  value       = google_pubsub_topic.${safeName}.name
}

output "${safeName}_subscription_name" {
  description = "Pub/Sub subscription name"
  value       = google_pubsub_subscription.${safeName}.name
}
`.trim();

    case 'azure':
      return `
output "${safeName}_queue_name" {
  description = "Service Bus queue name"
  value       = azurerm_servicebus_queue.${safeName}.name
}

output "servicebus_namespace" {
  description = "Service Bus namespace"
  value       = azurerm_servicebus_namespace.main.name
}
`.trim();
  }
}
