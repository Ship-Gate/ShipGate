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
} from "lucide-react";

const heroExample = `domain PaymentProcessing {
  entity Payment {
    id: UUID [immutable, unique]
    amount: Decimal [positive]
    status: PaymentStatus
    
    invariants {
      amount > 0
      status == COMPLETED implies captured_at != null
    }
  }

  behavior ProcessPayment {
    input {
      amount: Decimal
      card_token: String [sensitive]
    }

    postconditions {
      success implies {
        - Payment.status == COMPLETED
        - Payment.amount == input.amount
      }
    }

    temporal {
      - within 3s (p99): response returned
    }
  }
}`;

const features = [
  {
    icon: Shield,
    title: "Behavioral Contracts",
    description:
      "Define what your software must do, not how. ISL captures intent as verifiable specifications.",
  },
  {
    icon: Zap,
    title: "Runtime Verification",
    description:
      "Automatically generate tests from specs. Verify your implementation matches your intent.",
  },
  {
    icon: FileCode,
    title: "Type Generation",
    description:
      "Generate TypeScript types, API schemas, and documentation from a single source of truth.",
  },
  {
    icon: TestTube,
    title: "Chaos Testing",
    description:
      "Built-in support for chaos engineering. Test how your system behaves under failure conditions.",
  },
];

const quickLinks = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Install ISL and write your first specification",
    href: "/docs/getting-started",
  },
  {
    icon: FileCode,
    title: "Language Reference",
    description: "Complete guide to ISL syntax and features",
    href: "/docs/language",
  },
  {
    icon: Terminal,
    title: "CLI Reference",
    description: "All commands and options for the ISL CLI",
    href: "/docs/cli",
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
                v1.0 Now Available
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                Intent Specification
                <br />
                <span className="text-primary">Language</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-lg">
                Define behavioral contracts that guarantee your software does
                what you intend. Write specs, generate types, verify
                implementations.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/docs/getting-started"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/playground"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Try in Playground
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

      {/* Features Section */}
      <section className="py-20 px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Why ISL?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Stop writing tests that miss edge cases. Define your intent once
              and let ISL ensure your code matches.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="feature-card p-6 rounded-xl border border-border bg-card"
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

      {/* Quick Example Section */}
      <section className="py-20 px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Write Once, Verify Everywhere
              </h2>
              <p className="text-muted-foreground mb-6">
                ISL specifications are your single source of truth. From one
                spec file, generate:
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <span className="text-isl-green text-sm">✓</span>
                  </div>
                  <span>TypeScript types and interfaces</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <span className="text-isl-green text-sm">✓</span>
                  </div>
                  <span>Runtime validation tests</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <span className="text-isl-green text-sm">✓</span>
                  </div>
                  <span>API documentation</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-isl-green/20 flex items-center justify-center">
                    <span className="text-isl-green text-sm">✓</span>
                  </div>
                  <span>Chaos test scenarios</span>
                </li>
              </ul>
              <Link
                href="/docs/getting-started"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Learn more about code generation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="space-y-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Terminal
              </div>
              <CodeBlock
                code={`$ isl check auth.isl
✓ Parsed successfully
✓ Type checking passed
✓ 4 entities, 6 behaviors found

$ isl generate types auth.isl -o ./src/types
Generated 12 TypeScript interfaces
Generated 6 API schemas

$ isl verify auth.isl --runtime
Running 47 generated tests...
✓ All postconditions verified
✓ All invariants hold
Trust Score: 94.2%`}
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
