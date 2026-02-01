import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Language Reference",
  description: "Complete reference for ISL syntax, types, expressions, and language features.",
};

const sections = [
  {
    title: "Intents",
    href: "/docs/language-reference/intents",
    description: "The core building block. Define pre/post conditions for any operation.",
  },
  {
    title: "Expressions",
    href: "/docs/language-reference/expressions",
    description: "Operators, precedence, and expression syntax.",
  },
  {
    title: "Types",
    href: "/docs/language-reference/types",
    description: "Type system including primitives, collections, and custom types.",
  },
  {
    title: "Scenarios",
    href: "/docs/language-reference/scenarios",
    description: "Given/when/then blocks for BDD-style specifications.",
  },
  {
    title: "Chaos Testing",
    href: "/docs/language-reference/chaos",
    description: "Inject failures and test system resilience.",
  },
  {
    title: "Quantifiers",
    href: "/docs/language-reference/quantifiers",
    description: "forall and exists for collection operations.",
  },
  {
    title: "Built-ins",
    href: "/docs/language-reference/builtins",
    description: "Built-in functions and utilities.",
  },
];

export default function LanguageReferencePage() {
  return (
    <div>
      <h1>Language Reference</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Complete reference for ISL syntax, types, and language features.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        ISL (Intent Specification Language) is a domain-specific language for defining
        behavioral contracts. It&apos;s designed to be readable, precise, and verifiable.
      </p>

      <CodeBlock
        code={`// Basic structure of an ISL file
intent IntentName {
  pre {
    // Preconditions - what must be true before
  }
  
  post {
    // Postconditions - what must be true after  
  }
  
  invariant {
    // Conditions that must always hold
  }
  
  scenario "description" {
    given { /* initial state */ }
    when  { /* action */ }
    then  { /* expected result */ }
  }
  
  chaos {
    inject failure {
      expect /* behavior under failure */
    }
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="syntax-highlights">Syntax Highlights</h2>
      
      <h3>Keywords</h3>
      <p>ISL reserves the following keywords:</p>
      <div className="not-prose">
        <div className="flex flex-wrap gap-2 my-4">
          {["intent", "pre", "post", "invariant", "scenario", "chaos", "given", "when", "then", 
            "inject", "expect", "forall", "exists", "implies", "old", "if", "else", "return"].map((kw) => (
            <code key={kw} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
              {kw}
            </code>
          ))}
        </div>
      </div>

      <h3>Comments</h3>
      <CodeBlock
        code={`// Single-line comment

/* Multi-line
   comment */`}
        language="isl"
      />

      <h3>Identifiers</h3>
      <p>
        Identifiers must start with a letter or underscore, followed by letters,
        digits, or underscores. ISL is case-sensitive.
      </p>

      <h2 id="sections">Reference Sections</h2>
      <div className="not-prose grid gap-3 mt-6">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                {section.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {section.description}
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
