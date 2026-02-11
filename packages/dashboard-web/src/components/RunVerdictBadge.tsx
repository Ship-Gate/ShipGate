import { cn } from '@/lib/utils'

type RunVerdict = 'SHIP' | 'WARN' | 'NO_SHIP'

interface RunVerdictBadgeProps {
  verdict: RunVerdict
  size?: 'sm' | 'md'
}

const config: Record<RunVerdict, { label: string; className: string }> = {
  SHIP: { label: 'Ship', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  WARN: { label: 'Warn', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  NO_SHIP: { label: 'No Ship', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function RunVerdictBadge({ verdict, size = 'md' }: RunVerdictBadgeProps) {
  const { label, className } = config[verdict] ?? config.NO_SHIP
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        className,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
      )}
      role="status"
      aria-label={`Verdict: ${label}`}
    >
      {label}
    </span>
  )
}
