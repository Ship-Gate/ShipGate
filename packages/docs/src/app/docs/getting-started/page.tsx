import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Getting Started - ISL Documentation",
  description: "Learn how to install ISL and write your first specification.",
};

export default function GettingStartedPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Getting Started with ISL</h1>
        
        <p className="lead text-xl text-muted-foreground">
          Intent Specification Language (ISL) is a domain-specific language for defining 
          behavioral contracts that guarantee your software works correctly.
        </p>

        <h2>What is ISL?</h2>
        
        <p>
          ISL lets you define <strong>what</strong> your software should do, rather than 
          <strong> how</strong> it should do it. You write specifications that describe:
        </p>

        <ul>
          <li><strong>Types</strong> - The shape of your data with validation rules</li>
          <li><strong>Entities</strong> - Domain objects with invariants and lifecycles</li>
          <li><strong>Behaviors</strong> - Operations with preconditions and postconditions</li>
          <li><strong>Temporal properties</strong> - Performance and ordering guarantees</li>
        </ul>

        <p>
          From these specs, ISL can generate TypeScript types, runtime validation tests, 
          API documentation, and more.
        </p>

        <h2>Quick Example</h2>

        <p>
          Here&apos;s a simple ISL specification for a user registration system:
        </p>

        <CodeBlock
          code={`domain UserRegistration {
  type Email = String { format: "email" }
  type Password = String { min_length: 8 }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    created_at: Timestamp [immutable]

    invariants {
      email.is_valid_format
    }
  }

  behavior Register {
    input {
      email: Email
      password: Password [sensitive]
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS { when: "Email already registered" }
      }
    }

    preconditions {
      not User.exists_by_email(input.email)
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
      }
    }
  }
}`}
          language="isl"
          filename="registration.isl"
          showLineNumbers
        />

        <h2>What You Can Do</h2>

        <div className="grid md:grid-cols-2 gap-4 not-prose my-8">
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2">Generate Types</h3>
            <p className="text-sm text-muted-foreground">
              Auto-generate TypeScript interfaces and Zod schemas from your specs.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2">Runtime Verification</h3>
            <p className="text-sm text-muted-foreground">
              Generate tests that verify your implementation matches your intent.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2">Chaos Testing</h3>
            <p className="text-sm text-muted-foreground">
              Test how your system behaves under failure conditions.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2">Documentation</h3>
            <p className="text-sm text-muted-foreground">
              Generate API docs and contract documentation automatically.
            </p>
          </div>
        </div>

        <h2>Next Steps</h2>

        <div className="not-prose flex flex-col gap-3">
          <Link 
            href="/docs/getting-started/installation" 
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">Installation</div>
              <div className="text-sm text-muted-foreground">Install the ISL CLI and VS Code extension</div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
          <Link 
            href="/docs/getting-started/first-spec" 
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">Your First Spec</div>
              <div className="text-sm text-muted-foreground">Write and validate your first ISL specification</div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
