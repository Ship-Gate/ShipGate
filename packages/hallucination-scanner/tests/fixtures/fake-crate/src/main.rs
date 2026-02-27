use serde::Serialize;
use hallucinated_crate::FakeStruct;
use nonexistent_lib::utils::helper;
use crate::phantom_module::Config;
use std::collections::HashMap;

mod real_mod;

fn main() {
    println!("This project has fake dependencies");
}
