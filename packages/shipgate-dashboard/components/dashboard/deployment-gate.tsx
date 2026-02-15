import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/shared/badge';
import { Sparkline } from '@/components/shared/sparkline';
import { environments } from '@/lib/mock-data';
import { verdictColor, verdictBg } from '@/lib/verdict-helpers';

const STATUS_ICON: Record<string, string> = {
  protected: '🛡',
  gated: '⚡',
  open: '○',
};

const STATUS_COLOR: Record<string, string> = {
  protected: '#00e68a',
  gated: '#ffb547',
  open: '#555566',
};

export function DeploymentGate() {
  return (
    <SectionCard
      title="Deployment Gates"
      subtitle="Environment rules"
      extra={
        <Badge text="3 environments" color="#8888a0" bg="#1a1a24" />
      }
    >
      {environments.map((env) => (
        <div
          key={env.name}
          className="py-3 px-[18px] border-b border-sg-border last:border-b-0"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-sm">{STATUS_ICON[env.status] ?? '○'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-sg-text0">
                  {env.name}
                </span>
                <span
                  className="text-[9px] py-0.5 px-1.5 rounded-[3px] uppercase font-semibold tracking-wider"
                  style={{
                    color: STATUS_COLOR[env.status],
                    background: `${STATUS_COLOR[env.status]}12`,
                    border: `1px solid ${STATUS_COLOR[env.status]}20`,
                  }}
                >
                  {env.status}
                </span>
              </div>
              <span className="text-[10px] text-sg-text3 font-mono block">
                {env.url}
              </span>
            </div>
            <Sparkline
              data={env.history}
              color={verdictColor(env.lastDeploy.verdict)}
              width={50}
              height={16}
            />
          </div>
          <div
            className="flex items-center gap-2 py-1.5 px-2.5 rounded-[5px] text-[10px] text-sg-text2"
            style={{ background: '#1a1a24' }}
          >
            <span className="text-sg-text3">Last:</span>
            <Badge
              text={env.lastDeploy.verdict}
              color={verdictColor(env.lastDeploy.verdict)}
              bg={verdictBg(env.lastDeploy.verdict)}
            />
            <span className="font-mono text-sg-text3">
              {env.lastDeploy.commit}
            </span>
            <span>•</span>
            <span>{env.lastDeploy.author}</span>
            <span className="ml-auto text-sg-text3">{env.lastDeploy.time}</span>
          </div>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {env.rules.map((r) => (
              <span
                key={r}
                className="text-[9px] py-0.5 px-1.5 rounded-[3px] border border-sg-border"
                style={{ background: '#1a1a24', color: '#555566' }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
