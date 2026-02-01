"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { clsx } from "clsx";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
}

interface CodeTabsProps {
  tabs: { label: string; language: string; code: string }[];
  showLineNumbers?: boolean;
}

// ISL Syntax Highlighting Keywords
const ISL_KEYWORDS = [
  "intent",
  "domain",
  "entity",
  "behavior",
  "type",
  "enum",
  "struct",
  "input",
  "output",
  "pre",
  "post",
  "preconditions",
  "postconditions",
  "invariant",
  "invariants",
  "temporal",
  "security",
  "compliance",
  "actors",
  "errors",
  "lifecycle",
  "scenario",
  "chaos",
  "given",
  "when",
  "then",
  "inject",
  "expect",
  "forall",
  "exists",
  "implies",
  "old",
  "success",
  "failure",
  "result",
  "version",
  "description",
  "scope",
  "always",
  "module",
  "import",
  "export",
  "extends",
  "implements",
];

const ISL_TYPES = [
  "String",
  "Number",
  "Int",
  "Integer",
  "Float",
  "Boolean",
  "Bool",
  "UUID",
  "Timestamp",
  "DateTime",
  "Date",
  "Time",
  "Decimal",
  "Email",
  "Password",
  "URL",
  "JSON",
  "Any",
  "void",
  "never",
  "Array",
  "List",
  "Set",
  "Map",
  "Object",
  "Optional",
  "Result",
];

const ISL_MODIFIERS = [
  "immutable",
  "unique",
  "indexed",
  "secret",
  "sensitive",
  "default",
  "positive",
  "optional",
  "required",
  "nullable",
  "readonly",
  "private",
  "public",
  "internal",
  "async",
  "sync",
];

function highlightISL(line: string): React.ReactNode {
  // Check if line is a comment
  if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
    return <span className="text-muted-foreground italic">{line}</span>;
  }

  // Build regex patterns
  const keywordPattern = new RegExp(`\\b(${ISL_KEYWORDS.join("|")})\\b`, "g");
  const typePattern = new RegExp(`\\b(${ISL_TYPES.join("|")})\\b`, "g");
  const modifierPattern = new RegExp(
    `\\[(${ISL_MODIFIERS.join("|")})[^\\]]*\\]`,
    "g"
  );
  const stringPattern = /"([^"]+)"/g;

  let result = line;

  // Replace strings first (to avoid keyword replacement inside strings)
  const strings: string[] = [];
  result = result.replace(stringPattern, (match) => {
    strings.push(match);
    return `__STRING_${strings.length - 1}__`;
  });

  // Replace keywords
  result = result.replace(
    keywordPattern,
    '<span class="text-isl-purple font-medium">$1</span>'
  );

  // Replace types
  result = result.replace(
    typePattern,
    '<span class="text-isl-blue">$1</span>'
  );

  // Replace modifiers
  result = result.replace(
    modifierPattern,
    '<span class="text-isl-cyan">$&</span>'
  );

  // Restore strings with highlighting
  strings.forEach((str, i) => {
    result = result.replace(
      `__STRING_${i}__`,
      `<span class="text-isl-green">${str}</span>`
    );
  });

  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

export function CodeBlock({
  code,
  language = "isl",
  filename,
  showLineNumbers = false,
  highlightLines = [],
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className="relative group rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      {(filename || language) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            {filename && (
              <span className="text-sm font-mono text-muted-foreground">
                {filename}
              </span>
            )}
            {!filename && language && (
              <span className="text-xs font-mono text-muted-foreground uppercase">
                {language}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-isl-green" />
                <span className="text-isl-green">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 m-0 border-0 bg-transparent">
          <code className="font-mono text-sm leading-relaxed">
            {lines.map((line, i) => (
              <div
                key={i}
                className={clsx(
                  "flex",
                  highlightLines.includes(i + 1) && "bg-primary/10 -mx-4 px-4"
                )}
              >
                {showLineNumbers && (
                  <span className="select-none pr-4 text-muted-foreground/50 text-right min-w-[2.5rem]">
                    {i + 1}
                  </span>
                )}
                <span className="flex-1">
                  {language === "isl" ? highlightISL(line) : line}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

export function CodeTabs({ tabs, showLineNumbers = false }: CodeTabsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tabs[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCode = tabs[activeTab];
  const lines = activeCode.code.split("\n");

  return (
    <div className="relative group rounded-lg border border-border bg-card overflow-hidden my-4">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50">
        <div className="flex">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={clsx(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                i === activeTab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-3 py-1 mr-2 text-xs rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-isl-green" />
              <span className="text-isl-green">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="p-4 m-0 border-0 bg-transparent">
          <code className="font-mono text-sm leading-relaxed">
            {lines.map((line, i) => (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span className="select-none pr-4 text-muted-foreground/50 text-right min-w-[2.5rem]">
                    {i + 1}
                  </span>
                )}
                <span className="flex-1">
                  {activeCode.language === "isl" ? highlightISL(line) : line}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
