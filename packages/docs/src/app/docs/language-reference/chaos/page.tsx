import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "Chaos Testing",
  description: "Built-in chaos testing capabilities in ISL for testing system resilience.",
};

export default function ChaosPage() {
  return (
    <div>
      <h1>Chaos Testing</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Test how your system behaves under failure conditions.
      </p>

      <h2 id="overview">Overview</h2>
      <p>
        ISL includes built-in support for chaos engineering. Define failure
        scenarios and verify your system handles them gracefully.
      </p>

      <CodeBlock
        code={`intent ProcessPayment {
  pre { ... }
  post { ... }
  
  chaos {
    inject payment_gateway.timeout(5s) {
      expect retry.attempted(3)
      expect result.error == "GATEWAY_TIMEOUT"
      expect no_duplicate_charges
    }
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="inject-block">The <code>inject</code> Block</h2>
      <p>
        Inject specific failures into your system:
      </p>

      <CodeBlock
        code={`chaos {
  // Network failures
  inject network.timeout(duration) { ... }
  inject network.partition { ... }
  inject network.latency(500ms) { ... }
  
  // Service failures
  inject service.unavailable { ... }
  inject service.error(500) { ... }
  inject service.slow_response(2s) { ... }
  
  // Database failures
  inject database.connection_lost { ... }
  inject database.deadlock { ... }
  inject database.constraint_violation { ... }
  
  // Resource exhaustion
  inject memory.exhausted { ... }
  inject disk.full { ... }
  inject cpu.overloaded { ... }
}`}
        language="isl"
      />

      <h2 id="expect-block">The <code>expect</code> Block</h2>
      <p>
        Define expected behavior when failures occur:
      </p>

      <CodeBlock
        code={`inject database.connection_lost {
  // Retry behavior
  expect retry.attempted(3)
  expect retry.backoff == "exponential"
  
  // Error handling
  expect error.type == "DATABASE_UNAVAILABLE"
  expect error.retryable == true
  
  // State protection
  expect no_partial_writes
  expect transaction.rolled_back
  
  // Circuit breaker
  expect circuit_breaker.opened
  expect fallback.activated
}`}
        language="isl"
      />

      <h2 id="common-patterns">Common Patterns</h2>

      <h3>Timeout Handling</h3>
      <CodeBlock
        code={`intent FetchUserData {
  chaos {
    inject api.timeout(30s) {
      expect timeout_error.returned within 35s
      expect partial_data.not_cached
      expect user.notified("Service temporarily unavailable")
    }
  }
}`}
        language="isl"
      />

      <h3>Retry Logic</h3>
      <CodeBlock
        code={`intent SendNotification {
  chaos {
    inject notification_service.error(503) {
      expect retry.count == 3
      expect retry.delays == [1s, 2s, 4s]  // Exponential backoff
      expect final_error == "NOTIFICATION_FAILED"
      expect notification.queued_for_retry
    }
  }
}`}
        language="isl"
      />

      <h3>Circuit Breaker</h3>
      <CodeBlock
        code={`intent CallExternalAPI {
  chaos {
    inject external_api.failures(5) {
      expect circuit_breaker.state == "open"
      expect subsequent_calls.fail_fast
      expect no_requests_to_api
    }
    
    inject external_api.recovery after circuit_breaker.open {
      expect circuit_breaker.state == "half_open"
      expect probe_request.sent
      expect circuit_breaker.state == "closed" after success
    }
  }
}`}
        language="isl"
      />

      <h3>Data Consistency</h3>
      <CodeBlock
        code={`intent TransferFunds {
  chaos {
    inject failure.after(debit) before(credit) {
      expect transaction.rolled_back
      expect source.balance == old(source.balance)
      expect target.balance == old(target.balance)
      expect audit_log.contains("ROLLBACK")
    }
  }
}`}
        language="isl"
      />

      <Callout type="warning" title="Important">
        Chaos tests run in isolated environments. They never affect production
        data or real external services.
      </Callout>

      <h2 id="advanced-injections">Advanced Injections</h2>

      <h3>Partial Failures</h3>
      <CodeBlock
        code={`inject batch_operation.partial_failure(
  success_rate: 0.7,
  random_seed: 42
) {
  expect failed_items.count == 3
  expect successful_items.count == 7
  expect retry_queue.contains(failed_items)
}`}
        language="isl"
      />

      <h3>Cascading Failures</h3>
      <CodeBlock
        code={`inject cascade {
  service_a.fails
  then service_b.overloaded
  then service_c.timeout
} {
  expect system.degraded_gracefully
  expect critical_paths.maintained
  expect user.sees("Limited functionality")
}`}
        language="isl"
      />

      <h3>Time-based Failures</h3>
      <CodeBlock
        code={`inject intermittent.failure(
  probability: 0.1,
  duration: 60s
) {
  expect retry_success_rate > 0.9
  expect user_experience.unaffected
}`}
        language="isl"
      />

      <h2 id="chaos-metrics">Chaos Metrics</h2>
      <p>
        Chaos tests generate metrics you can assert against:
      </p>

      <CodeBlock
        code={`chaos {
  inject load.spike(10x) {
    expect response_time.p99 < 500ms
    expect error_rate < 0.01
    expect autoscaling.triggered
    expect alerts.fired("HIGH_LOAD")
  }
  
  metrics {
    assert availability > 99.9%
    assert mean_time_to_recovery < 30s
    assert data_loss == 0
  }
}`}
        language="isl"
      />
    </div>
  );
}
