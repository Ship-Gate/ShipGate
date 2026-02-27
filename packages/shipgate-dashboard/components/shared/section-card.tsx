interface SectionCardProps {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionCard({ title, subtitle, extra, children }: SectionCardProps) {
  return (
    <div className="bg-sg-bg1 rounded-[10px] border border-sg-border overflow-hidden">
      <div
        className="flex justify-between items-center py-3 px-[18px] border-b border-sg-border"
      >
        <div>
          <span className="text-[13px] font-semibold text-sg-text0">{title}</span>
          {subtitle && (
            <span className="text-[11px] text-sg-text3 ml-2">{subtitle}</span>
          )}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}
