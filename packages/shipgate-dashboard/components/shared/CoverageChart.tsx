'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TrustScoreChartProps {
  data: { date: string; score: number }[]
}

export function TrustScoreChart({ data }: TrustScoreChartProps) {
  const formattedData = data.map(d => ({
    ...d,
    score: d.score * 100,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trust Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217.2, 91.2%, 59.8%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217.2, 91.2%, 59.8%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(215, 20.2%, 65.1%)' }}
              />
              <YAxis 
                domain={[0, 100]} 
                className="text-xs"
                tick={{ fill: 'hsl(215, 20.2%, 65.1%)' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222.2, 84%, 4.9%)',
                  border: '1px solid hsl(217.2, 32.6%, 17.5%)',
                  borderRadius: '6px',
                }}
                formatter={((value: any) => [`${(value ?? 0).toFixed(1)}%`, 'Trust Score']) as any}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(217.2, 91.2%, 59.8%)"
                fillOpacity={1}
                fill="url(#colorScore)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface CoverageBreakdownProps {
  coverage: {
    behaviors: number
    totalBehaviors: number
    preconditions: number
    totalPreconditions: number
    postconditions: number
    totalPostconditions: number
  }
}

export function CoverageBreakdown({ coverage }: CoverageBreakdownProps) {
  const data = [
    {
      name: 'Behaviors',
      covered: coverage.behaviors,
      total: coverage.totalBehaviors,
      percentage: (coverage.behaviors / coverage.totalBehaviors) * 100,
    },
    {
      name: 'Preconditions',
      covered: coverage.preconditions,
      total: coverage.totalPreconditions,
      percentage: (coverage.preconditions / coverage.totalPreconditions) * 100,
    },
    {
      name: 'Postconditions',
      covered: coverage.postconditions,
      total: coverage.totalPostconditions,
      percentage: (coverage.postconditions / coverage.totalPostconditions) * 100,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coverage Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                type="number" 
                domain={[0, 100]} 
                tick={{ fill: 'hsl(215, 20.2%, 65.1%)' }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100}
                tick={{ fill: 'hsl(215, 20.2%, 65.1%)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222.2, 84%, 4.9%)',
                  border: '1px solid hsl(217.2, 32.6%, 17.5%)',
                  borderRadius: '6px',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, _name: any, entry: any) => {
                  const item = entry.payload
                  return [`${item.covered}/${item.total} (${(value ?? 0).toFixed(1)}%)`, 'Coverage']
                }) as any}
              />
              <Bar 
                dataKey="percentage" 
                fill="hsl(217.2, 91.2%, 59.8%)" 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

interface DomainStatusChartProps {
  passing: number
  failing: number
  pending: number
}

export function DomainStatusChart({ passing, failing, pending }: DomainStatusChartProps) {
  const data = [
    { name: 'Passing', value: passing, color: 'hsl(142.1, 70.6%, 45.3%)' },
    { name: 'Failing', value: failing, color: 'hsl(0, 62.8%, 50%)' },
    { name: 'Pending', value: pending, color: 'hsl(217.2, 91.2%, 59.8%)' },
  ].filter(d => d.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Domain Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222.2, 84%, 4.9%)',
                  border: '1px solid hsl(217.2, 32.6%, 17.5%)',
                  borderRadius: '6px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
