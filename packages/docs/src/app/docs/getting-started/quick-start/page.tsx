import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Quick Start",
  description: "Write your first ISL intent specification in 5 minutes.",
};

export default function QuickStartPage() {
  return (
    <div>
      <h1>Quick Start</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Write your first ISL intent specification in 5 minutes.
      </p>

      <h2 id="prerequisites">Prerequisites</h2>
      <p>
        Make sure you have{" "}
        <Link href="/docs/getting-started/installation">installed the ISL CLI</Link>.
        You can verify your installation:
      </p>

      <CodeBlock
        code="isl --version"
        language="bash"
      />

      <h2 id="create-your-first-spec">Create Your First Spec</h2>
      <p>
        Let&apos;s create a simple specification for a todo list application.
        Create a new file called <code>todo.isl</code>:
      </p>

      <CodeBlock
        code={`// todo.isl
intent CreateTodo {
  pre {
    title != ""
    title.length <= 200
  }
  
  post {
    result.id != null
    result.title == title
    result.completed == false
    result.createdAt <= now()
  }
}

intent CompleteTodo {
  pre {
    todo.exists(id)
    !todo.completed
  }
  
  post {
    todo.completed == true
    todo.completedAt != null
    todo.completedAt <= now()
  }
}`}
        language="isl"
        filename="todo.isl"
        showLineNumbers
      />

      <h2 id="validate-your-spec">Validate Your Spec</h2>
      <p>Run the ISL checker to validate your specification:</p>

      <CodeBlock
        code={`$ isl check todo.isl
✓ Parsed successfully
✓ Type checking passed
✓ 2 intents found

Intents:
  - CreateTodo (2 preconditions, 4 postconditions)
  - CompleteTodo (2 preconditions, 3 postconditions)`}
        language="bash"
      />

      <Callout type="tip" title="Editor Support">
        Install the{" "}
        <Link href="/docs/tools/vscode">VS Code extension</Link> for syntax
        highlighting, auto-completion, and real-time validation.
      </Callout>

      <h2 id="generate-code">Generate Code</h2>
      <p>Generate TypeScript types and validators from your spec:</p>

      <CodeBlock
        code={`$ isl generate typescript todo.isl -o ./src/generated

Generated:
  - src/generated/todo.types.ts
  - src/generated/todo.validators.ts
  - src/generated/todo.contracts.ts`}
        language="bash"
      />

      <p>The generated TypeScript looks like this:</p>

      <CodeBlock
        code={`// src/generated/todo.types.ts
export interface CreateTodoInput {
  title: string;
}

export interface CreateTodoOutput {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface CreateTodoContract {
  validatePreconditions(input: CreateTodoInput): ValidationResult;
  validatePostconditions(input: CreateTodoInput, output: CreateTodoOutput): ValidationResult;
}`}
        language="typescript"
        filename="todo.types.ts"
      />

      <h2 id="run-verification">Run Verification</h2>
      <p>
        Once you&apos;ve implemented your todo functions, verify they match the spec:
      </p>

      <CodeBlock
        code={`$ isl verify todo.isl --impl ./src/todo.ts

Running verification...

CreateTodo:
  ✓ Precondition: title != "" (passed)
  ✓ Precondition: title.length <= 200 (passed)
  ✓ Postcondition: result.id != null (passed)
  ✓ Postcondition: result.title == title (passed)
  ✓ Postcondition: result.completed == false (passed)
  ✓ Postcondition: result.createdAt <= now() (passed)

CompleteTodo:
  ✓ All conditions passed

Trust Score: 100%`}
        language="bash"
      />

      <Callout type="success" title="Congratulations!">
        You&apos;ve written your first ISL specification, validated it, generated
        code, and verified your implementation.
      </Callout>

      <h2 id="next-steps">Next Steps</h2>
      <div className="not-prose grid gap-3 mt-6">
        <Link
          href="/docs/getting-started/concepts"
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
        >
          <div>
            <div className="font-semibold group-hover:text-primary transition-colors">
              Core Concepts
            </div>
            <div className="text-sm text-muted-foreground">
              Learn about intents, pre/post conditions, invariants, and scenarios
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
        <Link
          href="/docs/language-reference"
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
        >
          <div>
            <div className="font-semibold group-hover:text-primary transition-colors">
              Language Reference
            </div>
            <div className="text-sm text-muted-foreground">
              Explore the full ISL syntax and features
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </div>
    </div>
  );
}
