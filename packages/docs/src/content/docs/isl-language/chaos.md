---
title: Chaos Engineering
description: Chaos testing blocks for verifying system behavior under failure conditions.
---

ISL includes built-in chaos engineering constructs. Chaos blocks define how your system should behave when things go wrong — database failures, network issues, concurrent requests, and resource pressure.

## Basic syntax

```isl
chaos BehaviorName {
  scenario "failure description" {
    inject fault_type(parameters)
    expect expected_behavior
    retries: count
  }
}
```

## Injection types

### Database failures

```isl
chaos CreateUser {
  scenario "database unavailable" {
    inject database_failure(
      target: "UserRepository",
      mode: UNAVAILABLE
    )
    expect error_returned(SERVICE_UNAVAILABLE)
    retries: 3
    expect successful_retry_after_recovery
  }

  scenario "database timeout" {
    inject database_failure(
      target: "UserRepository",
      mode: TIMEOUT
    )
    expect error_returned(SERVICE_UNAVAILABLE)
    retries: 2
  }
}
```

### Network issues

```isl
chaos FetchExternalData {
  scenario "high network latency" {
    inject network_latency(
      target: "ExternalAPI",
      delay: 5s
    )
    expect {
      timeout_handled
      fallback_used
    }
  }

  scenario "network partition" {
    inject network_partition(
      target: "PaymentGateway",
      duration: 30s
    )
    expect {
      error_returned(SERVICE_UNAVAILABLE)
      no_partial_state
    }
  }
}
```

### Service unavailability

```isl
chaos ProcessOrder {
  scenario "payment service down" {
    inject service_unavailable(
      target: "PaymentService",
      duration: 10s
    )
    expect {
      order_status == PENDING
      retry_scheduled
      no_inventory_deducted
    }
  }
}
```

### Concurrent requests

```isl
chaos CreatePayment {
  scenario "concurrent duplicate requests" {
    inject concurrent_requests(count: 10)
    with {
      idempotency_key: "chaos-dup-test"
    }
    expect {
      exactly_one_created
      all_return_same_result
    }
    retries: 0
  }
}
```

### Resource pressure

```isl
chaos DataProcessing {
  scenario "under CPU pressure" {
    inject cpu_pressure(
      target: "worker",
      load: 90
    )
    expect {
      processing_completes
      latency_within(10s)
    }
  }

  scenario "under memory pressure" {
    inject memory_pressure(
      target: "worker",
      usage: 95
    )
    expect {
      graceful_degradation
      no_oom_crash
    }
  }
}
```

### Clock skew

```isl
chaos TokenValidation {
  scenario "clock skew between services" {
    inject clock_skew(
      target: "AuthService",
      offset: 30s
    )
    expect {
      token_validation_handles_skew
      no_false_expirations
    }
  }
}
```

## Complete injection reference

| Injection              | Parameters                  | Use case                          |
| ---------------------- | --------------------------- | --------------------------------- |
| `database_failure`     | `target`, `mode`            | Database goes down                |
| `network_latency`      | `target`, `delay`           | Slow network calls                |
| `network_partition`    | `target`, `duration`        | Complete network isolation        |
| `service_unavailable`  | `target`, `duration`        | Dependency service is down        |
| `cpu_pressure`         | `target`, `load`            | High CPU usage                    |
| `memory_pressure`      | `target`, `usage`           | High memory usage                 |
| `clock_skew`           | `target`, `offset`          | Time drift between services       |
| `concurrent_requests`  | `count`                     | Race conditions and idempotency   |

## The `with` block

Supply additional context for the chaos scenario:

```isl
chaos ProcessPayment {
  scenario "duplicate payment requests" {
    inject concurrent_requests(count: 5)
    with {
      idempotency_key: "pay-chaos-001"
      amount: 99.99
      customer_id: "cust-001"
    }
    expect {
      exactly_one_created
      all_return_same_result
    }
    retries: 0
  }
}
```

## The `retries` directive

Specify how many retries the system should attempt:

```isl
scenario "database recovers after retry" {
  inject database_failure(target: "OrderDB", mode: UNAVAILABLE)
  retries: 3
  expect successful_retry_after_recovery
}

scenario "no retries for idempotency" {
  inject concurrent_requests(count: 10)
  retries: 0
  expect exactly_one_created
}
```

## Running chaos tests

Use the CLI to run chaos tests against your implementation:

```bash
# Run chaos tests for a specific spec
shipgate chaos payment-service.isl --impl ./src/payment.ts

# With detailed output
shipgate chaos payment-service.isl --impl ./src/payment.ts --detailed

# Continue running after a failure
shipgate chaos payment-service.isl --impl ./src/payment.ts --continue-on-failure

# With reproducible seed
shipgate chaos payment-service.isl --impl ./src/payment.ts --seed 42
```

Example output:

```
Running chaos tests for ProcessPayment...

Chaos: "concurrent duplicate requests"
  Injecting: concurrent_requests(count: 10)
  ✓ exactly_one_created
  ✓ all_return_same_result

Chaos: "database failure during payment"
  Injecting: database_failure(target: PaymentRepository, mode: UNAVAILABLE)
  ✓ error_returned(SERVICE_UNAVAILABLE)
  Retrying (1/3)... ✓ successful_retry_after_recovery

2/2 chaos scenarios passed
```

## Full example

```isl
domain OrderService {
  chaos PlaceOrder {
    scenario "concurrent duplicate orders" {
      inject concurrent_requests(count: 20)
      with {
        idempotency_key: "order-chaos-001"
        customer_id: "cust-001"
      }
      expect {
        exactly_one_created
        all_return_same_result
        inventory_decremented_once
      }
      retries: 0
    }

    scenario "payment gateway timeout" {
      inject network_latency(target: "PaymentGateway", delay: 30s)
      expect {
        order_status == PENDING
        timeout_handled
        no_double_charge
      }
    }

    scenario "database failure mid-transaction" {
      inject database_failure(target: "OrderDB", mode: UNAVAILABLE)
      expect {
        error_returned(SERVICE_UNAVAILABLE)
        no_partial_state
        inventory_not_decremented
      }
      retries: 3
      expect successful_retry_after_recovery
    }

    scenario "high load degradation" {
      inject cpu_pressure(target: "order-service", load: 95)
      inject memory_pressure(target: "order-service", usage: 90)
      expect {
        processing_completes
        no_data_loss
      }
    }
  }
}
```

## Chaos testing vs scenarios

| Feature        | Scenarios                  | Chaos                              |
| -------------- | -------------------------- | ---------------------------------- |
| **Purpose**    | Test normal behavior       | Test failure behavior              |
| **Inputs**     | Concrete values            | Fault injections                   |
| **Assertions** | Result correctness         | Resilience and recovery            |
| **Scope**      | Happy + error paths        | Infrastructure failures            |
| **CLI**        | `shipgate verify`          | `shipgate chaos`                   |
