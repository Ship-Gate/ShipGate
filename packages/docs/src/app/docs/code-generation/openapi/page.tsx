import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "OpenAPI Generation",
  description: "Generate OpenAPI 3.0 specifications from ISL.",
};

export default function OpenAPIPage() {
  return (
    <div>
      <h1>OpenAPI Generation</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Generate OpenAPI 3.0 specifications from ISL.
      </p>

      <h2 id="basic-usage">Basic Usage</h2>
      <CodeBlock
        code="isl generate openapi auth.isl -o ./api/openapi.yaml"
        language="bash"
      />

      <h2 id="example">Example Output</h2>
      <CodeBlock
        code={`openapi: 3.0.3
info:
  title: Generated API
  version: 1.0.0

paths:
  /users:
    post:
      operationId: createUser
      summary: Create a new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserInput'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Validation error

components:
  schemas:
    User:
      type: object
      required: [id, email, createdAt]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        email:
          type: string
          format: email
        createdAt:
          type: string
          format: date-time
          readOnly: true
    
    CreateUserInput:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
          minLength: 1
        password:
          type: string
          minLength: 8
          writeOnly: true`}
        language="yaml"
        filename="openapi.yaml"
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
              <td className="py-2 px-3"><code>version</code></td>
              <td className="py-2 px-3">3.0.3</td>
              <td className="py-2 px-3">OpenAPI version</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>format</code></td>
              <td className="py-2 px-3">yaml</td>
              <td className="py-2 px-3">Output format: yaml or json</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>servers</code></td>
              <td className="py-2 px-3">[]</td>
              <td className="py-2 px-3">Server URLs to include</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
