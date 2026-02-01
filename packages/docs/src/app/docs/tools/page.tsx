import Link from "next/link";
import { ArrowRight, Terminal, PlayCircle, Code2, Plug } from "lucide-react";

export const metadata = {
  title: "Tools",
  description: "ISL tooling ecosystem: CLI, REPL, VS Code extension, and MCP integration.",
};

const tools = [
  {
    icon: Terminal,
    title: "CLI",
    href: "/docs/tools/cli",
    description: "The command-line interface for checking, generating, and verifying ISL specs.",
    features: ["isl check", "isl generate", "isl verify", "isl init"],
  },
  {
    icon: PlayCircle,
    title: "REPL",
    href: "/docs/tools/repl",
    description: "Interactive Read-Eval-Print Loop for experimenting with ISL.",
    features: ["Live evaluation", "Tab completion", "History", "Multi-line input"],
  },
  {
    icon: Code2,
    title: "VS Code Extension",
    href: "/docs/tools/vscode",
    description: "Full editor support with syntax highlighting, diagnostics, and IntelliSense.",
    features: ["Syntax highlighting", "Error diagnostics", "Go to definition", "Hover docs"],
  },
  {
    icon: Plug,
    title: "MCP Server",
    href: "/docs/tools/mcp",
    description: "Model Context Protocol server for AI assistant integration.",
    features: ["Cursor integration", "Claude support", "Spec validation", "Code generation"],
  },
];

export default function ToolsPage() {
  return (
    <div>
      <h1>Tools</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        The ISL tooling ecosystem for development, testing, and integration.
      </p>

      <div className="not-prose grid gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group block p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <tool.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                  {tool.title}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {tool.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tool.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                    >
                      {feature}
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
