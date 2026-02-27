import { summaryCards } from '@/lib/mock-data';

export function SummaryStrip() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
      {summaryCards.map((s, i) => (
        <div
          key={i}
          className="bg-sg-bg1 rounded-lg py-3 px-3.5 border border-sg-border relative overflow-hidden"
        >
          <div
            className="absolute -top-1.5 -right-1.5 w-9 h-9 rounded-full blur-[18px] opacity-10"
            style={{ background: s.color }}
          />
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] text-sg-text3 uppercase tracking-wider">
              {s.label}
            </span>
            <span className="text-[11px]" style={{ color: s.color }}>
              {s.icon}
            </span>
          </div>
          <div className="text-xl font-bold text-sg-text0 font-mono tracking-tight">
            {s.value}
          </div>
          <div className="text-[9px] mt-0.5" style={{ color: s.color }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
