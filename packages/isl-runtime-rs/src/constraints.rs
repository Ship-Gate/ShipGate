//! ISL constraint loader

use crate::types::*;
use serde_json::Value;
use std::fs;
use std::path::Path;

/// Loads ISL constraints from files or compiled JSON
pub struct ConstraintLoader;

impl ConstraintLoader {
    /// Create a new constraint loader
    pub fn new() -> Self {
        Self
    }

    /// Load constraints from an ISL spec file
    ///
    /// Note: This is a simplified parser. For full ISL parsing, use the TypeScript parser
    /// and export to JSON format, then use `load_from_json`.
    pub fn load_from_file(&self, path: impl AsRef<Path>) -> Result<DomainConstraints, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        self.parse_isl(&content)
    }

    /// Load constraints from compiled JSON format
    pub fn load_from_json(&self, path: impl AsRef<Path>) -> Result<DomainConstraints, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let constraints: DomainConstraints = serde_json::from_str(&content)?;
        Ok(constraints)
    }

    /// Parse ISL spec (simplified parser)
    ///
    /// For production use, compile ISL files to JSON using the TypeScript tooling,
    /// then use `load_from_json`.
    fn parse_isl(&self, content: &str) -> Result<DomainConstraints, Box<dyn std::error::Error>> {
        let mut domain = String::new();
        let mut behaviors = Vec::new();
        let mut global_invariants = Vec::new();

        // Extract domain name
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("domain ") {
                domain = line
                    .replace("domain", "")
                    .trim()
                    .split_whitespace()
                    .next()
                    .unwrap_or("Unknown")
                    .to_string();
                break;
            }
        }

        // Extract behaviors (simplified - for production use JSON export)
        let mut in_behavior = false;
        let mut current_behavior: Option<BehaviorConstraint> = None;

        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("behavior ") {
                if let Some(behavior) = current_behavior.take() {
                    behaviors.push(behavior);
                }
                let name = line
                    .replace("behavior", "")
                    .trim()
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();
                current_behavior = Some(BehaviorConstraint {
                    name,
                    preconditions: Vec::new(),
                    postconditions: Vec::new(),
                    invariants: Vec::new(),
                });
                in_behavior = true;
            } else if in_behavior {
                if let Some(ref mut behavior) = current_behavior {
                    if line.contains("precondition") || line.contains("pre ") {
                        // Extract precondition expression
                        if let Some(expr) = self.extract_expression(line) {
                            behavior.preconditions.push(expr);
                        }
                    } else if line.contains("postcondition") || line.contains("post ") {
                        // Extract postcondition expression
                        if let Some(expr) = self.extract_expression(line) {
                            behavior.postconditions.push(expr);
                        }
                    } else if line.contains("invariant") {
                        // Extract invariant expression
                        if let Some(expr) = self.extract_expression(line) {
                            behavior.invariants.push(expr);
                        }
                    }
                }
                if line == "}" {
                    in_behavior = false;
                }
            } else if line.starts_with("invariant ") {
                if let Some(expr) = self.extract_expression(line) {
                    global_invariants.push(expr);
                }
            }
        }

        if let Some(behavior) = current_behavior {
            behaviors.push(behavior);
        }

        Ok(DomainConstraints {
            domain: if domain.is_empty() { "Unknown".to_string() } else { domain },
            behaviors,
            global_invariants,
        })
    }

    fn extract_expression(&self, line: &str) -> Option<String> {
        // Simple extraction - look for content after keywords
        let keywords = ["precondition", "postcondition", "invariant", "pre ", "post "];
        for keyword in &keywords {
            if let Some(pos) = line.find(keyword) {
                let expr = line[pos + keyword.len()..].trim();
                if !expr.is_empty() && !expr.starts_with('{') {
                    return Some(expr.to_string());
                }
            }
        }
        None
    }
}

impl Default for ConstraintLoader {
    fn default() -> Self {
        Self::new()
    }
}
