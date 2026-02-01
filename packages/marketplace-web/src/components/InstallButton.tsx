"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Terminal, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallButtonProps {
  intentName: string;
  version?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  showCopyCommand?: boolean;
}

export function InstallButton({
  intentName,
  version,
  variant = "default",
  size = "md",
  showCopyCommand = true,
}: InstallButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showCommand, setShowCommand] = useState(false);

  const installCommand = version
    ? `isl install ${intentName}@${version}`
    : `isl install ${intentName}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [installCommand]);

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-base",
    lg: "h-12 px-6 text-lg",
  };

  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-primary text-primary hover:bg-primary/10",
    ghost: "text-primary hover:bg-primary/10",
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowCommand(!showCommand)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
          sizeClasses[size],
          variantClasses[variant]
        )}
      >
        <Download className="h-4 w-4" />
        Install
      </button>

      {showCopyCommand && showCommand && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm">
          <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
          <code className="flex-1 overflow-x-auto">{installCommand}</code>
          <button
            onClick={handleCopy}
            className="shrink-0 p-1.5 rounded hover:bg-background transition-colors"
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-trust-verified" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [command]);

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-sm group">
      <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
      <code className="flex-1 overflow-x-auto">{command}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1.5 rounded hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-trust-verified" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
