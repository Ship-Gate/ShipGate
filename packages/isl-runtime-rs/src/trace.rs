//! Trace event emitter for runtime verification

use crate::types::*;
use chrono::Utc;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

/// Emits trace events during runtime execution
pub struct TraceEmitter {
    trace_id: String,
    start_time: i64,
    events: Vec<TraceEvent>,
    initial_state: serde_json::Value,
    domain: String,
    behavior: String,
    event_counter: usize,
}

impl TraceEmitter {
    /// Create a new trace emitter
    pub fn new(domain: impl Into<String>, behavior: impl Into<String>) -> Self {
        Self {
            trace_id: format!("trace_{}_{}", Utc::now().timestamp_millis(), Uuid::new_v4()),
            start_time: Utc::now().timestamp_millis(),
            events: Vec::new(),
            initial_state: json!({}),
            domain: domain.into(),
            behavior: behavior.into(),
            event_counter: 0,
        }
    }

    /// Capture initial state
    pub fn capture_initial_state(&mut self, state: serde_json::Value) {
        self.initial_state = self.redact_pii(state);
    }

    /// Emit a function call event
    pub fn emit_call(&mut self, function_name: &str, args: &serde_json::Value) {
        self.events.push(TraceEvent {
            id: self.generate_event_id(),
            event_type: TraceEventType::Call,
            timestamp: Utc::now().timestamp_millis(),
            data: json!({
                "kind": "call",
                "function": function_name,
                "args": self.redact_pii(args.clone()),
            }),
            behavior: Some(self.behavior.clone()),
            input: Some(self.redact_pii(args.clone())),
            output: None,
            error: None,
            state_before: None,
            state_after: None,
        });
    }

    /// Emit a function return event
    pub fn emit_return(&mut self, function_name: &str, result: &serde_json::Value, duration_ms: i64) {
        self.events.push(TraceEvent {
            id: self.generate_event_id(),
            event_type: TraceEventType::Return,
            timestamp: Utc::now().timestamp_millis(),
            data: json!({
                "kind": "return",
                "function": function_name,
                "result": self.redact_value(result.clone()),
                "duration": duration_ms,
            }),
            behavior: Some(self.behavior.clone()),
            input: None,
            output: Some(self.redact_value(result.clone())),
            error: None,
            state_before: None,
            state_after: None,
        });
    }

    /// Emit a state change event
    pub fn emit_state_change(
        &mut self,
        path: &[String],
        old_value: &serde_json::Value,
        new_value: &serde_json::Value,
        source: &str,
    ) {
        self.events.push(TraceEvent {
            id: self.generate_event_id(),
            event_type: TraceEventType::StateChange,
            timestamp: Utc::now().timestamp_millis(),
            data: json!({
                "kind": "state_change",
                "path": path,
                "oldValue": self.redact_value(old_value.clone()),
                "newValue": self.redact_value(new_value.clone()),
                "source": source,
            }),
            behavior: Some(self.behavior.clone()),
            input: None,
            output: None,
            error: None,
            state_before: None,
            state_after: None,
        });
    }

    /// Emit a check event (precondition, postcondition, invariant)
    pub fn emit_check(
        &mut self,
        expression: &str,
        passed: bool,
        category: &str,
        expected: Option<&serde_json::Value>,
        actual: Option<&serde_json::Value>,
        message: Option<&str>,
    ) {
        let event_type = match category {
            "precondition" => TraceEventType::Check,
            "postcondition" => TraceEventType::Check,
            "invariant" => TraceEventType::Check,
            _ => TraceEventType::Check,
        };

        self.events.push(TraceEvent {
            id: self.generate_event_id(),
            event_type,
            timestamp: Utc::now().timestamp_millis(),
            data: json!({
                "kind": "check",
                "expression": expression,
                "passed": passed,
                "expected": expected.map(|v| self.redact_value(v.clone())),
                "actual": actual.map(|v| self.redact_value(v.clone())),
                "message": message,
                "category": category,
            }),
            behavior: Some(self.behavior.clone()),
            input: None,
            output: None,
            error: None,
            state_before: None,
            state_after: None,
        });
    }

    /// Emit an error event
    pub fn emit_error(&mut self, message: &str, code: Option<&str>, stack: Option<&str>) {
        self.events.push(TraceEvent {
            id: self.generate_event_id(),
            event_type: TraceEventType::Error,
            timestamp: Utc::now().timestamp_millis(),
            data: json!({
                "kind": "error",
                "message": message,
                "code": code,
                "stack": stack.map(|s| self.redact_pii_value(s)),
            }),
            behavior: Some(self.behavior.clone()),
            input: None,
            output: None,
            error: Some(ErrorInfo {
                code: code.unwrap_or("UNKNOWN").to_string(),
                message: message.to_string(),
            }),
            state_before: None,
            state_after: None,
        });
    }

    /// Finalize and return the trace
    pub fn finalize(&self, passed: bool) -> Trace {
        let end_time = Utc::now().timestamp_millis();
        let duration = end_time - self.start_time;

        Trace {
            id: self.trace_id.clone(),
            name: format!("{} - {}", self.domain, self.behavior),
            domain: self.domain.clone(),
            start_time: self.start_time,
            end_time,
            events: self.events.clone(),
            initial_state: self.initial_state.clone(),
            snapshots: vec![],
            metadata: TraceMetadata {
                test_name: format!("{}::{}", self.domain, self.behavior),
                scenario: self.behavior.clone(),
                implementation: None,
                version: "1.0.0".to_string(),
                environment: "runtime".to_string(),
                passed,
                failure_index: None,
                duration,
            },
        }
    }

    /// Save trace to file
    pub fn save_to_file(&self, path: &str, passed: bool) -> Result<(), Box<dyn std::error::Error>> {
        let trace = self.finalize(passed);
        let json = serde_json::to_string_pretty(&trace)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    fn generate_event_id(&mut self) -> String {
        self.event_counter += 1;
        format!("evt_{}_{}", self.event_counter, Utc::now().timestamp_millis())
    }

    fn redact_pii(&self, value: serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(map) => {
                let mut redacted = serde_json::Map::new();
                for (key, val) in map {
                    let lower_key = key.to_lowercase();
                    if self.is_forbidden_key(&lower_key) {
                        continue;
                    }
                    if lower_key.contains("email") {
                        redacted.insert(key, json!(self.redact_email(&val.to_string())));
                    } else if lower_key.contains("ip") || lower_key == "ip_address" {
                        redacted.insert(key, json!(self.redact_ip(&val.to_string())));
                    } else if lower_key.contains("phone") {
                        redacted.insert(key, json!(self.redact_phone(&val.to_string())));
                    } else {
                        redacted.insert(key, self.redact_value(val));
                    }
                }
                serde_json::Value::Object(redacted)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(arr.into_iter().map(|v| self.redact_value(v)).collect())
            }
            _ => self.redact_value(value),
        }
    }

    fn redact_value(&self, value: serde_json::Value) -> serde_json::Value {
        if let Some(s) = value.as_str() {
            if s.contains('@') && s.contains('.') {
                return json!(self.redact_email(s));
            }
            if s.matches('.').count() == 3 && s.chars().all(|c| c.is_ascii_digit() || c == '.') {
                return json!(self.redact_ip(s));
            }
        }
        value
    }

    fn redact_pii_value(&self, value: &str) -> String {
        if value.contains('@') && value.contains('.') {
            return self.redact_email(value);
        }
        if value.matches('.').count() == 3 && value.chars().all(|c| c.is_ascii_digit() || c == '.') {
            return self.redact_ip(value);
        }
        value.to_string()
    }

    fn redact_email(&self, email: &str) -> String {
        if let Some(at_pos) = email.find('@') {
            let (local, domain) = email.split_at(at_pos);
            let redacted_local = if local.len() > 1 {
                format!("{}{}", &local[..1], "*".repeat((local.len() - 1).min(3)))
            } else {
                "*".to_string()
            };
            format!("{}@{}", redacted_local, domain.trim_start_matches('@'))
        } else {
            "***@***".to_string()
        }
    }

    fn redact_ip(&self, ip: &str) -> String {
        let parts: Vec<&str> = ip.split('.').collect();
        if parts.len() == 4 {
            format!("{}.{}.xxx.xxx", parts[0], parts[1])
        } else {
            "xxx.xxx.xxx.xxx".to_string()
        }
    }

    fn redact_phone(&self, phone: &str) -> String {
        if phone.len() > 4 {
            format!("{}{}", "*".repeat(phone.len() - 4), &phone[phone.len() - 4..])
        } else {
            "****".to_string()
        }
    }

    fn is_forbidden_key(&self, key: &str) -> bool {
        let forbidden = [
            "password", "password_hash", "secret", "api_key", "apikey",
            "access_token", "accesstoken", "refresh_token", "refreshtoken",
            "private_key", "privatekey", "credit_card", "creditcard",
            "ssn", "social_security",
        ];
        forbidden.iter().any(|f| key.contains(f))
    }
}
