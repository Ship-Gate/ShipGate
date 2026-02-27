//! Core types for ISL runtime verification

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Trace event type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TraceEventType {
    Call,
    Return,
    StateChange,
    Check,
    Error,
}

/// Trace event emitted during runtime execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEvent {
    /// Event ID
    pub id: String,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: TraceEventType,
    /// Timestamp in milliseconds since epoch
    pub timestamp: i64,
    /// Event data
    pub data: serde_json::Value,
    /// Behavior name (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub behavior: Option<String>,
    /// Input values (for call events)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<serde_json::Value>,
    /// Output/result (for return events)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    /// Error (for error events)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorInfo>,
    /// State snapshot before this event
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_before: Option<EntityStoreSnapshot>,
    /// State snapshot after this event
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_after: Option<EntityStoreSnapshot>,
}

/// Error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,
}

/// Entity store snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityStoreSnapshot {
    pub entities: HashMap<String, HashMap<String, serde_json::Value>>,
}

/// Complete trace with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trace {
    /// Trace ID
    pub id: String,
    /// Trace name
    pub name: String,
    /// Domain name
    pub domain: String,
    /// Start time in milliseconds since epoch
    pub start_time: i64,
    /// End time in milliseconds since epoch
    pub end_time: i64,
    /// Events in this trace
    pub events: Vec<TraceEvent>,
    /// Initial state
    pub initial_state: serde_json::Value,
    /// Snapshots
    pub snapshots: Vec<serde_json::Value>,
    /// Metadata
    pub metadata: TraceMetadata,
}

/// Trace metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceMetadata {
    pub test_name: String,
    pub scenario: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub implementation: Option<String>,
    pub version: String,
    pub environment: String,
    pub passed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_index: Option<usize>,
    pub duration: i64,
}

/// ISL behavior constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorConstraint {
    pub name: String,
    pub preconditions: Vec<String>,
    pub postconditions: Vec<String>,
    pub invariants: Vec<String>,
}

/// Domain constraints loaded from ISL spec
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainConstraints {
    pub domain: String,
    pub behaviors: Vec<BehaviorConstraint>,
    pub global_invariants: Vec<String>,
}
