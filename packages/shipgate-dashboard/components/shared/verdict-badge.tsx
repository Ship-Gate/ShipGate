import type { Verdict } from '@/types';

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: 'sm' | 'md';
}

export function VerdictBadge({ verdict, size = 'md' }: VerdictBadgeProps) {
  const colors = {
    SHIP: {
      bg: 'rgba(0,230,138,0.08)',
      border: 'rgba(0,230,138,0.2)',
      text: '#00e68a'
    },
    WARN: {
      bg: 'rgba(255,181,71,0.08)',
      border: 'rgba(255,181,71,0.2)',
      text: '#ffb547'
    },
    NO_SHIP: {
      bg: 'rgba(255,92,106,0.08)',
      border: 'rgba(255,92,106,0.2)',
      text: '#ff5c6a'
    }
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-1',
    md: 'text-[11px] px-3 py-1.5'
  };

  const style = colors[verdict];

  return (
    <span 
      className={`${sizes[size]} font-mono font-semibold rounded-badge border`}
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text
      }}
    >
      {verdict}
    </span>
  );
}
