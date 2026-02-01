// ============================================================================
// AWS Provider Configuration
// ============================================================================

import type { TerraformBlock, TerraformValue } from '../types';

/**
 * Generate AWS provider configuration
 */
export function generateAwsProvider(
  domainName: string,
  version: string,
  region: string = 'us-east-1'
): string {
  return `
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = var.terraform_state_bucket
    key            = "${domainName.toLowerCase()}/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = var.terraform_lock_table
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Domain      = "${domainName.toLowerCase()}"
      Version     = "${version}"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
`.trim();
}

/**
 * Generate AWS VPC module
 */
export function generateAwsVpc(
  domainName: string,
  enableFlowLogs: boolean = true
): string {
  const flowLogsConfig = enableFlowLogs
    ? `
  # VPC Flow Logs for compliance
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true
  flow_log_max_aggregation_interval    = 60`
    : '';

  return `
# VPC Configuration
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${domainName.toLowerCase()}-\${var.environment}"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "production"
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # Database subnets
  create_database_subnet_group       = true
  create_database_subnet_route_table = true
  database_subnets                   = var.database_subnet_cidrs
${flowLogsConfig}

  tags = {
    Domain = "${domainName.toLowerCase()}"
  }
}
`.trim();
}

/**
 * Generate AWS RDS database
 */
export function generateAwsRds(
  domainName: string,
  engine: string = 'postgres',
  encrypted: boolean = true,
  multiAz: boolean = true
): string {
  return `
# KMS Key for database encryption
resource "aws_kms_key" "database" {
  description             = "KMS key for ${domainName} database encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "${domainName.toLowerCase()}-db-key"
  }
}

resource "aws_kms_alias" "database" {
  name          = "alias/${domainName.toLowerCase()}-db-key"
  target_key_id = aws_kms_key.database.key_id
}

# Database Security Group
resource "aws_security_group" "database" {
  name        = "${domainName.toLowerCase()}-database-\${var.environment}"
  description = "Security group for ${domainName} database"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from Lambda"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${domainName.toLowerCase()}-database-sg"
  }
}

# RDS PostgreSQL Database
module "database" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "${domainName.toLowerCase()}-\${var.environment}"

  engine               = "${engine}"
  engine_version       = "15"
  family               = "${engine}15"
  major_engine_version = "15"
  instance_class       = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  db_name  = "${domainName.toLowerCase()}"
  username = "${domainName.toLowerCase()}_admin"
  port     = 5432

  # Encryption
  storage_encrypted = ${encrypted}
  kms_key_id        = aws_kms_key.database.arn

  # Network
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  publicly_accessible    = false

  # High availability
  multi_az = var.environment == "production"${multiAz ? '' : ' ? false : false'}

  # Backup
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Deletion protection
  deletion_protection = var.environment == "production"

  tags = {
    Name = "${domainName.toLowerCase()}-database"
  }
}

# RDS Monitoring Role
resource "aws_iam_role" "rds_monitoring" {
  name = "${domainName.toLowerCase()}-rds-monitoring-\${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
`.trim();
}

/**
 * Generate AWS Lambda function
 */
export function generateAwsLambda(
  functionName: string,
  domainName: string,
  timeout: number = 30,
  memory: number = 512,
  vpcEnabled: boolean = true,
  tracingEnabled: boolean = true
): string {
  const vpcConfig = vpcEnabled
    ? `
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }`
    : '';

  const tracingConfig = tracingEnabled
    ? `
  tracing_config {
    mode = "Active"
  }`
    : '';

  return `
# Lambda Security Group
resource "aws_security_group" "lambda" {
  name        = "${domainName.toLowerCase()}-lambda-\${var.environment}"
  description = "Security group for ${domainName} Lambda functions"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${domainName.toLowerCase()}-lambda-sg"
  }
}

# Lambda execution role
resource "aws_iam_role" "lambda_${functionName.toLowerCase().replace(/-/g, '_')}" {
  name = "${domainName.toLowerCase()}-${functionName.toLowerCase()}-role-\${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_${functionName.toLowerCase().replace(/-/g, '_')}_basic" {
  role       = aws_iam_role.lambda_${functionName.toLowerCase().replace(/-/g, '_')}.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_${functionName.toLowerCase().replace(/-/g, '_')}_vpc" {
  role       = aws_iam_role.lambda_${functionName.toLowerCase().replace(/-/g, '_')}.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_${functionName.toLowerCase().replace(/-/g, '_')}_xray" {
  role       = aws_iam_role.lambda_${functionName.toLowerCase().replace(/-/g, '_')}.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Lambda function
resource "aws_lambda_function" "${functionName.toLowerCase().replace(/-/g, '_')}" {
  function_name = "${domainName.toLowerCase()}-${functionName.toLowerCase()}-\${var.environment}"
  role          = aws_iam_role.lambda_${functionName.toLowerCase().replace(/-/g, '_')}.arn

  runtime     = "nodejs20.x"
  handler     = "index.handler"
  timeout     = ${timeout}
  memory_size = ${memory}

  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)
${vpcConfig}
${tracingConfig}

  environment {
    variables = {
      ENVIRONMENT  = var.environment
      DATABASE_URL = "postgresql://\${module.database.db_instance_username}@\${module.database.db_instance_endpoint}/\${module.database.db_instance_name}"
      LOG_LEVEL    = var.environment == "production" ? "info" : "debug"
    }
  }

  tags = {
    Name     = "${domainName.toLowerCase()}-${functionName.toLowerCase()}"
    Function = "${functionName}"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "${functionName.toLowerCase().replace(/-/g, '_')}" {
  name              = "/aws/lambda/${domainName.toLowerCase()}-${functionName.toLowerCase()}-\${var.environment}"
  retention_in_days = var.environment == "production" ? 90 : 30

  tags = {
    Function = "${functionName}"
  }
}
`.trim();
}

/**
 * Generate AWS API Gateway
 */
export function generateAwsApiGateway(
  domainName: string,
  rateLimitPerMinute: number = 1000
): string {
  return `
# API Gateway
resource "aws_apigatewayv2_api" "${domainName.toLowerCase()}" {
  name          = "${domainName.toLowerCase()}-\${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_origins
    allow_methods = ["POST", "GET", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 300
  }

  tags = {
    Name = "${domainName.toLowerCase()}-api"
  }
}

# API Gateway Stage with throttling
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.${domainName.toLowerCase()}.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = ${rateLimitPerMinute}
    throttling_burst_limit = ${rateLimitPerMinute * 2}
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId         = "$context.requestId"
      ip                = "$context.identity.sourceIp"
      requestTime       = "$context.requestTime"
      httpMethod        = "$context.httpMethod"
      routeKey          = "$context.routeKey"
      status            = "$context.status"
      protocol          = "$context.protocol"
      responseLength    = "$context.responseLength"
      integrationError  = "$context.integrationErrorMessage"
    })
  }

  tags = {
    Name = "${domainName.toLowerCase()}-api-stage"
  }
}

# API Gateway CloudWatch Log Group
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${domainName.toLowerCase()}-\${var.environment}"
  retention_in_days = var.environment == "production" ? 90 : 30
}
`.trim();
}

/**
 * Generate AWS WAF
 */
export function generateAwsWaf(domainName: string): string {
  return `
# WAF Web ACL
resource "aws_wafv2_web_acl" "${domainName.toLowerCase()}" {
  name        = "${domainName.toLowerCase()}-\${var.environment}"
  scope       = "REGIONAL"
  description = "WAF for ${domainName} API"

  default_action {
    allow {}
  }

  # AWS Managed Rules - IP Reputation
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAmazonIpReputationList"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${domainName.toLowerCase()}-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${domainName.toLowerCase()}-waf"
  }
}

# Associate WAF with API Gateway
resource "aws_wafv2_web_acl_association" "${domainName.toLowerCase()}" {
  resource_arn = aws_apigatewayv2_stage.default.arn
  web_acl_arn  = aws_wafv2_web_acl.${domainName.toLowerCase()}.arn
}
`.trim();
}

/**
 * Generate AWS SQS Queue
 */
export function generateAwsSqs(
  queueName: string,
  domainName: string,
  fifo: boolean = false,
  encrypted: boolean = true
): string {
  const fifoSuffix = fifo ? '.fifo' : '';
  const fifoConfig = fifo
    ? `
  fifo_queue                  = true
  content_based_deduplication = true`
    : '';

  return `
# SQS Queue
resource "aws_sqs_queue" "${queueName.toLowerCase().replace(/-/g, '_')}" {
  name = "${domainName.toLowerCase()}-${queueName.toLowerCase()}-\${var.environment}${fifoSuffix}"
${fifoConfig}

  visibility_timeout_seconds = 30
  message_retention_seconds  = 1209600  # 14 days
  max_message_size          = 262144   # 256 KB
  delay_seconds             = 0
  receive_wait_time_seconds = 10

  # Encryption
  sqs_managed_sse_enabled = ${encrypted}

  # Dead letter queue
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.${queueName.toLowerCase().replace(/-/g, '_')}_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${domainName.toLowerCase()}-${queueName.toLowerCase()}"
  }
}

# Dead Letter Queue
resource "aws_sqs_queue" "${queueName.toLowerCase().replace(/-/g, '_')}_dlq" {
  name = "${domainName.toLowerCase()}-${queueName.toLowerCase()}-dlq-\${var.environment}${fifoSuffix}"
${fifoConfig}

  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = ${encrypted}

  tags = {
    Name = "${domainName.toLowerCase()}-${queueName.toLowerCase()}-dlq"
  }
}
`.trim();
}

/**
 * Generate AWS S3 Bucket
 */
export function generateAwsS3(
  bucketName: string,
  domainName: string,
  encrypted: boolean = true,
  versioning: boolean = true
): string {
  return `
# S3 Bucket
resource "aws_s3_bucket" "${bucketName.toLowerCase().replace(/-/g, '_')}" {
  bucket = "${domainName.toLowerCase()}-${bucketName.toLowerCase()}-\${var.environment}-\${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${domainName.toLowerCase()}-${bucketName.toLowerCase()}"
  }
}

# Versioning
resource "aws_s3_bucket_versioning" "${bucketName.toLowerCase().replace(/-/g, '_')}" {
  bucket = aws_s3_bucket.${bucketName.toLowerCase().replace(/-/g, '_')}.id

  versioning_configuration {
    status = "${versioning ? 'Enabled' : 'Disabled'}"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "${bucketName.toLowerCase().replace(/-/g, '_')}" {
  bucket = aws_s3_bucket.${bucketName.toLowerCase().replace(/-/g, '_')}.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "${bucketName.toLowerCase().replace(/-/g, '_')}" {
  bucket = aws_s3_bucket.${bucketName.toLowerCase().replace(/-/g, '_')}.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "${bucketName.toLowerCase().replace(/-/g, '_')}" {
  bucket = aws_s3_bucket.${bucketName.toLowerCase().replace(/-/g, '_')}.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}
`.trim();
}

/**
 * Generate CloudWatch Alarm
 */
export function generateAwsCloudWatchAlarm(
  alarmName: string,
  metricName: string,
  namespace: string,
  threshold: number,
  statistic: string = 'Average',
  dimensions: Record<string, string> = {}
): string {
  const dimensionsBlock = Object.entries(dimensions)
    .map(([key, value]) => `    ${key} = ${value}`)
    .join('\n');

  return `
# CloudWatch Alarm: ${alarmName}
resource "aws_cloudwatch_metric_alarm" "${alarmName.toLowerCase().replace(/-/g, '_')}" {
  alarm_name          = "${alarmName}-\${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "${metricName}"
  namespace           = "${namespace}"
  period              = 60
  statistic           = "${statistic}"
  threshold           = ${threshold}
  alarm_description   = "Alarm when ${metricName} exceeds ${threshold}"
  treat_missing_data  = "notBreaching"

  dimensions = {
${dimensionsBlock}
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${alarmName}"
  }
}
`.trim();
}

/**
 * Generate SNS Topic for alerts
 */
export function generateAwsSnsAlerts(domainName: string): string {
  return `
# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${domainName.toLowerCase()}-alerts-\${var.environment}"

  tags = {
    Name = "${domainName.toLowerCase()}-alerts"
  }
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}
`.trim();
}
