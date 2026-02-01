// ============================================================================
// GCP Provider Configuration
// ============================================================================

/**
 * Generate GCP provider configuration
 */
export function generateGcpProvider(
  domainName: string,
  version: string,
  region: string = 'us-central1'
): string {
  return `
terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = var.terraform_state_bucket
    prefix = "${domainName.toLowerCase()}/terraform"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  domain_name = "${domainName.toLowerCase()}"
  version     = "${version}"
  labels = {
    domain      = "${domainName.toLowerCase()}"
    version     = replace("${version}", ".", "-")
    managed_by  = "terraform"
    environment = var.environment
  }
}
`.trim();
}

/**
 * Generate GCP VPC
 */
export function generateGcpVpc(domainName: string): string {
  return `
# VPC Network
resource "google_compute_network" "main" {
  name                    = "${domainName.toLowerCase()}-\${var.environment}"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Private Subnet
resource "google_compute_subnetwork" "private" {
  name          = "${domainName.toLowerCase()}-private-\${var.environment}"
  ip_cidr_range = var.private_subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud Router for NAT
resource "google_compute_router" "main" {
  name    = "${domainName.toLowerCase()}-router-\${var.environment}"
  region  = var.region
  network = google_compute_network.main.id
}

# Cloud NAT
resource "google_compute_router_nat" "main" {
  name                               = "${domainName.toLowerCase()}-nat-\${var.environment}"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# VPC Access Connector for Cloud Functions
resource "google_vpc_access_connector" "main" {
  name          = "${domainName.toLowerCase()}-connector"
  region        = var.region
  ip_cidr_range = var.connector_cidr
  network       = google_compute_network.main.name
  
  min_instances = 2
  max_instances = var.environment == "production" ? 10 : 3
}
`.trim();
}

/**
 * Generate Cloud SQL PostgreSQL
 */
export function generateGcpCloudSql(
  domainName: string,
  encrypted: boolean = true,
  highAvailability: boolean = true
): string {
  return `
# Cloud SQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${domainName.toLowerCase()}-\${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.environment == "production"

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
      
      backup_retention_settings {
        retained_backups = var.environment == "production" ? 30 : 7
      }
    }

    maintenance_window {
      day          = 1  # Monday
      hour         = 4
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Database
resource "google_sql_database" "main" {
  name     = "${domainName.toLowerCase()}"
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# Database User
resource "google_sql_user" "main" {
  name     = "${domainName.toLowerCase()}_admin"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${domainName.toLowerCase()}-db-password-\${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Private Service Connection
resource "google_compute_global_address" "private_ip" {
  name          = "${domainName.toLowerCase()}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip.name]
}
`.trim();
}

/**
 * Generate Cloud Run Service
 */
export function generateGcpCloudRun(
  serviceName: string,
  domainName: string,
  timeout: number = 30,
  memory: string = '512Mi'
): string {
  return `
# Cloud Run Service: ${serviceName}
resource "google_cloud_run_v2_service" "${serviceName.toLowerCase().replace(/-/g, '_')}" {
  name     = "${domainName.toLowerCase()}-${serviceName.toLowerCase()}-\${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    service_account = google_service_account.cloud_run.email

    timeout = "${timeout}s"

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.environment == "production" ? 100 : 10
    }

    containers {
      image = var.container_image_${serviceName.toLowerCase().replace(/-/g, '_')}

      resources {
        limits = {
          cpu    = "1"
          memory = "${memory}"
        }
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = local.labels
}

# IAM for Cloud Run
resource "google_cloud_run_v2_service_iam_member" "${serviceName.toLowerCase().replace(/-/g, '_')}_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.${serviceName.toLowerCase().replace(/-/g, '_')}.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "${domainName.toLowerCase()}-run-\${var.environment}"
  display_name = "${domainName} Cloud Run Service Account"
  project      = var.project_id
}

# Grant Secret Manager access
resource "google_secret_manager_secret_iam_member" "cloud_run_db_password" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:\${google_service_account.cloud_run.email}"
  project   = var.project_id
}
`.trim();
}

/**
 * Generate Cloud Armor (WAF)
 */
export function generateGcpCloudArmor(domainName: string): string {
  return `
# Cloud Armor Security Policy
resource "google_compute_security_policy" "main" {
  name    = "${domainName.toLowerCase()}-security-policy-\${var.environment}"
  project = var.project_id

  # Default rule - allow
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default rule, allow all traffic"
  }

  # Block bad IPs
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  rule {
    action   = "deny(403)"
    priority = "1001"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-stable')"
      }
    }
    description = "Block SQL injection attacks"
  }

  rule {
    action   = "deny(403)"
    priority = "1002"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('lfi-stable')"
      }
    }
    description = "Block local file inclusion attacks"
  }

  # Rate limiting
  rule {
    action   = "rate_based_ban"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
      ban_duration_sec = 600
    }
    description = "Rate limit - 1000 requests per minute"
  }
}
`.trim();
}

/**
 * Generate Pub/Sub Topic
 */
export function generateGcpPubSub(
  topicName: string,
  domainName: string
): string {
  return `
# Pub/Sub Topic
resource "google_pubsub_topic" "${topicName.toLowerCase().replace(/-/g, '_')}" {
  name    = "${domainName.toLowerCase()}-${topicName.toLowerCase()}-\${var.environment}"
  project = var.project_id

  message_retention_duration = "604800s"  # 7 days

  labels = local.labels
}

# Dead Letter Topic
resource "google_pubsub_topic" "${topicName.toLowerCase().replace(/-/g, '_')}_dlq" {
  name    = "${domainName.toLowerCase()}-${topicName.toLowerCase()}-dlq-\${var.environment}"
  project = var.project_id

  labels = local.labels
}

# Subscription
resource "google_pubsub_subscription" "${topicName.toLowerCase().replace(/-/g, '_')}" {
  name    = "${domainName.toLowerCase()}-${topicName.toLowerCase()}-sub-\${var.environment}"
  topic   = google_pubsub_topic.${topicName.toLowerCase().replace(/-/g, '_')}.name
  project = var.project_id

  ack_deadline_seconds = 60
  
  message_retention_duration = "604800s"
  retain_acked_messages      = true

  expiration_policy {
    ttl = ""  # Never expire
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.${topicName.toLowerCase().replace(/-/g, '_')}_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = local.labels
}
`.trim();
}

/**
 * Generate Cloud Storage Bucket
 */
export function generateGcpStorage(
  bucketName: string,
  domainName: string
): string {
  return `
# Cloud Storage Bucket
resource "google_storage_bucket" "${bucketName.toLowerCase().replace(/-/g, '_')}" {
  name     = "${domainName.toLowerCase()}-${bucketName.toLowerCase()}-\${var.environment}-\${var.project_id}"
  location = var.region
  project  = var.project_id

  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  labels = local.labels
}
`.trim();
}
