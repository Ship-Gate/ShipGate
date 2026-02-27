'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useCodeSync } from '@/hooks/useCodeSync';

export function CodePreview() {
  const { islCode } = useCodeSync();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(islCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-accent">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          ISL Preview
        </h2>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-accent rounded transition-colors"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <pre className="code-preview text-xs leading-relaxed">
          <code dangerouslySetInnerHTML={{ __html: highlightISL(islCode) }} />
        </pre>
      </div>
    </div>
  );
}

function highlightISL(code: string): string {
  // Simple syntax highlighting
  let highlighted = code
    // Keywords
    .replace(
      /\b(domain|entity|behavior|type|invariant|policy|input|output|pre|post|error|lifecycle|temporal|security)\b/g,
      '<span class="keyword">$1</span>'
    )
    // Types
    .replace(
      /\b(String|Int|Boolean|UUID|Timestamp|Decimal|Duration|List|Map|Optional)\b/g,
      '<span class="type">$1</span>'
    )
    // Strings
    .replace(
      /"([^"\\]|\\.)*"/g,
      '<span class="string">$&</span>'
    )
    // Numbers
    .replace(
      /\b(\d+(\.\d+)?)\b/g,
      '<span class="number">$1</span>'
    )
    // Comments
    .replace(
      /(\/\/.*$)/gm,
      '<span class="comment">$1</span>'
    )
    // Annotations
    .replace(
      /(@\w+)/g,
      '<span class="keyword">$1</span>'
    );

  return highlighted;
}
