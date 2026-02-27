import { SectionCard } from '@/components/shared/section-card';
import { findings } from '@/lib/mock-data';
import { severityColor } from '@/lib/verdict-helpers';

const SEVERITY_COUNTS = [
  { n: 2, label: 'critical', color: '#ff5c6a' },
  { n: 1, label: 'high', color: '#ff8a4c' },
  { n: 2, label: 'medium', color: '#ffb547' },
  { n: 1, label: 'low', color: '#555566' },
];

export function FindingsFeed() {
  return (
    <SectionCard
      title="Active Findings"
      subtitle={`${findings.length} across open PRs`}
      extra={
        <div className="flex gap-1">
          {SEVERITY_COUNTS.map(({ n, label, color }) => (
            <span
              key={label}
              className="text-[9px] py-0.5 px-1.5 rounded-[3px] font-mono"
              style={{
                background: `${color}10`,
                color,
                border: `1px solid ${color}18`,
              }}
            >
              {n} {label}
            </span>
          ))}
        </div>
      }
    >
      {findings.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-2.5 py-2 px-[18px] border-b border-sg-border"
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: severityColor(f.severity),
              boxShadow:
                f.severity === 'critical'
                  ? '0 0 6px rgba(255,92,106,0.6)'
                  : 'none',
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-sg-text1 leading-snug">
              {f.message}
            </div>
            <div className="text-[10px] text-sg-text3 mt-0.5 flex gap-2">
              <span className="font-mono">
                {f.file}:{f.line}
              </span>
              <span>•</span>
              <span>{f.engine}</span>
              <span>•</span>
              <span className="text-sg-accent">{f.pr}</span>
            </div>
          </div>
          {f.fixable && (
            <button
              type="button"
              className="py-0.5 px-2 rounded border text-[9px] font-semibold cursor-pointer hover:opacity-90 transition-opacity shrink-0"
              style={{
                borderColor: 'rgba(0,230,138,0.25)',
                background: 'rgba(0,230,138,0.08)',
                color: '#00e68a',
              }}
            >
              Auto-fix
            </button>
          )}
        </div>
      ))}
    </SectionCard>
  );
}
