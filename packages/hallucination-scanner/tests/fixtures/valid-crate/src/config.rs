use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
pub struct AppConfig {
    pub port: u16,
    pub host: String,
}

impl AppConfig {
    pub fn load() -> Self {
        let content = fs::read_to_string("config.toml").unwrap();
        toml::from_str(&content).unwrap()
    }
}
