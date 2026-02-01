import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import {
  ArrowRight,
  Shield,
  Zap,
  FileCode,
  TestTube,
  BookOpen,
  Terminal,
  Bot,
  Copy,
  Check,
} from "lucide-react";

const heroExample = `intent ProcessPayment {
  pre {
    amount > 0
    card.valid
    !order.alreadyPaid
  }
  
  post {
    success implies {
      payment.charged == amount
      order.status == "paid"
      receipt.sent(customer.email)
    }
    
    failure implies {
      order.status == old(order.status)
      error.logged
    }
  }
}`;

const features = [
  {
    icon: Shield,
    title: "Catch Fake Features",
    description:
      "AI can generate code that looks right but doesn't work. ISL catches functions that return hardcoded values, skip validation, or ignore errors.",
  },
  {
    icon: Bot,
    title: "Verify AI-Generated Code",
    description:
      "Write specs before asking AI to generate code. Then verify the implementation actually matches your intent—not just your tests.",
  },
  {
    icon: FileCode,
    title: "Generate Type-Safe Code",
    description:
      "From one ISL spec, generate TypeScript types, Rust structs, Go interfaces, and OpenAPI schemas. One source of truth for your contracts.",
  },
];

const quickLinks = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Install ISL and write your first specification in 5 minutes",
    href: "/docs/getting-started",
  },
  {
    icon: FileCode,
    title: "Language Reference",
    description: "Complete guide to ISL syntax, types, and features",
    href: "/docs/language-reference",
  },
  {
    icon: Terminal,
    title: "CLI Reference",
    description: "All commands and options for the ISL CLI",
    href: "/docs/tools/cli",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-isl-cyan/5" />
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Part of the VibeCheck Platform
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                Specify intent.
                <br />
                Verify code.
                <br />
                <span className="text-primary">Ship with confidence.</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-lg">
                ISL is a contract/specification language for validating AI-generated code.
                Define what your code should do, verify it actually does it.
              </p>
              
              {/* Install command */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border font-mono text-sm">
                  <span className="text-muted-foreground">$</span>
                  <span>npm install -g @isl/cli</span>
                  <button
                    className="ml-2 p-1 rounded hover:bg-muted transition-colors"
                    aria-label="Copy install command"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/docs/getting-started/quick-start"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/playground"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Try Playground
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-isl-cyan/20 rounded-2xl blur-2xl opacity-50" />
              <CodeBlock code={heroExample} language="isl" showLineNumbers />
            </div>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-20 px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Why ISL?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              AI-generated code can look perfect but be completely broken.
              ISL helps you catch &quot;fake features&quot; before they ship.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl border border-border bg-card"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Write Once, Verify Everywhere
              </h2>
              <p className="text-muted-foreground mb-6">
                ISL specifications are your single source of truth. From one
                spec file, you can:
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-isl-green" />
                  </div>
                  <span>Generate TypeScript types and validators</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-isl-green" />
                  </div>
                  <span>Verify implementations match your intent</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-isl-green" />
                  </div>
                  <span>Generate OpenAPI documentation</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-isl-green" />
                  </div>
                  <span>Run chaos tests for failure scenarios</span>
                </li>
              </ul>
              <Link
                href="/docs/code-generation"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Learn about code generation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Terminal
              </div>
              <CodeBlock
                code={`$ isl check payment.isl
✓ Parsed successfully
✓ Type checking passed
✓ 3 intents, 2 invariants found

$ isl generate typescript payment.isl -o ./src/types
Generated 4 TypeScript interfaces
Generated 3 Zod validators
Generated 3 contract checkers

$ isl verify payment.isl --impl ./src/payment.ts
Running verification...

ProcessPayment:
  ✓ Precondition: amount > 0 (passed)
  ✓ Precondition: card.valid (passed)
  ✓ Postcondition: payment.charged == amount (passed)
  ✓ Postcondition: order.status == "paid" (passed)

Trust Score: 100%`}
                language="bash"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-20 px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight mb-8 text-center">
            Explore the Documentation
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="feature-card p-6 rounded-xl border border-border bg-card group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <link.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                ISL
              </span>
            </div>
            <span className="font-semibold">Intent Specification Language</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground">
              Documentation
            </Link>
            <Link href="/playground" className="hover:text-foreground">
              Playground
            </Link>
            <a
              href="https://github.com/intentos/isl"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
