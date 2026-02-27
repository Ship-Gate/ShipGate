use serde::Serialize;
use tokio::runtime::Runtime;
use std::collections::HashMap;
use crate::config::AppConfig;

mod config;
mod handlers;

fn main() {
    let rt = Runtime::new().unwrap();
    rt.block_on(async {
        println!("Hello, world!");
    });
}
