import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Code Generation",
  description: "Generate TypeScript, Rust, Go, and OpenAPI from ISL specifications.",
};

const targets = [
  {
    title: "TypeScript",
    href: "/docs/code-generation/typescript",
    description: "Generate TypeScript types, validators, and runtime contracts.",
    features: ["Type definitions", "Zod validators", "Runtime contracts"],
  },
  {
    title: "Rust",
    href: "/docs/code-generation/rust",
    description: "Generate Rust structs, enums, and validation traits.",
    features: ["Structs & enums", "Serde support", "Custom validators"],
  },
  {
    title: "Go",
    href: "/docs/code-generation/go",
    description: "Generate Go structs, interfaces, and validation functions.",
    features: ["Struct definitions", "JSON tags", "Validation methods"],
  },
  {
    title: "OpenAPI",
    href: "/docs/code-generation/openapi",
    description: "Generate OpenAPI 3.0 specifications from ISL.",
    features: ["Schema definitions", "Path operations", "Request/response models"],
  },
];

export default function CodeGenerationPage() {
  return (
    <div>
      <h1>Code Generation</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Generate type-safe code from ISL specifications.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        ISL can generate code for multiple languages and formats from your specifications.
        Generated code includes:
      </p>
      <ul>
        <li><strong>Type definitions</strong> - Structs, interfaces, and type aliases</li>
        <li><strong>Validators</strong> - Runtime validation matching your constraints</li>
        <li><strong>Contracts</strong> - Pre/post condition checkers</li>
        <li><strong>Documentation</strong> - Comments extracted from specs</li>
      </ul>

      <h2 id="targets">Generation Targets</h2>
      <div className="not-prose grid gap-4 mt-6">
        {targets.map((target) => (
          <Link
            key={target.href}
            href={target.href}
            className="group flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <div>
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                {target.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                {target.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {target.features.map((feature) => (
                  <span
                    key={feature}
                    className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>

      <h2 id="basic-usage">Basic Usage</h2>
      <p>
        Use the <code>isl generate</code> command to generate code:
      </p>
      <pre className="my-4 p-4 rounded-lg border bg-card overflow-x-auto">
        <code>isl generate &lt;target&gt; &lt;spec-files&gt; -o &lt;output-dir&gt;</code>
      </pre>

      <h2 id="configuration">Configuration</h2>
      <p>
        Configure generation options in <code>isl.config.json</code>:
      </p>
      <pre className="my-4 p-4 rounded-lg border bg-card overflow-x-auto font-mono text-sm">
{`{
  "generate": {
    "typescript": {
      "output": "./src/generated",
      "options": {
        "runtime": "zod",
        "strict": true
      }
    },
    "rust": {
      "output": "./src/generated",
      "options": {
        "derive": ["Debug", "Clone", "Serialize", "Deserialize"]
      }
    }
  }
}`}
      </pre>
    </div>
  );
}
