import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/shared/badge';
import { StatusDot } from '@/components/shared/status-dot';
import { pullRequests } from '@/lib/mock-data';
import { verdictColor, verdictBg } from '@/lib/verdict-helpers';

export function PrMonitor() {
  return (
    <SectionCard
      title="Open Pull Requests"
      subtitle="acme-api"
      extra={<Badge text="3 open" color="#6366f1" bg="rgba(99,102,241,0.08)" />}
    >
      {pullRequests.map((pr) => (
        <div
          key={pr.number}
          className="py-3 px-[18px] border-b border-sg-border last:border-b-0"
        >
          <div className="flex items-start gap-2.5 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-sg-text0 mb-0.5">
                {pr.title}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-sg-text3">
                <span className="text-sg-accent font-mono">#{pr.number}</span>
                <span>•</span>
                <span>{pr.author}</span>
                <span>•</span>
                <span>{pr.filesChanged} files</span>
                <span>•</span>
                <span>{pr.opened}</span>
              </div>
            </div>
            {pr.verdict ? (
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  text={pr.verdict}
                  color={verdictColor(pr.verdict)}
                  bg={verdictBg(pr.verdict)}
                />
                <span
                  className="text-[13px] font-bold font-mono"
                  style={{ color: verdictColor(pr.verdict) }}
                >
                  {pr.score}
                </span>
              </div>
            ) : (
              <Badge
                text="Scanning..."
                color="#38bdf8"
                bg="rgba(56,189,248,0.08)"
              />
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {pr.checks.map((ck) => (
              <div
                key={ck.name}
                className="flex items-center gap-1 py-0.5 px-2 rounded border border-sg-border"
                style={{ background: '#1a1a24' }}
              >
                <StatusDot
                  status={
                    ck.status === 'pass'
                      ? 'success'
                      : ck.status === 'fail'
                        ? 'failure'
                        : ck.status
                  }
                  size={6}
                />
                <span
                  className={`text-[9px] ${
                    ck.status === 'pass'
                      ? 'text-sg-text2'
                      : ck.status === 'fail'
                        ? 'text-sg-noship'
                        : 'text-sg-text3'
                  }`}
                >
                  {ck.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
