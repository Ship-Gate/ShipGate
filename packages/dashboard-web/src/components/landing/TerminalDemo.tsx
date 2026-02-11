'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { ALL_TERMINAL_LINES, INIT_COMMAND, VERIFY_COMMAND } from '@/data/terminal-content';
import type { TerminalLine } from '@/data/terminal-content';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all duration-200 border border-zinc-700"
      aria-label={`Copy: ${text}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span className="font-mono">{text}</span>
        </>
      )}
    </button>
  );
}

function getLineClassName(type: TerminalLine['type']): string {
  switch (type) {
    case 'command': return 'text-white font-semibold';
    case 'success': return 'text-emerald-400';
    case 'error': return 'text-red-400 font-semibold';
    case 'warning': return 'text-yellow-400 font-semibold';
    case 'info': return 'text-white/70';
    case 'dim': return 'text-white/50';
    case 'divider': return 'text-white/30';
    case 'verdict': return 'text-red-500 font-bold text-base';
    case 'blank': return '';
    default: return 'text-white/80';
  }
}

export default function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: '-200px' });

  const startAnimation = useCallback(() => {
    setVisibleLines(0);
    setIsPlaying(true);
    setHasPlayed(true);

    let lineIndex = 0;

    function showNextLine() {
      if (lineIndex >= ALL_TERMINAL_LINES.length) {
        setIsPlaying(false);
        return;
      }

      const line = ALL_TERMINAL_LINES[lineIndex];
      const delay = line.delay ?? 200;

      setTimeout(() => {
        lineIndex++;
        setVisibleLines(lineIndex);
        showNextLine();
      }, delay);
    }

    showNextLine();
  }, []);

  useEffect(() => {
    if (isInView && !isPlaying && !hasPlayed) {
      startAnimation();
    }
  }, [isInView, isPlaying, hasPlayed, startAnimation]);

  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [visibleLines]);

  const handleReplay = useCallback(() => {
    if (!isPlaying) {
      startAnimation();
    }
  }, [isPlaying, startAnimation]);

  return (
    <motion.section
      id="terminal-demo"
      ref={containerRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="py-24 md:py-32 max-w-4xl mx-auto px-4 scroll-mt-24"
    >
      <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3 text-center">
        Demo
      </p>
      <h2 className="text-3xl md:text-4xl font-semibold text-white mx-auto mb-4 text-center">
        See it work
      </h2>
      <p className="text-zinc-400 text-center mb-8 max-w-2xl mx-auto">
        Watch Shipgate catch fake features, hallucinated APIs, and security blind spots — in real time.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        <CopyButton text={INIT_COMMAND} />
        <CopyButton text={VERIFY_COMMAND} />
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/80 bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-zinc-400 font-mono">Terminal — shipgate verify</span>
          </div>
          <button
            type="button"
            onClick={handleReplay}
            disabled={isPlaying}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Replay animation"
          >
            <RotateCcw className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div
          ref={terminalBodyRef}
          className="p-5 font-mono text-sm leading-relaxed min-h-[320px] max-h-[480px] overflow-y-auto"
        >
          {ALL_TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`${getLineClassName(line.type)} ${line.type === 'blank' ? 'h-4' : ''}`}
            >
              {line.type !== 'blank' && line.text}
            </motion.div>
          ))}

          {isPlaying && (
            <span className="inline-block w-2 h-4 bg-white/80 animate-pulse ml-0.5" />
          )}

          {!hasPlayed && !isPlaying && (
            <div className="flex items-center gap-2 text-white/40">
              <span>$</span>
              <span className="inline-block w-2 h-4 bg-white/50 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
