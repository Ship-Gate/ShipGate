use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
pub struct Response {
    pub status: u16,
    pub body: String,
}

pub fn health_check() -> Response {
    Response {
        status: 200,
        body: "OK".to_string(),
    }
}
