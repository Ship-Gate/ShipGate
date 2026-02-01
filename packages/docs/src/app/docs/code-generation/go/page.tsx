import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Go Generation",
  description: "Generate Go structs and validation from ISL.",
};

export default function GoPage() {
  return (
    <div>
      <h1>Go Generation</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Generate type-safe Go code from ISL specifications.
      </p>

      <h2 id="basic-usage">Basic Usage</h2>
      <CodeBlock
        code="isl generate go auth.isl -o ./internal/generated"
        language="bash"
      />

      <h2 id="example">Example Output</h2>
      <CodeBlock
        code={`// generated/user.go
package generated

import (
    "time"
    "github.com/google/uuid"
)

type User struct {
    ID           uuid.UUID \`json:"id"\`
    Email        string    \`json:"email"\`
    PasswordHash string    \`json:"-"\`
    CreatedAt    time.Time \`json:"created_at"\`
}

type CreateUserInput struct {
    Email    string \`json:"email" validate:"required,email"\`
    Password string \`json:"password" validate:"required,min=8"\`
}

func (i *CreateUserInput) Validate() error {
    if i.Email == "" {
        return errors.New("email must not be empty")
    }
    if len(i.Password) < 8 {
        return errors.New("password must be at least 8 characters")
    }
    return nil
}`}
        language="go"
        filename="user.go"
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
              <td className="py-2 px-3"><code>package</code></td>
              <td className="py-2 px-3">generated</td>
              <td className="py-2 px-3">Go package name</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>jsonTags</code></td>
              <td className="py-2 px-3">true</td>
              <td className="py-2 px-3">Add JSON struct tags</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>validation</code></td>
              <td className="py-2 px-3">go-validator</td>
              <td className="py-2 px-3">Validation library</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
