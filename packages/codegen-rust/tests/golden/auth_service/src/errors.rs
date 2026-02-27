//! Error types for behavior operations
//!
//! Generated from ISL specification for auth_service

use serde::{Deserialize, Serialize};
use thiserror::Error;


/// Errors for Login operation
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum LoginError {
    #[error("Invalid email or password")]
    InvalidCredentials,
    #[error("Account is locked")]
    AccountLocked,
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<validator::ValidationErrors> for LoginError {
    fn from(err: validator::ValidationErrors) -> Self {
        Self::ValidationError(err.to_string())
    }
}