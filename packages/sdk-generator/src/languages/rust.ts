/**
 * Rust SDK Generator
 */

import type { GeneratedFile, DomainSpec, BehaviorSpec, FieldSpec } from '../types.js';
import type { SDKOptions } from '../generator.js';

export class RustSDKGenerator {
  private options: Required<SDKOptions>;

  constructor(options: Required<SDKOptions>) {
    this.options = options;
  }

  generate(domain: DomainSpec): GeneratedFile[] {
    return [
      { path: `${this.options.outputPrefix}src/lib.rs`, content: this.generateLib(domain) },
      { path: `${this.options.outputPrefix}src/client.rs`, content: this.generateClient(domain) },
      { path: `${this.options.outputPrefix}src/types.rs`, content: this.generateTypes(domain) },
      { path: `${this.options.outputPrefix}Cargo.toml`, content: this.generateCargoToml(domain) },
    ];
  }

  private generateLib(domain: DomainSpec): string {
    return [
      `//! ${domain.name} API Client`,
      '//! Generated from ISL specification',
      '',
      'pub mod client;',
      'pub mod types;',
      '',
      'pub use client::Client;',
      'pub use types::*;',
    ].join('\n');
  }

  private generateClient(domain: DomainSpec): string {
    const lines = [
      '//! HTTP Client',
      '',
      'use reqwest::{Client as HttpClient, StatusCode};',
      'use serde::de::DeserializeOwned;',
      'use std::time::Duration;',
      'use crate::types::*;',
      '',
      '/// API Error',
      '#[derive(Debug, thiserror::Error)]',
      'pub enum Error {',
      '    #[error("HTTP error: {0}")]',
      '    Http(#[from] reqwest::Error),',
      '    #[error("API error {status}: {code} - {message}")]',
      '    Api { status: u16, code: String, message: String },',
      '    #[error("Serialization error: {0}")]',
      '    Serialization(#[from] serde_json::Error),',
      '}',
      '',
      '/// Result type alias',
      'pub type Result<T> = std::result::Result<T, Error>;',
      '',
      '/// API Client',
      'pub struct Client {',
      '    http: HttpClient,',
      '    base_url: String,',
      '}',
      '',
      'impl Client {',
      '    /// Create a new client',
      '    pub fn new() -> Self {',
      '        Self::with_base_url("' + this.options.baseUrl + '")',
      '    }',
      '',
      '    /// Create with custom base URL',
      '    pub fn with_base_url(base_url: impl Into<String>) -> Self {',
      '        let http = HttpClient::builder()',
      '            .timeout(Duration::from_secs(30))',
      '            .build()',
      '            .expect("Failed to build HTTP client");',
      '',
      '        Self {',
      '            http,',
      '            base_url: base_url.into(),',
      '        }',
      '    }',
      '',
    ];

    // Generate methods
    for (const behavior of domain.behaviors) {
      lines.push(...this.generateMethod(behavior));
    }

    lines.push('}');
    lines.push('');
    lines.push('impl Default for Client {');
    lines.push('    fn default() -> Self {');
    lines.push('        Self::new()');
    lines.push('    }');
    lines.push('}');

    return lines.join('\n');
  }

  private generateMethod(behavior: BehaviorSpec): string[] {
    const methodName = this.toSnakeCase(behavior.name);
    const path = this.behaviorToPath(behavior.name);
    const httpMethod = this.inferMethod(behavior);
    const hasInput = !!behavior.input?.fields.length;
    const hasOutput = !!behavior.output;

    const lines: string[] = [];

    // Doc comment
    lines.push(`    /// ${behavior.description || behavior.name}`);

    // Method signature
    const inputParam = hasInput ? `input: &${behavior.name}Input` : '';
    const returnType = hasOutput ? `${behavior.name}Result` : '()';

    lines.push(`    pub async fn ${methodName}(&self${inputParam ? ', ' + inputParam : ''}) -> Result<${returnType}> {`);
    lines.push(`        let url = format!("{}${path}", self.base_url);`);

    if (httpMethod === 'GET') {
      lines.push('        let response = self.http.get(&url).send().await?;');
    } else {
      const body = hasInput ? '.json(input)' : '';
      lines.push(`        let response = self.http.${httpMethod.toLowerCase()}(&url)${body}.send().await?;`);
    }

    lines.push('');
    lines.push('        if !response.status().is_success() {');
    lines.push('            let status = response.status().as_u16();');
    lines.push('            let error: ApiErrorResponse = response.json().await.unwrap_or_default();');
    lines.push('            return Err(Error::Api {');
    lines.push('                status,');
    lines.push('                code: error.code,');
    lines.push('                message: error.message,');
    lines.push('            });');
    lines.push('        }');
    lines.push('');

    if (hasOutput) {
      lines.push('        Ok(response.json().await?)');
    } else {
      lines.push('        Ok(())');
    }

    lines.push('    }');
    lines.push('');

    return lines;
  }

  private generateTypes(domain: DomainSpec): string {
    const lines = [
      '//! Type definitions',
      '',
      'use serde::{Deserialize, Serialize};',
      'use chrono::{DateTime, Utc};',
      'use uuid::Uuid;',
      '',
      '#[derive(Debug, Default, Deserialize)]',
      'pub struct ApiErrorResponse {',
      '    #[serde(default)]',
      '    pub code: String,',
      '    #[serde(default)]',
      '    pub message: String,',
      '}',
      '',
    ];

    // Entity types
    for (const entity of domain.entities) {
      lines.push(`/// ${entity.name} entity`);
      lines.push('#[derive(Debug, Clone, Serialize, Deserialize)]');
      lines.push(`pub struct ${entity.name} {`);
      for (const field of entity.fields) {
        const rustType = this.toRust(field.type, field.optional);
        const rename = `#[serde(rename = "${this.toSnakeCase(field.name)}")]`;
        lines.push(`    ${rename}`);
        lines.push(`    pub ${this.toSnakeCase(field.name)}: ${rustType},`);
      }
      lines.push('}');
      lines.push('');
    }

    // Behavior types
    for (const behavior of domain.behaviors) {
      if (behavior.input?.fields.length) {
        lines.push(`/// Input for ${behavior.name}`);
        lines.push('#[derive(Debug, Clone, Serialize)]');
        lines.push(`pub struct ${behavior.name}Input {`);
        for (const field of behavior.input.fields) {
          const rustType = this.toRust(field.type, field.optional);
          lines.push(`    pub ${this.toSnakeCase(field.name)}: ${rustType},`);
        }
        lines.push('}');
        lines.push('');
      }

      if (behavior.output) {
        lines.push(`/// Result for ${behavior.name}`);
        lines.push('#[derive(Debug, Clone, Deserialize)]');
        lines.push(`pub struct ${behavior.name}Result {`);
        lines.push('    pub success: bool,');
        lines.push(`    pub data: Option<${behavior.output.success}>,`);
        lines.push('    pub error: Option<ApiErrorResponse>,');
        lines.push('}');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private generateCargoToml(domain: DomainSpec): string {
    const crateName = this.toSnakeCase(this.options.packageName);
    return [
      '[package]',
      `name = "${crateName}"`,
      `version = "${domain.version}"`,
      'edition = "2021"',
      '',
      '[dependencies]',
      'reqwest = { version = "0.11", features = ["json"] }',
      'serde = { version = "1.0", features = ["derive"] }',
      'serde_json = "1.0"',
      'tokio = { version = "1.0", features = ["full"] }',
      'thiserror = "1.0"',
      'chrono = { version = "0.4", features = ["serde"] }',
      'uuid = { version = "1.0", features = ["serde"] }',
    ].join('\n');
  }

  private toRust(type: string, optional: boolean): string {
    let rustType: string;
    switch (type) {
      case 'String': rustType = 'String'; break;
      case 'Int': rustType = 'i64'; break;
      case 'Decimal': rustType = 'f64'; break;
      case 'Boolean': rustType = 'bool'; break;
      case 'UUID': rustType = 'Uuid'; break;
      case 'Timestamp': rustType = 'DateTime<Utc>'; break;
      default: rustType = type;
    }
    return optional ? `Option<${rustType}>` : rustType;
  }

  private toSnakeCase(s: string): string {
    return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  private behaviorToPath(name: string): string {
    return '/' + name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  }

  private inferMethod(b: BehaviorSpec): string {
    const n = b.name.toLowerCase();
    if (n.startsWith('get') || n.startsWith('list')) return 'GET';
    if (n.startsWith('delete')) return 'DELETE';
    if (n.startsWith('update')) return 'PUT';
    return 'POST';
  }
}
