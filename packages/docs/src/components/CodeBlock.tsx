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

  // Simple ISL syntax highlighting
  const highlightISL = (line: string): React.ReactNode => {
    // Keywords
    const keywords = [
      "domain",
      "entity",
      "behavior",
      "type",
      "enum",
      "input",
      "output",
      "preconditions",
      "postconditions",
      "invariants",
      "temporal",
      "security",
      "compliance",
      "actors",
      "errors",
      "lifecycle",
      "scenario",
      "when",
      "then",
      "given",
      "success",
      "failure",
      "implies",
      "version",
      "description",
      "scope",
      "always",
    ];

    const types = [
      "String",
      "Int",
      "Boolean",
      "UUID",
      "Timestamp",
      "Decimal",
      "Email",
      "Password",
    ];

    const modifiers = [
      "immutable",
      "unique",
      "indexed",
      "secret",
      "sensitive",
      "default",
      "positive",
      "optional",
    ];

    // Check if line is a comment
    if (line.trim().startsWith("#")) {
      return <span className="isl-comment">{line}</span>;
    }

    // Build regex patterns
    const keywordPattern = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
    const typePattern = new RegExp(`\\b(${types.join("|")})\\b`, "g");
    const modifierPattern = new RegExp(`\\[(${modifiers.join("|")})[^\\]]*\\]`, "g");
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
      '<span class="isl-keyword">$1</span>'
    );

    // Replace types
    result = result.replace(typePattern, '<span class="isl-type">$1</span>');

    // Replace modifiers
    result = result.replace(
      modifierPattern,
      '<span class="text-isl-cyan">$&</span>'
    );

    // Restore strings with highlighting
    strings.forEach((str, i) => {
      result = result.replace(
        `__STRING_${i}__`,
        `<span class="isl-string">${str}</span>`
      );
    });

    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

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
