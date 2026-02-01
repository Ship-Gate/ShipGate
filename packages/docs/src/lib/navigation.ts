import {
  BookOpen,
  Code2,
  Wrench,
  FileOutput,
  Compass,
  FileCode,
  Terminal,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description?: string;
}

export interface NavSection {
  title: string;
  icon: typeof BookOpen;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      {
        href: "/docs/getting-started",
        label: "Introduction",
        description: "What is ISL and why use it",
      },
      {
        href: "/docs/getting-started/installation",
        label: "Installation",
        description: "npm install, CLI setup",
      },
      {
        href: "/docs/getting-started/quick-start",
        label: "Quick Start",
        description: "Write your first intent in 5 min",
      },
      {
        href: "/docs/getting-started/concepts",
        label: "Core Concepts",
        description: "Intents, pre/post, invariants, scenarios",
      },
    ],
  },
  {
    title: "Language Reference",
    icon: Code2,
    items: [
      {
        href: "/docs/language-reference",
        label: "Overview",
        description: "ISL language overview",
      },
      {
        href: "/docs/language-reference/intents",
        label: "Intents",
        description: "Intent syntax, full grammar",
      },
      {
        href: "/docs/language-reference/expressions",
        label: "Expressions",
        description: "All operators, precedence",
      },
      {
        href: "/docs/language-reference/types",
        label: "Types",
        description: "Type system, built-in types",
      },
      {
        href: "/docs/language-reference/scenarios",
        label: "Scenarios",
        description: "Scenario blocks, given/when/then",
      },
      {
        href: "/docs/language-reference/chaos",
        label: "Chaos Testing",
        description: "Chaos testing, injections",
      },
      {
        href: "/docs/language-reference/quantifiers",
        label: "Quantifiers",
        description: "forall, exists",
      },
      {
        href: "/docs/language-reference/builtins",
        label: "Built-ins",
        description: "Built-in functions reference",
      },
    ],
  },
  {
    title: "Tools",
    icon: Wrench,
    items: [
      {
        href: "/docs/tools",
        label: "Overview",
        description: "ISL tooling ecosystem",
      },
      {
        href: "/docs/tools/cli",
        label: "CLI",
        description: "CLI commands and flags",
      },
      {
        href: "/docs/tools/repl",
        label: "REPL",
        description: "Interactive REPL usage",
      },
      {
        href: "/docs/tools/vscode",
        label: "VS Code Extension",
        description: "Editor setup and features",
      },
      {
        href: "/docs/tools/mcp",
        label: "MCP Server",
        description: "Model Context Protocol integration",
      },
    ],
  },
  {
    title: "Code Generation",
    icon: FileOutput,
    items: [
      {
        href: "/docs/code-generation",
        label: "Overview",
        description: "Code generation overview",
      },
      {
        href: "/docs/code-generation/typescript",
        label: "TypeScript",
        description: "TS output format, usage",
      },
      {
        href: "/docs/code-generation/rust",
        label: "Rust",
        description: "Rust output format, usage",
      },
      {
        href: "/docs/code-generation/go",
        label: "Go",
        description: "Go output format, usage",
      },
      {
        href: "/docs/code-generation/openapi",
        label: "OpenAPI",
        description: "OpenAPI spec generation",
      },
    ],
  },
  {
    title: "Guides",
    icon: Compass,
    items: [
      {
        href: "/docs/guides",
        label: "Overview",
        description: "Practical guides",
      },
      {
        href: "/docs/guides/validating-ai-code",
        label: "Validating AI Code",
        description: "Using ISL with Cursor/Copilot/Claude",
      },
      {
        href: "/docs/guides/ci-cd-integration",
        label: "CI/CD Integration",
        description: "Adding ISL checks to CI pipelines",
      },
      {
        href: "/docs/guides/writing-good-specs",
        label: "Writing Good Specs",
        description: "Best practices for intent specs",
      },
    ],
  },
  {
    title: "API Reference",
    icon: FileCode,
    items: [
      {
        href: "/docs/api",
        label: "Programmatic API",
        description: "Use ISL from code",
      },
    ],
  },
];

export const topNavItems = [
  { href: "/docs/getting-started", label: "Docs" },
  { href: "/docs/language-reference", label: "Reference" },
  { href: "/docs/guides", label: "Guides" },
  { href: "/playground", label: "Playground" },
];
