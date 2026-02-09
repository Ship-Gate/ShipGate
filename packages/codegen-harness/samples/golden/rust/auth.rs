// Auto-generated from ISL specification
// DO NOT EDIT MANUALLY

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub password_hash: String,
    pub status: UserStatus,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub revoked: bool,
}

pub trait LoginHandler {
    fn login(&self, email: String, password: String) -> Result<Session, Box<dyn std::error::Error>>;
}

pub trait RegisterHandler {
    fn register(&self, email: String, password: String) -> Result<User, Box<dyn std::error::Error>>;
}
