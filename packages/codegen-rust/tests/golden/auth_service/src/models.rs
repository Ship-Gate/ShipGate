//! Entity and input/output models
//!
//! Generated from ISL specification for auth_service

use serde::{Deserialize, Serialize};
use validator::Validate;
use uuid::Uuid;

use crate::types::*;

/// User entity
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct User {
    pub id: Uuid,
    pub email: Email,
    pub role: UserRole,
}

/// Input for Login operation
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

impl LoginInput {
    /// Create a new builder for LoginInput
    pub fn builder() -> LoginInputBuilder {
        LoginInputBuilder::default()
    }
}

#[derive(Debug, Default)]
pub struct LoginInputBuilder {
    email: Option<String>,
    password: Option<String>,
}

impl LoginInputBuilder {
    pub fn email(mut self, value: String) -> Self {
        self.email = Some(value);
        self
    }

    pub fn password(mut self, value: String) -> Self {
        self.password = Some(value);
        self
    }

    pub fn build(self) -> Result<LoginInput, &'static str> {
        Ok(LoginInput {
            email: self.email.ok_or("email is required")?,
            password: self.password.ok_or("password is required")?,
        })
    }
}