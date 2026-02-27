'use client'

import { cn } from '@/lib/utils'
import { formatDate, formatDuration } from '@/lib/utils'
import { VerdictBadge, VerdictDot } from '@/components/shared/VerdictBadge'
interface ConditionResult {
  condition: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

interface TestResult {
  name: string;
  verdict: 'pass' | 'fail' | 'skip' | 'error';
  duration: number;
  message?: string;
  preconditionResults: ConditionResult[];
  postconditionResults: ConditionResult[];
}

interface BehaviorResult {
  behaviorId: string;
  behaviorName: string;
  verdict: 'pass' | 'fail' | 'partial' | 'skip' | 'error';
  duration: number;
  tests: TestResult[];
}

interface TimelineProps {
  results: BehaviorResult[]
}

export function Timeline({ results }: TimelineProps) {
  return (
    <div className="space-y-4">
      {results.map((behavior, idx) => (
        <BehaviorTimelineItem key={behavior.behaviorId} behavior={behavior} isLast={idx === results.length - 1} />
      ))}
    </div>
  )
}

interface BehaviorTimelineItemProps {
  behavior: BehaviorResult
  isLast: boolean
}

function BehaviorTimelineItem({ behavior, isLast }: BehaviorTimelineItemProps) {
  return (
    <div className="relative">
      <div className={cn(
        "absolute left-3 top-8 w-0.5 bg-border",
        isLast ? "h-0" : "h-[calc(100%-1rem)]"
      )} />
      
      <div className="flex gap-4">
        <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background">
          <VerdictDot verdict={behavior.verdict} />
        </div>
        
        <div className="flex-1 space-y-3 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{behavior.behaviorName}</h4>
              <VerdictBadge verdict={behavior.verdict} size="sm" />
            </div>
            <span className="text-sm text-muted-foreground">
              {formatDuration(behavior.duration)}
            </span>
          </div>
          
          <div className="space-y-2">
            {behavior.tests.map((test, idx) => (
              <TestTimelineItem key={idx} test={test} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TestTimelineItemProps {
  test: TestResult
}

function TestTimelineItem({ test }: TestTimelineItemProps) {
  const hasFailedConditions = 
    test.preconditionResults.some(c => !c.passed) ||
    test.postconditionResults.some(c => !c.passed)

  return (
    <div className={cn(
      "rounded-lg border p-3",
      test.verdict === 'fail' && "border-red-200 bg-red-50",
      test.verdict === 'pass' && "border-green-200 bg-green-50",
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <VerdictDot verdict={test.verdict} />
          <span className="text-sm font-medium">{test.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDuration(test.duration)}
        </span>
      </div>

      {test.message && (
        <p className="text-sm text-red-600 mb-2 font-mono bg-red-100 p-2 rounded">
          {test.message}
        </p>
      )}

      {(test.preconditionResults.length > 0 || test.postconditionResults.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mt-2">
          {test.preconditionResults.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Preconditions</h5>
              <div className="space-y-1">
                {test.preconditionResults.map((condition, idx) => (
                  <ConditionItem key={idx} condition={condition} />
                ))}
              </div>
            </div>
          )}
          
          {test.postconditionResults.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Postconditions</h5>
              <div className="space-y-1">
                {test.postconditionResults.map((condition, idx) => (
                  <ConditionItem key={idx} condition={condition} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ConditionItemProps {
  condition: ConditionResult
}

function ConditionItem({ condition }: ConditionItemProps) {
  return (
    <div className={cn(
      "flex items-start gap-2 text-xs p-1.5 rounded",
      condition.passed ? "bg-green-100/50" : "bg-red-100/50"
    )}>
      <span className={cn(
        "font-bold",
        condition.passed ? "text-green-600" : "text-red-600"
      )}>
        {condition.passed ? '✓' : '✗'}
      </span>
      <div className="flex-1">
        <p className={cn(
          condition.passed ? "text-green-800" : "text-red-800"
        )}>
          {condition.condition}
        </p>
        {!condition.passed && condition.expected && condition.actual && (
          <div className="mt-1 font-mono text-red-700">
            <p>Expected: {condition.expected}</p>
            <p>Actual: {condition.actual}</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface VerificationTimelineProps {
  verifications: { id: string; timestamp: string; verdict: 'pass' | 'fail' | 'partial' | 'error'; trustScore: number }[]
}

export function VerificationTimeline({ verifications }: VerificationTimelineProps) {
  return (
    <div className="space-y-2">
      {verifications.map((v, idx) => (
        <div 
          key={v.id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <VerdictDot verdict={v.verdict} />
          <div className="flex-1">
            <p className="text-sm">{formatDate(v.timestamp)}</p>
          </div>
          <div className="text-sm font-medium">
            {(v.trustScore * 100).toFixed(0)}%
          </div>
          <VerdictBadge verdict={v.verdict} size="sm" showIcon={false} />
        </div>
      ))}
    </div>
  )
}
