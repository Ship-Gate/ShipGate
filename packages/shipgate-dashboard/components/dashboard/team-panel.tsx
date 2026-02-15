import { SectionCard } from '@/components/shared/section-card';
import { teamMembers } from '@/lib/mock-data';

function avatarBorderColor(shipRate: number): string {
  if (shipRate >= 90) return 'rgba(0,230,138,0.3)';
  if (shipRate >= 80) return 'rgba(255,181,71,0.3)';
  return 'rgba(255,92,106,0.3)';
}

function shipRateColor(shipRate: number): string {
  if (shipRate >= 90) return '#00e68a';
  if (shipRate >= 80) return '#ffb547';
  return '#ff5c6a';
}

export function TeamPanel() {
  return (
    <SectionCard
      title="Team"
      subtitle="Ship rates & patterns"
      extra={
        <span className="text-[11px] text-sg-ship font-semibold">86% avg</span>
      }
    >
      {teamMembers.map((m) => (
        <div
          key={m.name}
          className="flex items-center gap-3 py-2.5 px-[18px] border-b border-sg-border"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold text-sg-text1 shrink-0"
            style={{
              background: '#222233',
              border: `2px solid ${avatarBorderColor(m.shipRate)}`,
            }}
          >
            {m.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-sg-text0">
                {m.name}
              </span>
              <span className="text-[10px] text-sg-text3">{m.role}</span>
              <span
                className="ml-auto text-[9px] py-0.5 px-1 rounded-[3px] shrink-0"
                style={{
                  background: 'rgba(0,230,138,0.08)',
                  color: '#00e68a',
                }}
              >
                🔥 {m.streak}d streak
              </span>
            </div>
            <div className="flex gap-3 text-[10px] text-sg-text3 mt-0.5">
              <span>
                <strong className="text-sg-text1">{m.scans}</strong> scans
              </span>
              <span>
                <strong style={{ color: shipRateColor(m.shipRate) }}>
                  {m.shipRate}%
                </strong>{' '}
                ship rate
              </span>
              <span>
                Top issue:{' '}
                <strong className="text-sg-text2">{m.topIssue}</strong>
              </span>
            </div>
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
