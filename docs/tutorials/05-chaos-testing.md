# Tutorial 5: Chaos Testing

**Time:** ~50 minutes  
**Goal:** Use chaos testing to verify your implementation handles failures gracefully, including network issues, timeouts, and resource constraints.

## Overview

In this tutorial, you'll:
1. Create a payment processing specification
2. Implement payment processing with external API calls
3. Use chaos testing to inject failures
4. Verify resilience and error handling

## Prerequisites

- Completed [Hello World tutorial](./01-hello-world.md)
- Understanding of distributed systems concepts
- Node.js 18+ installed

## Step 1: Create Project

```bash
mkdir chaos-tutorial
cd chaos-tutorial
shipgate init --template minimal
```

## Step 2: Install Dependencies

```bash
npm init -y
npm install axios
npm install -D @types/node typescript ts-node
```

## Step 3: Create Payment Specification

Create `specs/payment.isl`:

```isl
domain Payment {
  version: "1.0.0"

  entity Payment {
    id: UUID [immutable, unique]
    amount: Decimal [immutable]
    currency: String [immutable]
    status: PaymentStatus [immutable]
    createdAt: DateTime [immutable]
    processedAt: DateTime
  }

  enum PaymentStatus {
    PENDING
    PROCESSING
    SUCCESS
    FAILED
    TIMEOUT
  }

  behavior ProcessPayment {
    input {
      amount: Decimal
      currency: String
      paymentMethodId: String
    }

    output {
      success: Payment
      errors {
        INVALID_AMOUNT {
          when: "Amount is negative or zero"
        }
        INVALID_CURRENCY {
          when: "Currency code is invalid"
        }
        PAYMENT_GATEWAY_ERROR {
          when: "Payment gateway is unavailable"
          retriable: true
        }
        TIMEOUT {
          when: "Payment processing timed out"
          retriable: true
        }
        NETWORK_ERROR {
          when: "Network request failed"
          retriable: true
        }
      }
    }

    pre {
      amount > 0
      currency.length == 3
      paymentMethodId.length > 0
    }

    post success {
      result.amount == input.amount
      result.currency == input.currency
      result.status == SUCCESS
      result.id != null
    }

    temporal {
      max_latency_ms: 5000
      timeout_ms: 10000
    }
  }

  behavior RetryPayment {
    input {
      paymentId: UUID
    }

    output {
      success: Payment
      errors {
        NOT_FOUND {
          when: "Payment does not exist"
        }
        ALREADY_SUCCESS {
          when: "Payment already succeeded"
        }
        MAX_RETRIES_EXCEEDED {
          when: "Maximum retry attempts reached"
        }
      }
    }

    pre {
      paymentId != null
    }

    post success {
      result.id == input.paymentId
      result.status == SUCCESS
    }
  }
}
```

**Key features:**
- Retriable errors (network, timeout, gateway errors)
- Temporal constraints (max latency, timeout)
- Idempotency considerations

## Step 4: Validate Specification

```bash
shipgate check specs/payment.isl
```

**Expected output:**
```
✓ Parsed specs/payment.isl
✓ Type check passed
✓ Temporal constraints validated
✓ No errors found
```

## Step 5: Implement Payment Processor

Create `src/payment.ts`:

```typescript
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'https://api.payment-gateway.com';
const REQUEST_TIMEOUT_MS = 10000;

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  createdAt: Date;
  processedAt?: Date;
}

const payments: Map<string, Payment> = new Map();
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];

async function callPaymentGateway(amount: number, currency: string, methodId: string): Promise<{ success: boolean; transactionId?: string }> {
  try {
    const response = await axios.post(
      `${PAYMENT_GATEWAY_URL}/charge`,
      { amount, currency, methodId },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    return { success: true, transactionId: response.data.transactionId };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('TIMEOUT');
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('NETWORK_ERROR');
      }
      if (error.response?.status >= 500) {
        throw new Error('PAYMENT_GATEWAY_ERROR');
      }
    }
    throw error;
  }
}

export async function processPayment(
  amount: number,
  currency: string,
  paymentMethodId: string
): Promise<Payment> {
  // Preconditions
  if (amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (!VALID_CURRENCIES.includes(currency)) {
    throw new Error('INVALID_CURRENCY');
  }
  if (!paymentMethodId || paymentMethodId.length === 0) {
    throw new Error('Invalid payment method');
  }

  // Create payment record
  const now = new Date();
  const payment: Payment = {
    id: uuidv4(),
    amount,
    currency,
    status: 'PROCESSING',
    createdAt: now,
  };

  payments.set(payment.id, payment);

  try {
    // Call payment gateway
    const result = await callPaymentGateway(amount, currency, paymentMethodId);

    if (result.success) {
      payment.status = 'SUCCESS';
      payment.processedAt = new Date();
      payments.set(payment.id, payment);

      // Postconditions satisfied:
      // - result.amount == input.amount ✓
      // - result.currency == input.currency ✓
      // - result.status == SUCCESS ✓
      // - result.id != null ✓

      return payment;
    } else {
      payment.status = 'FAILED';
      payments.set(payment.id, payment);
      throw new Error('Payment failed');
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (['TIMEOUT', 'NETWORK_ERROR', 'PAYMENT_GATEWAY_ERROR'].includes(error.message)) {
        payment.status = error.message === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED';
        payments.set(payment.id, payment);
        throw error;
      }
    }
    payment.status = 'FAILED';
    payments.set(payment.id, payment);
    throw error;
  }
}

export async function retryPayment(paymentId: string): Promise<Payment> {
  // Preconditions
  if (!paymentId) {
    throw new Error('NOT_FOUND');
  }

  const payment = payments.get(paymentId);
  if (!payment) {
    throw new Error('NOT_FOUND');
  }

  if (payment.status === 'SUCCESS') {
    throw new Error('ALREADY_SUCCESS');
  }

  // Retry logic
  try {
    const result = await callPaymentGateway(payment.amount, payment.currency, 'retry');

    if (result.success) {
      payment.status = 'SUCCESS';
      payment.processedAt = new Date();
      payments.set(payment.id, payment);

      return payment;
    } else {
      throw new Error('Retry failed');
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'TIMEOUT') {
      throw error;
    }
    throw new Error('MAX_RETRIES_EXCEEDED');
  }
}
```

## Step 6: Run Chaos Testing

```bash
shipgate chaos specs/payment.isl --impl src/payment.ts
```

**Expected output:**
```
Running chaos tests...

Injecting failures:
  - Network latency: 100-500ms
  - Network errors: 10% chance
  - Timeouts: 5% chance
  - Gateway errors: 15% chance

ProcessPayment:
  Scenario: Normal flow
    ✓ Handled successfully
  Scenario: Network timeout
    ✓ Handled gracefully (TIMEOUT error)
  Scenario: Network error
    ✓ Handled gracefully (NETWORK_ERROR error)
  Scenario: Gateway error
    ✓ Handled gracefully (PAYMENT_GATEWAY_ERROR error)
  Scenario: Concurrent requests
    ✓ Handled correctly
  Scenario: Clock skew
    ✓ Handled correctly

RetryPayment:
  Scenario: Retry after failure
    ✓ Retried successfully
  Scenario: Retry already succeeded payment
    ✓ Rejected correctly (ALREADY_SUCCESS)

All chaos scenarios passed! ✓
Resilience score: 95/100
```

## Step 7: Test Specific Failure Modes

Test specific failure scenarios:

```bash
# Test only network failures
shipgate chaos specs/payment.isl --impl src/payment.ts \
  --inject network \
  --network-error-rate 0.3

# Test only timeouts
shipgate chaos specs/payment.isl --impl src/payment.ts \
  --inject timeout \
  --timeout-rate 0.2

# Test clock skew
shipgate chaos specs/payment.isl --impl src/payment.ts \
  --inject clock-skew \
  --skew-ms 5000
```

## Step 8: Test Concurrent Scenarios

Test how your implementation handles concurrent requests:

```bash
shipgate chaos specs/payment.isl --impl src/payment.ts \
  --inject concurrent \
  --concurrent-requests 10
```

**Expected output:**
```
Testing concurrent scenarios...

ProcessPayment (10 concurrent):
  ✓ All requests handled correctly
  ✓ No race conditions detected
  ✓ Idempotency maintained
```

## Step 9: Generate Chaos Report

Generate a detailed chaos testing report:

```bash
shipgate chaos specs/payment.isl --impl src/payment.ts \
  --json > chaos-report.json
```

## Step 10: Verify Resilience

Run the gate with chaos testing enabled:

```bash
shipgate gate specs/payment.isl --impl src/payment.ts \
  --chaos \
  --threshold 85
```

**Expected output:**
```
Decision: SHIP ✓
Trust Score: 95/100
Resilience Score: 95/100

Chaos testing results:
  ✓ Network failures handled
  ✓ Timeouts handled
  ✓ Gateway errors handled
  ✓ Concurrent requests handled
```

## Complete Project Structure

```
chaos-tutorial/
├── .shipgate.yml
├── specs/
│   └── payment.isl
├── src/
│   └── payment.ts
├── chaos-report.json
└── package.json
```

## Troubleshooting

### Chaos tests fail unexpectedly

**Solution:**
- Check error handling in your implementation
- Ensure retriable errors are properly marked
- Verify timeout handling matches temporal constraints

### Network injection not working

**Solution:**
- Ensure your implementation uses HTTP client that can be intercepted
- Check that network errors are properly caught and converted to spec errors
- Verify retriable error codes match spec

### Concurrent tests reveal race conditions

**Solution:**
- Add proper locking/synchronization
- Ensure idempotency for retriable operations
- Use atomic operations where needed

### Timeout handling fails

**Solution:**
- Ensure timeout values match temporal constraints in spec
- Check that timeout errors are properly propagated
- Verify timeout errors are marked as retriable

## Advanced: Custom Chaos Scenarios

You can define custom chaos scenarios in your spec:

```isl
behavior ProcessPayment {
  // ...
  
  chaos {
    scenario "High load" {
      concurrent_requests: 100
      network_latency_ms: 1000
    }
    
    scenario "Gateway maintenance" {
      gateway_error_rate: 1.0
      duration_ms: 60000
    }
  }
}
```

## Next Steps

- ✅ You've tested resilience with chaos engineering
- ✅ You've verified error handling under failures
- ✅ You've tested concurrent scenarios

**Congratulations!** You've completed all 5 tutorials. You now know how to:
- Create ISL specifications
- Implement code that matches specs
- Verify implementations
- Run gates for SHIP/NO_SHIP decisions
- Use PBT to find edge cases
- Test resilience with chaos engineering

## Summary

In this tutorial, you learned:
- How to specify retriable errors and temporal constraints
- How to implement resilient payment processing
- How to use chaos testing to inject failures
- How to verify resilience and error handling

Key concepts:
- **Retriable errors** can be safely retried
- **Temporal constraints** specify latency and timeout requirements
- **Chaos testing** injects failures to test resilience
- **Concurrent scenarios** test race conditions and idempotency
