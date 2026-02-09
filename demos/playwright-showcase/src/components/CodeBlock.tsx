import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  highlightLines?: number[];
  animated?: boolean;
}

export default function CodeBlock({
  code,
  language = 'typescript',
  title,
  highlightLines = [],
  animated = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const content = (
    <div className="glass-card overflow-hidden" data-testid="code-block">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/20 bg-white/10">
          <span className="text-sm font-medium text-white/90">{title}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            data-testid="copy-code"
          >
            {copied ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <Copy size={16} className="text-white/60" />
            )}
          </button>
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.6)',
          fontSize: '0.875rem',
        }}
        wrapLines
        lineProps={(lineNumber) => ({
          style: {
            backgroundColor: highlightLines.includes(lineNumber)
              ? 'rgba(14, 165, 233, 0.1)'
              : 'transparent',
            display: 'block',
            width: '100%',
          },
        })}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}
