import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Wrench, FileOutput, Compass } from "lucide-react";

export const metadata = {
  title: "Documentation",
  description: "ISL Documentation - Learn the Intent Specification Language from zero to productive.",
};

const sections = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Install ISL and write your first specification in minutes.",
    href: "/docs/getting-started",
    items: ["Installation", "Quick Start", "Core Concepts"],
  },
  {
    icon: Code2,
    title: "Language Reference",
    description: "Complete guide to ISL syntax, types, and features.",
    href: "/docs/language-reference",
    items: ["Intents", "Expressions", "Types", "Scenarios"],
  },
  {
    icon: Wrench,
    title: "Tools",
    description: "CLI, REPL, VS Code extension, and MCP integration.",
    href: "/docs/tools",
    items: ["CLI", "REPL", "VS Code", "MCP Server"],
  },
  {
    icon: FileOutput,
    title: "Code Generation",
    description: "Generate TypeScript, Rust, Go, and OpenAPI from specs.",
    href: "/docs/code-generation",
    items: ["TypeScript", "Rust", "Go", "OpenAPI"],
  },
  {
    icon: Compass,
    title: "Guides",
    description: "Best practices and integration guides.",
    href: "/docs/guides",
    items: ["Validating AI Code", "CI/CD Integration", "Writing Good Specs"],
  },
];

export default function DocsPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Documentation</h1>
        <p className="text-xl text-muted-foreground">
          Learn ISL, the Intent Specification Language for defining behavioral contracts
          that guarantee software correctness.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group block p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <section.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                  {section.title}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {section.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item) => (
                    <span
                      key={item}
                      className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
