//! Custom type definitions
//!
//! Generated from ISL specification for auth_service

use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Email(#[validate(email)] String);

impl Email {
    pub fn new(value: impl Into<String>) -> Result<Self, validator::ValidationErrors> {
        let instance = Self(value.into());
        instance.validate()?;
        Ok(instance)
    }

    pub fn into_inner(self) -> String {
        self.0
    }

    pub fn as_inner(&self) -> &String {
        &self.0
    }
}

impl std::fmt::Display for Email {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl AsRef<String> for Email {
    fn as_ref(&self) -> &String {
        &self.0
    }
}
/// UserRole enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Admin,
    Member,
    Guest,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Admin => write!(f, "ADMIN"),
            Self::Member => write!(f, "MEMBER"),
            Self::Guest => write!(f, "GUEST"),
        }
    }
}

impl Default for UserRole {
    fn default() -> Self {
        Self::Admin
    }
}