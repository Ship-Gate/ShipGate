import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Temporal Properties - ISL Documentation",
  description: "Verify timing and performance requirements.",
};

export default function TemporalPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Temporal Properties</h1>

        <p className="lead text-xl text-muted-foreground">
          Temporal verification ensures your system meets timing requirements 
          including response times, SLAs, and eventual consistency guarantees.
        </p>

        <h2>Defining Temporal Properties</h2>

        <CodeBlock
          code={`behavior ProcessPayment {
  temporal {
    # Response time percentiles
    - within 100ms (p50): response returned
    - within 500ms (p95): response returned
    - within 2s (p99): response returned
    
    # Eventual consistency
    - eventually within 5s: transaction logged
    - eventually within 30s: receipt email sent
    - eventually within 1h: analytics updated
    
    # Ordering constraints
    - immediately: payment captured
    - before response: audit log written
  }
}`}
          language="isl"
        />

        <h2>Running Temporal Verification</h2>

        <CodeBlock
          code={`$ isl verify specs/payments.isl --temporal

Temporal Verification
=====================

Behavior: ProcessPayment (1000 samples)
  Response Times:
    p50:  45ms  ✓ (target: 100ms)
    p95: 312ms  ✓ (target: 500ms)
    p99: 1.8s   ✓ (target: 2s)
  
  Eventual Properties:
    ✓ transaction logged within 5s (avg: 1.2s)
    ✓ receipt email sent within 30s (avg: 8.4s)
    ⚠ analytics updated within 1h (actual: 1h 12m)
  
  Ordering:
    ✓ payment captured immediately
    ✓ audit log written before response

Behavior: GetPaymentStatus (1000 samples)
  Response Times:
    p50:  12ms  ✓ (target: 50ms)
    p95:  34ms  ✓ (target: 100ms)
    p99:  89ms  ✓ (target: 200ms)

Summary: 10/11 temporal properties verified`}
          language="bash"
        />

        <h2>Percentile Requirements</h2>

        <p>
          Define performance SLAs using percentile targets:
        </p>

        <CodeBlock
          code={`temporal {
  # Standard percentiles
  - within 50ms (p50): response returned
  - within 100ms (p90): response returned
  - within 200ms (p95): response returned
  - within 500ms (p99): response returned
  - within 2s (p99.9): response returned
  
  # Custom percentile
  - within 1s (p99.99): response returned
}`}
          language="isl"
        />

        <h2>Eventual Consistency</h2>

        <p>
          Verify that asynchronous operations complete within expected timeframes:
        </p>

        <CodeBlock
          code={`temporal {
  # Cache invalidation
  - eventually within 5s: cache invalidated
  
  # Search indexing
  - eventually within 30s: search index updated
  
  # Replication
  - eventually within 1m: replicas synchronized
  
  # Notifications
  - eventually within 5m: webhook delivered
  - eventually within 1h: daily digest sent
}`}
          language="isl"
        />

        <h2>Ordering Constraints</h2>

        <CodeBlock
          code={`temporal {
  # Must happen before response
  - before response: audit log written
  - before response: metrics recorded
  
  # Must happen immediately (synchronously)
  - immediately: payment captured
  - immediately: inventory reserved
  
  # Ordering between events
  - payment.captured before receipt.sent
  - order.confirmed before shipping.scheduled
}`}
          language="isl"
        />

        <h2>Load Testing</h2>

        <p>
          Verify temporal properties under load:
        </p>

        <CodeBlock
          code={`$ isl verify specs/ --temporal --load

Load Test Configuration:
  Duration: 5 minutes
  Ramp up: 30 seconds
  Target RPS: 1000
  
Starting load test...

Results:
  Requests: 287,342
  Success rate: 99.7%
  Errors: 861
  
Response Time Distribution:
  p50:   52ms  ✓
  p90:  145ms  ✓
  p95:  234ms  ✓
  p99:  567ms  ✓
  p99.9: 1.2s  ⚠ (target: 1s)
  
Throughput:
  Avg: 957 req/s
  Peak: 1,124 req/s
  
Temporal Properties:
  10/11 verified under load
  
  Failed:
  - p99.9 response time exceeded (1.2s > 1s)`}
          language="bash"
        />

        <h2>Latency Breakdown</h2>

        <p>
          Get detailed timing analysis:
        </p>

        <CodeBlock
          code={`$ isl verify specs/payments.isl --temporal --breakdown

ProcessPayment Latency Breakdown
================================

Total p99: 567ms

Components:
  ├─ Input validation:     5ms  (1%)
  ├─ Database lookup:     45ms  (8%)
  ├─ Payment processor:  450ms (79%)
  │   ├─ Network RTT:    120ms
  │   └─ Processing:     330ms
  ├─ Audit logging:       12ms  (2%)
  └─ Response encoding:    3ms  (1%)

Bottleneck: Payment processor (79% of latency)
Recommendation: Consider caching, connection pooling, 
or switching to a faster payment processor.`}
          language="bash"
        />

        <h2>Timeline Verification</h2>

        <p>
          Verify event ordering in distributed systems:
        </p>

        <CodeBlock
          code={`$ isl verify specs/order.isl --temporal --timeline

Order Processing Timeline
=========================

Expected:
  1. order.created
  2. payment.authorized
  3. inventory.reserved
  4. order.confirmed
  5. receipt.sent (async)
  
Sample 1: ✓
  10:00:00.000 order.created
  10:00:00.234 payment.authorized
  10:00:00.456 inventory.reserved
  10:00:00.567 order.confirmed
  10:00:03.123 receipt.sent

Sample 2: ✗ ORDERING VIOLATION
  10:00:00.000 order.created
  10:00:00.234 payment.authorized
  10:00:00.456 order.confirmed  ← Before inventory.reserved!
  10:00:00.567 inventory.reserved
  
  Error: order.confirmed occurred before inventory.reserved`}
          language="bash"
        />

        <h2>Monitoring Integration</h2>

        <CodeBlock
          code={`// temporal-monitoring.ts
import { TemporalMonitor } from '@intentos/temporal';

const monitor = new TemporalMonitor({
  behaviors: ['ProcessPayment', 'CreateOrder'],
  percentiles: [50, 95, 99, 99.9],
  
  // Export to monitoring systems
  exporters: [
    new PrometheusExporter({ port: 9090 }),
    new DatadogExporter({ apiKey: process.env.DD_API_KEY })
  ],
  
  // Alert on SLA violations
  alerts: {
    'ProcessPayment.p99 > 2s': {
      severity: 'warning',
      notify: ['oncall@example.com']
    },
    'ProcessPayment.p99.9 > 5s': {
      severity: 'critical',
      notify: ['oncall@example.com', 'pagerduty']
    }
  }
});

// Start monitoring
monitor.start();`}
          language="typescript"
        />
      </div>
    </div>
  );
}
