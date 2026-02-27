import { cn } from "@/lib/utils"

type Verdict = 'pass' | 'fail' | 'partial' | 'skip' | 'error' | 'pending' | 'unknown'

interface VerdictBadgeProps {
  verdict: Verdict
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const verdictConfig: Record<Verdict, { label: string; className: string; icon: string }> = {
  pass: {
    label: 'Passed',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: '✓',
  },
  fail: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: '✗',
  },
  partial: {
    label: 'Partial',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '◐',
  },
  skip: {
    label: 'Skipped',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '○',
  },
  error: {
    label: 'Error',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '!',
  },
  pending: {
    label: 'Pending',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '●',
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: '?',
  },
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

export function VerdictBadge({ verdict, size = 'md', showIcon = true }: VerdictBadgeProps) {
  const config = verdictConfig[verdict] || verdictConfig.unknown
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full border',
        config.className,
        sizeClasses[size]
      )}
    >
      {showIcon && <span className="font-bold">{config.icon}</span>}
      {config.label}
    </span>
  )
}

export function VerdictDot({ verdict }: { verdict: Verdict }) {
  const colorClasses: Record<Verdict, string> = {
    pass: 'bg-green-500',
    fail: 'bg-red-500',
    partial: 'bg-yellow-500',
    skip: 'bg-gray-400',
    error: 'bg-orange-500',
    pending: 'bg-blue-500',
    unknown: 'bg-gray-300',
  }

  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full',
        colorClasses[verdict] || colorClasses.unknown
      )}
    />
  )
}
