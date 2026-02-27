import type { RunStatus } from '@/lib/types';
import { verdictColor } from '@/lib/verdict-helpers';

interface StatusDotProps {
  status: RunStatus;
  size?: number;
}

export function StatusDot({ status, size = 8 }: StatusDotProps) {
  const color = verdictColor(status);

  return (
    <span className="relative inline-flex">
      <span
        className="rounded-full shrink-0"
        style={{
          width: size,
          height: size,
          background: color,
        }}
      />
      {status === 'running' && (
        <span
          className="absolute -inset-0.5 rounded-full animate-ping-ring border-[1.5px]"
          style={{
            borderColor: color,
            opacity: 0,
          }}
        />
      )}
    </span>
  );
}
