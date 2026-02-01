"use client";

import { useState, useCallback } from "react";
import { Play, Copy, Check, Download, Share2, RotateCcw } from "lucide-react";
import { clsx } from "clsx";

const defaultCode = `# Try ISL - Intent Specification Language
# Edit this code and click "Run" to see the output

domain TodoApp {
  version: "1.0.0"

  type TodoId = UUID { immutable: true }
  type Title = String { min_length: 1, max_length: 200 }

  enum TodoStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
  }

  entity Todo {
    id: TodoId [immutable, unique]
    title: Title
    description: String?
    status: TodoStatus [default: PENDING]
    created_at: Timestamp [immutable]
    completed_at: Timestamp?

    invariants {
      title.length > 0
      status == COMPLETED implies completed_at != null
    }

    lifecycle {
      PENDING -> IN_PROGRESS
      PENDING -> COMPLETED
      IN_PROGRESS -> COMPLETED
    }
  }

  behavior CreateTodo {
    description: "Create a new todo item"

    input {
      title: Title
      description: String?
    }

    output {
      success: Todo
      errors {
        TITLE_EMPTY {
          when: "Title is empty"
          retriable: false
        }
      }
    }

    preconditions {
      input.title.trim().length > 0
    }

    postconditions {
      success implies {
        - Todo.exists(result.id)
        - result.title == input.title
        - result.status == PENDING
      }
    }
  }
}`;

const examples = [
  { name: "Todo App", code: defaultCode },
  {
    name: "User Auth",
    code: `domain UserAuth {
  type Email = String { format: "email" }
  type Password = String { min_length: 8 }

  enum UserStatus { ACTIVE, INACTIVE, LOCKED }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    password_hash: String [secret]
    status: UserStatus
    failed_attempts: Int [default: 0]

    invariants {
      failed_attempts >= 0
      failed_attempts <= 5
      failed_attempts >= 5 implies status == LOCKED
    }
  }

  behavior Login {
    input {
      email: Email
      password: Password [sensitive]
    }

    output {
      success: { user: User, token: String }
      errors {
        INVALID_CREDENTIALS { when: "Wrong email or password" }
        USER_LOCKED { when: "Too many failed attempts" }
      }
    }

    preconditions {
      User.exists_by_email(input.email)
    }

    postconditions {
      success implies {
        - User.failed_attempts == 0
      }
      INVALID_CREDENTIALS implies {
        - User.failed_attempts == old(User.failed_attempts) + 1
      }
    }
  }
}`,
  },
  {
    name: "Payment",
    code: `domain Payments {
  type Money = Decimal { min: 0, precision: 2 }

  enum PaymentStatus {
    PENDING
    AUTHORIZED
    CAPTURED
    FAILED
    REFUNDED
  }

  entity Payment {
    id: UUID [immutable, unique]
    amount: Money
    status: PaymentStatus
    created_at: Timestamp [immutable]
    captured_at: Timestamp?

    invariants {
      amount > 0
      status == CAPTURED implies captured_at != null
    }

    lifecycle {
      PENDING -> AUTHORIZED
      AUTHORIZED -> CAPTURED
      AUTHORIZED -> FAILED
      CAPTURED -> REFUNDED
    }
  }

  behavior ProcessPayment {
    input {
      amount: Money
      card_token: String [sensitive]
    }

    output {
      success: Payment
      errors {
        CARD_DECLINED { when: "Card was declined" }
        INSUFFICIENT_FUNDS { when: "Not enough funds" }
      }
    }

    postconditions {
      success implies {
        - Payment.status == AUTHORIZED
        - Payment.amount == input.amount
      }
    }

    temporal {
      - within 3s (p99): response returned
    }
  }
}`,
  },
];

interface ParseResult {
  success: boolean;
  message: string;
  details?: {
    domains: number;
    types: number;
    enums: number;
    entities: number;
    behaviors: number;
    errors?: Array<{ line: number; message: string }>;
  };
}

function simulateParse(code: string): ParseResult {
  // Simple validation simulation
  const lines = code.split("\n");
  const errors: Array<{ line: number; message: string }> = [];

  let domains = 0;
  let types = 0;
  let enums = 0;
  let entities = 0;
  let behaviors = 0;

  let braceCount = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Count constructs
    if (trimmed.startsWith("domain ")) domains++;
    if (trimmed.startsWith("type ")) types++;
    if (trimmed.startsWith("enum ")) enums++;
    if (trimmed.startsWith("entity ")) entities++;
    if (trimmed.startsWith("behavior ")) behaviors++;

    // Count braces
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;

    // Check for common errors
    if (trimmed.includes("typo") || trimmed.includes("undefined")) {
      errors.push({ line: index + 1, message: "Unknown identifier" });
    }
  });

  if (braceCount !== 0) {
    errors.push({
      line: lines.length,
      message: braceCount > 0 ? "Missing closing brace" : "Extra closing brace",
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: `Found ${errors.length} error(s)`,
      details: { domains, types, enums, entities, behaviors, errors },
    };
  }

  return {
    success: true,
    message: "Specification is valid!",
    details: { domains, types, enums, entities, behaviors },
  };
}

export default function PlaygroundPage() {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState<ParseResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"output" | "types" | "tests">(
    "output"
  );

  const handleRun = useCallback(() => {
    setRunning(true);
    // Simulate async parsing
    setTimeout(() => {
      const result = simulateParse(code);
      setOutput(result);
      setRunning(false);
    }, 500);
  }, [code]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleReset = useCallback(() => {
    setCode(defaultCode);
    setOutput(null);
  }, []);

  const handleLoadExample = useCallback((exampleCode: string) => {
    setCode(exampleCode);
    setOutput(null);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">ISL Playground</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Examples:</span>
            {examples.map((example) => (
              <button
                key={example.name}
                onClick={() => handleLoadExample(example.code)}
                className="px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors"
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-border hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-border hover:bg-muted transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1 px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {running ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="px-4 py-2 border-b border-border bg-muted/50 text-sm text-muted-foreground">
            editor.isl
          </div>
          <div className="flex-1 overflow-hidden">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-full p-4 bg-background font-mono text-sm resize-none outline-none playground-editor"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Output */}
        <div className="w-[400px] flex flex-col">
          {/* Output tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("output")}
              className={clsx(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "output"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Output
            </button>
            <button
              onClick={() => setActiveTab("types")}
              className={clsx(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "types"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Generated Types
            </button>
            <button
              onClick={() => setActiveTab("tests")}
              className={clsx(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "tests"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tests
            </button>
          </div>

          {/* Output content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === "output" && (
              <>
                {!output && (
                  <div className="text-muted-foreground text-sm">
                    Click &quot;Run&quot; to check your specification
                  </div>
                )}
                {output && (
                  <div className="space-y-4">
                    <div
                      className={clsx(
                        "flex items-center gap-2 text-sm font-medium",
                        output.success ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {output.success ? "✓" : "✗"} {output.message}
                    </div>

                    {output.details && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Summary:</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="text-muted-foreground">
                              Domains
                            </span>
                            <span>{output.details.domains}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="text-muted-foreground">Types</span>
                            <span>{output.details.types}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="text-muted-foreground">Enums</span>
                            <span>{output.details.enums}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="text-muted-foreground">
                              Entities
                            </span>
                            <span>{output.details.entities}</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted col-span-2">
                            <span className="text-muted-foreground">
                              Behaviors
                            </span>
                            <span>{output.details.behaviors}</span>
                          </div>
                        </div>

                        {output.details.errors &&
                          output.details.errors.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <div className="text-sm font-medium text-red-500">
                                Errors:
                              </div>
                              {output.details.errors.map((error, i) => (
                                <div
                                  key={i}
                                  className="p-2 rounded bg-red-500/10 text-sm"
                                >
                                  <span className="text-red-500">
                                    Line {error.line}:
                                  </span>{" "}
                                  {error.message}
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === "types" && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-4">
                  Generated TypeScript types will appear here after running.
                </div>
                {output?.success && (
                  <pre className="p-4 rounded bg-muted font-mono text-xs overflow-auto">
                    {`// Generated from ISL specification

export enum TodoStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
}

export type CreateTodoResult =
  | { ok: true; data: Todo }
  | { ok: false; error: { code: "TITLE_EMPTY" } };`}
                  </pre>
                )}
              </div>
            )}

            {activeTab === "tests" && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-4">
                  Generated test cases will appear here after running.
                </div>
                {output?.success && (
                  <pre className="p-4 rounded bg-muted font-mono text-xs overflow-auto">
                    {`// Generated verification tests

describe("CreateTodo", () => {
  describe("preconditions", () => {
    it("rejects empty title", async () => {
      const result = await createTodo({
        title: "",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("postconditions", () => {
    it("creates todo with PENDING status", async () => {
      const result = await createTodo({
        title: "Test todo",
      });
      
      if (result.ok) {
        expect(result.data.status).toBe("PENDING");
        expect(result.data.title).toBe("Test todo");
      }
    });
  });
});`}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
