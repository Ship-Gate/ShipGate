//! Rust Auth Example - Demonstrates ISL runtime verification
//!
//! This example shows how to:
//! 1. Load ISL constraints
//! 2. Emit trace events during behavior execution
//! 3. Save traces for verification with `shipgate verify`

use isl_runtime::{ConstraintLoader, TraceEmitter};
use serde_json::json;
use std::collections::HashMap;
use std::time::Instant;

// Simple user store
struct UserStore {
    users: HashMap<String, User>,
}

#[derive(Clone)]
struct User {
    id: String,
    email: String,
    username: String,
    login_count: u32,
}

impl UserStore {
    fn new() -> Self {
        Self {
            users: HashMap::new(),
        }
    }

    fn create_user(&mut self, email: String, username: String) -> Result<User, String> {
        if self.users.contains_key(&email) {
            return Err("EMAIL_EXISTS".to_string());
        }
        let user = User {
            id: format!("user_{}", self.users.len()),
            email: email.clone(),
            username,
            login_count: 0,
        };
        self.users.insert(email, user.clone());
        Ok(user)
    }

    fn login(&mut self, email: &str) -> Result<String, String> {
        let user = self.users.get_mut(email).ok_or("USER_NOT_FOUND")?;
        user.login_count += 1;
        Ok(format!("session_{}", user.id))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Rust Auth Example - ISL Runtime Verification ===\n");

    // 1. Load constraints
    println!("1. Loading ISL constraints...");
    let loader = ConstraintLoader::new();
    
    // Try loading from JSON first (recommended), fallback to ISL
    let constraints = if std::path::Path::new("specs/auth.json").exists() {
        loader.load_from_json("specs/auth.json")?
    } else {
        loader.load_from_file("specs/auth.isl")?
    };

    println!("   Loaded domain: {}", constraints.domain);
    println!("   Behaviors: {}", constraints.behaviors.len());
    for behavior in &constraints.behaviors {
        println!("     - {} ({} preconditions, {} postconditions)",
            behavior.name,
            behavior.preconditions.len(),
            behavior.postconditions.len()
        );
    }
    println!();

    // 2. Initialize user store
    let mut store = UserStore::new();

    // 3. Execute CreateUser behavior with tracing
    println!("2. Executing CreateUser behavior...");
    let mut emitter = TraceEmitter::new(&constraints.domain, "CreateUser");
    
    // Capture initial state
    emitter.capture_initial_state(json!({
        "user_count": store.users.len(),
    }));

    let input = json!({
        "email": "alice@example.com",
        "username": "alice",
    });

    // Emit call event
    let start = Instant::now();
    emitter.emit_call("CreateUser", &input);

    // Check preconditions
    let email = input["email"].as_str().unwrap();
    let username = input["username"].as_str().unwrap();
    let pre1_passed = !email.is_empty();
    let pre2_passed = !username.is_empty();
    
    emitter.emit_check(
        "input.email.length > 0",
        pre1_passed,
        "precondition",
        None,
        None,
        None,
    );
    emitter.emit_check(
        "input.username.length > 0",
        pre2_passed,
        "precondition",
        None,
        None,
        None,
    );

    // Execute behavior
    let result = store.create_user(
        email.to_string(),
        username.to_string(),
    );

    let duration = start.elapsed().as_millis() as i64;

    match &result {
        Ok(user) => {
            let output = json!({
                "id": user.id,
                "email": user.email,
                "username": user.username,
            });
            emitter.emit_return("CreateUser", &output, duration);

            // Check postconditions
            emitter.emit_check(
                "result.id != null",
                true,
                "postcondition",
                None,
                None,
                None,
            );

            println!("   ✓ Created user: {} ({})", user.username, user.id);
        }
        Err(e) => {
            emitter.emit_error(e, Some("CREATE_USER_ERROR"), None);
            println!("   ✗ Error: {}", e);
        }
    }

    // Save trace
    std::fs::create_dir_all(".shipgate/traces")?;
    emitter.save_to_file(".shipgate/traces/create_user.json", result.is_ok())?;
    println!("   Trace saved to .shipgate/traces/create_user.json\n");

    // 4. Execute Login behavior with tracing
    if result.is_ok() {
        println!("3. Executing Login behavior...");
        let mut emitter = TraceEmitter::new(&constraints.domain, "Login");

        emitter.capture_initial_state(json!({
            "user_count": store.users.len(),
        }));

        let input = json!({
            "email": "alice@example.com",
            "ip_address": "192.168.1.100",
        });

        let start = Instant::now();
        emitter.emit_call("Login", &input);

        // Check preconditions
        let email = input["email"].as_str().unwrap();
        let pre_passed = !email.is_empty();
        emitter.emit_check(
            "input.email.length > 0",
            pre_passed,
            "precondition",
            None,
            None,
            None,
        );

        // Execute behavior
        let result = store.login(email);
        let duration = start.elapsed().as_millis() as i64;

        match &result {
            Ok(session_id) => {
                let output = json!({
                    "session_id": session_id,
                });
                emitter.emit_return("Login", &output, duration);

                // Check postconditions
                emitter.emit_check(
                    "result.session_id != null",
                    true,
                    "postcondition",
                    None,
                    None,
                    None,
                );

                println!("   ✓ Login successful: {}", session_id);
            }
            Err(e) => {
                emitter.emit_error(e, Some("LOGIN_ERROR"), None);
                println!("   ✗ Error: {}", e);
            }
        }

        // Save trace
        emitter.save_to_file(".shipgate/traces/login.json", result.is_ok())?;
        println!("   Trace saved to .shipgate/traces/login.json\n");
    }

    // 5. Summary
    println!("=== Summary ===");
    println!("Traces generated:");
    println!("  - .shipgate/traces/create_user.json");
    println!("  - .shipgate/traces/login.json");
    println!();
    println!("To verify with shipgate:");
    println!("  shipgate verify --proof .shipgate/traces");

    Ok(())
}
