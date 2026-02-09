//! Service traits defining behavior contracts
//!
//! Generated from ISL specification for auth_service

use async_trait::async_trait;

use crate::models::*;
use crate::errors::*;
use crate::types::*;


/// Result type for Login operation
pub type LoginResult = Result<Uuid, LoginError>;

/// Authenticate a user
#[async_trait]
pub trait LoginService: Send + Sync {
    /// Execute the Login operation
    async fn login(&self, input: LoginInput) -> LoginResult;
}