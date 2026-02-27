//! ISL Runtime Verification Helpers for Rust
//!
//! This crate provides utilities for loading ISL constraints and emitting trace events
//! for runtime verification with ShipGate.
//!
//! # Example
//!
//! ```rust,no_run
//! use isl_runtime::{TraceEmitter, ConstraintLoader};
//!
//! // Load constraints from ISL spec
//! let loader = ConstraintLoader::new();
//! let constraints = loader.load_from_file("specs/auth.isl")?;
//!
//! // Create trace emitter
//! let mut emitter = TraceEmitter::new("auth", "Login");
//!
//! // Emit trace events during execution
//! emitter.emit_call("Login", &json!({"email": "user@example.com"}));
//! // ... execute behavior ...
//! emitter.emit_return("Login", &json!({"session_id": "abc123"}), 42);
//!
//! // Finalize and save trace
//! let trace = emitter.finalize(true);
//! trace.save_to_file(".shipgate/traces/login.json")?;
//! ```

pub mod constraints;
pub mod trace;
pub mod types;

pub use constraints::ConstraintLoader;
pub use trace::TraceEmitter;
pub use types::*;
