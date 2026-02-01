import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Chaos Testing - ISL Documentation",
  description: "Test system behavior under failure conditions.",
};

export default function ChaosPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Chaos Testing</h1>

        <p className="lead text-xl text-muted-foreground">
          Chaos testing verifies that your system behaves correctly under 
          failure conditions like network issues, timeouts, and data corruption.
        </p>

        <h2>Built-in Chaos Scenarios</h2>

        <CodeBlock
          code={`$ isl verify specs/payments.isl --chaos

Chaos Testing
=============

Scenario: Network Failure
  Injecting network failures at 10% rate...
  ✓ ProcessPayment handles network timeout gracefully
  ✓ No double charges on retry
  ✓ Transaction rolled back on failure

Scenario: Database Unavailable
  Simulating database connection failures...
  ✓ Graceful degradation
  ✓ Appropriate error messages
  ✗ Cache fallback not working

Scenario: Slow Dependencies
  Adding 5s latency to external services...
  ✓ Timeouts configured correctly
  ✓ Circuit breaker activates
  ✓ Fallback behavior works

Summary: 8/9 chaos scenarios passed`}
          language="bash"
        />

        <h2>Defining Chaos in ISL</h2>

        <p>
          Specify expected behavior under failure conditions:
        </p>

        <CodeBlock
          code={`behavior ProcessPayment {
  input {
    amount: Decimal
    card_token: String [sensitive]
  }

  output {
    success: Payment
    errors {
      PAYMENT_FAILED { when: "Payment processor rejected" }
      NETWORK_ERROR { when: "Network timeout" }
      SERVICE_UNAVAILABLE { when: "Payment service down" }
    }
  }

  # Chaos testing specifications
  chaos {
    # Network failures
    on network_failure {
      - returns NETWORK_ERROR
      - no charge applied
      - safe to retry
    }
    
    # Timeout handling
    on timeout after 30s {
      - returns SERVICE_UNAVAILABLE
      - check payment status before retry
      - idempotency key prevents double charge
    }
    
    # Partial failure
    on payment_processor_partial_failure {
      - charge may or may not be applied
      - must verify with payment processor
      - return uncertain status to client
    }
  }
}`}
          language="isl"
        />

        <h2>Chaos Injectors</h2>

        <h3>Network Chaos</h3>

        <CodeBlock
          code={`# Inject network failures
$ isl verify specs/ --chaos --inject network

Network Chaos Configuration:
  Failure rate: 10%
  Latency: 100-500ms
  Packet loss: 5%
  
Injecting chaos...`}
          language="bash"
        />

        <h3>Database Chaos</h3>

        <CodeBlock
          code={`# Inject database failures
$ isl verify specs/ --chaos --inject database

Database Chaos Configuration:
  Connection failures: 5%
  Query timeouts: 10%
  Deadlocks: 2%
  
Injecting chaos...`}
          language="bash"
        />

        <h3>Resource Exhaustion</h3>

        <CodeBlock
          code={`# Test under resource pressure
$ isl verify specs/ --chaos --inject resources

Resource Chaos Configuration:
  Memory pressure: 80%
  CPU throttling: 50%
  Disk I/O limits: enabled
  
Injecting chaos...`}
          language="bash"
        />

        <h2>Chaos Scenarios</h2>

        <CodeBlock
          code={`chaos_scenarios "Payment Processing" {
  scenario "Payment processor timeout" {
    inject {
      http_timeout on "payments.stripe.com" after 30s
    }
    
    when {
      ProcessPayment(amount: 100.00, card_token: "tok_visa")
    }
    
    then {
      result is error SERVICE_UNAVAILABLE
      no duplicate charges
      audit_log records timeout
    }
  }
  
  scenario "Database failover" {
    inject {
      database_failure for 5s
      then database_recovery
    }
    
    when {
      ProcessPayment(amount: 100.00, card_token: "tok_visa")
    }
    
    then {
      result is success after retry
      payment recorded correctly
      no data loss
    }
  }
  
  scenario "Cascading failure" {
    inject {
      service_failure on "inventory-service"
      service_failure on "notification-service"
    }
    
    when {
      PlaceOrder(items: [...])
    }
    
    then {
      order created successfully
      inventory update queued for retry
      notification queued for retry
    }
  }
}`}
          language="isl"
        />

        <h2>Programmatic Chaos</h2>

        <CodeBlock
          code={`// chaos-test.ts
import { ChaosRunner, NetworkChaos, DatabaseChaos } from '@intentos/chaos';

const chaos = new ChaosRunner();

// Add chaos injectors
chaos.addInjector(new NetworkChaos({
  failureRate: 0.1,
  latencyMs: { min: 100, max: 500 }
}));

chaos.addInjector(new DatabaseChaos({
  connectionFailureRate: 0.05,
  queryTimeoutRate: 0.1
}));

// Run chaos tests
describe('Payment Processing under Chaos', () => {
  beforeEach(() => chaos.start());
  afterEach(() => chaos.stop());

  it('handles network failures gracefully', async () => {
    const result = await processPayment({
      amount: 100.00,
      cardToken: 'tok_visa'
    });
    
    // Should either succeed or return a retriable error
    expect(result.ok || result.error.retriable).toBe(true);
  });

  it('prevents double charges on retry', async () => {
    const idempotencyKey = 'payment-123';
    
    // First attempt (may fail due to chaos)
    await processPayment({ amount: 100, idempotencyKey });
    
    // Retry with same key
    await processPayment({ amount: 100, idempotencyKey });
    
    // Should only have one charge
    const charges = await getCharges(idempotencyKey);
    expect(charges.length).toBe(1);
  });
});`}
          language="typescript"
        />

        <h2>Circuit Breaker Testing</h2>

        <CodeBlock
          code={`chaos_scenarios "Circuit Breaker" {
  scenario "Circuit opens after failures" {
    inject {
      http_error 500 on "external-api" for 10 requests
    }
    
    when {
      repeat 10 times {
        CallExternalApi(...)
      }
    }
    
    then {
      circuit_breaker("external-api").state == OPEN
      subsequent calls fail fast
      no requests sent to failing service
    }
  }
  
  scenario "Circuit closes after recovery" {
    given {
      circuit_breaker("external-api").state == OPEN
    }
    
    inject {
      http_success on "external-api"
    }
    
    when {
      wait 30s  # Half-open timeout
      CallExternalApi(...)
    }
    
    then {
      result is success
      circuit_breaker("external-api").state == CLOSED
    }
  }
}`}
          language="isl"
        />

        <h2>Reports</h2>

        <CodeBlock
          code={`$ isl verify specs/ --chaos --report html

Generating chaos test report...

Report saved to: .isl/reports/chaos-report.html

Summary:
  Total scenarios: 24
  Passed: 21
  Failed: 3
  
  Resilience score: 87.5%
  
Failed scenarios:
  1. Payment processor timeout - double charge detected
  2. Database failover - data loss during failover
  3. Memory pressure - OOM before graceful shutdown`}
          language="bash"
        />
      </div>
    </div>
  );
}
