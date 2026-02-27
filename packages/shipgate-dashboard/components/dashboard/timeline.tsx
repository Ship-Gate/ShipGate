import { SectionCard } from '@/components/shared/section-card';
import { timelineEvents } from '@/lib/mock-data';

const TYPE_COLOR: Record<string, string> = {
  ship: '#00e68a',
  noship: '#ff5c6a',
  deploy: '#6366f1',
  running: '#38bdf8',
  fix: '#00e68a',
  alert: '#ffb547',
};

const TYPE_ICON: Record<string, string> = {
  ship: '✓',
  noship: '✗',
  deploy: '▲',
  running: '◎',
  fix: '⚡',
  alert: '!',
};

export function Timeline() {
  return (
    <SectionCard title="Activity Timeline" subtitle="All events">
      <div className="py-1">
        {timelineEvents.map((ev, i) => (
          <div
            key={ev.id}
            className="flex gap-3 py-2 px-[18px] relative"
          >
            {i < timelineEvents.length - 1 && (
              <div
                className="absolute left-[27px] top-7 -bottom-2 w-px bg-sg-border"
                aria-hidden
              />
            )}
            <div
              className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold relative z-10"
              style={{
                color: TYPE_COLOR[ev.type] ?? '#555566',
                background: `${TYPE_COLOR[ev.type] ?? '#555566'}12`,
                border: `1px solid ${TYPE_COLOR[ev.type] ?? '#555566'}25`,
              }}
            >
              {TYPE_ICON[ev.type] ?? '•'}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-xs text-sg-text1 leading-snug">
                {ev.message}
              </div>
              <div className="text-[10px] text-sg-text3 mt-0.5">
                {ev.detail} • {ev.author} • {ev.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
