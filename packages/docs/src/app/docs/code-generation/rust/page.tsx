import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Rust Generation",
  description: "Generate Rust structs, enums, and validation from ISL.",
};

export default function RustPage() {
  return (
    <div>
      <h1>Rust Generation</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Generate type-safe Rust code from ISL specifications.
      </p>

      <h2 id="basic-usage">Basic Usage</h2>
      <CodeBlock
        code="isl generate rust auth.isl -o ./src/generated"
        language="bash"
      />

      <h2 id="example">Example Output</h2>
      <CodeBlock
        code={`// generated/user.rs
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserInput {
    pub email: String,
    pub password: String,
}

impl CreateUserInput {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();
        
        if self.email.is_empty() {
            errors.push("email must not be empty".to_string());
        }
        if self.password.len() < 8 {
            errors.push("password must be at least 8 characters".to_string());
        }
        
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}`}
        language="rust"
        filename="user.rs"
        showLineNumbers
      />

      <h2 id="options">Configuration Options</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Option</th>
              <th className="text-left py-2 px-3">Default</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>derive</code></td>
              <td className="py-2 px-3">[Debug, Clone]</td>
              <td className="py-2 px-3">Derive macros to add</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>serde</code></td>
              <td className="py-2 px-3">true</td>
              <td className="py-2 px-3">Add Serialize/Deserialize</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>validation</code></td>
              <td className="py-2 px-3">validator</td>
              <td className="py-2 px-3">Validation library: validator or custom</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
