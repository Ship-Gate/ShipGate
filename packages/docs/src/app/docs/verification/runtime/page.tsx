import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Runtime Verification - ISL Documentation",
  description: "Verify preconditions, postconditions, and invariants at runtime.",
};

export default function RuntimePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Runtime Verification</h1>

        <p className="lead text-xl text-muted-foreground">
          Runtime verification ensures your implementation matches your 
          specifications by testing preconditions, postconditions, and invariants.
        </p>

        <h2>How It Works</h2>

        <p>
          ISL generates test code that wraps your implementation and verifies 
          contracts at runtime:
        </p>

        <CodeBlock
          code={`// Generated verification wrapper
async function verifiedCreateUser(input: CreateUserInput) {
  // Check preconditions
  assert(isValidEmail(input.email), "Precondition: email.is_valid_format");
  assert(input.password.length >= 8, "Precondition: password.length >= 8");
  assert(!await userExistsByEmail(input.email), "Precondition: not User.exists_by_email");
  
  // Execute the actual implementation
  const result = await createUser(input);
  
  // Check postconditions
  if (result.ok) {
    assert(await userExists(result.data.id), "Postcondition: User.exists(result.id)");
    assert(result.data.email === input.email, "Postcondition: result.email == input.email");
  }
  
  // Check entity invariants
  if (result.ok) {
    const user = await getUser(result.data.id);
    assert(isValidEmail(user.email), "Invariant: email.is_valid_format");
  }
  
  return result;
}`}
          language="typescript"
        />

        <h2>Running Verification</h2>

        <CodeBlock
          code={`$ isl verify specs/auth.isl --runtime

Runtime Verification
====================

Behavior: Login
  Preconditions:
    ✓ email.is_valid_format (1000 samples)
    ✓ password.length >= 8 (1000 samples)
  Postconditions:
    ✓ success implies Session.exists(result.id) (847 successes)
    ✓ success implies User.last_login == now() (847 successes)
    ✓ INVALID_CREDENTIALS implies User.failed_attempts++ (153 failures)
  
Behavior: Register
  Preconditions:
    ✓ email.is_valid_format (1000 samples)
    ✓ not User.exists_by_email(email) (1000 samples)
  Postconditions:
    ✓ success implies User.exists(result.id) (923 successes)
    ✗ success implies verification_email_sent (77 failures)
    
Entity: User
  Invariants:
    ✓ email.is_valid_format (5000 records)
    ✓ status == DELETED implies deleted_at != null (5000 records)

Summary: 11/12 checks passed (91.7%)`}
          language="bash"
        />

        <h2>Verification Modes</h2>

        <h3>Sample-Based Verification</h3>

        <p>
          Test with random inputs to find edge cases:
        </p>

        <CodeBlock
          code={`$ isl verify specs/ --runtime --samples 10000

Generating 10000 random inputs per behavior...
Testing edge cases and boundary conditions...`}
          language="bash"
        />

        <h3>Property-Based Testing</h3>

        <p>
          Automatically generate test cases from property definitions:
        </p>

        <CodeBlock
          code={`$ isl verify specs/ --runtime --property-based

Deriving properties from postconditions...
Generating test cases using QuickCheck-style shrinking...`}
          language="bash"
        />

        <h3>Production Verification</h3>

        <p>
          Enable lightweight verification in production:
        </p>

        <CodeBlock
          code={`// Enable production verification
import { enableVerification } from '@intentos/verify';

enableVerification({
  mode: 'production',
  sampleRate: 0.01,  // Verify 1% of requests
  onViolation: (violation) => {
    logger.error('Contract violation', violation);
    metrics.increment('contract_violations');
  }
});`}
          language="typescript"
        />

        <h2>Handling Failures</h2>

        <p>
          When verification fails, ISL provides detailed reports:
        </p>

        <CodeBlock
          code={`Verification Failure
====================

Behavior: CreateOrder
Postcondition: success implies Order.total == items.sum(price)

Expected: 99.97
Actual: 99.96

Input:
  items: [
    { product_id: "prod-1", quantity: 3, price: 33.32 }
  ]

Stack trace:
  at verifyPostcondition (verify.ts:45)
  at createOrder (order.service.ts:78)
  
Suggestion: Floating point precision issue. Consider using 
Decimal type with fixed precision.`}
          language="text"
        />

        <h2>Integration with Test Frameworks</h2>

        <CodeBlock
          code={`// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { islPlugin } from '@intentos/vitest-plugin';

export default defineConfig({
  plugins: [
    islPlugin({
      specsDir: './specs',
      verifyOnTest: true
    })
  ],
  test: {
    include: ['src/**/*.test.ts', '.isl/generated/**/*.test.ts']
  }
});`}
          language="typescript"
        />

        <h2>Custom Verification</h2>

        <p>
          Add custom verification logic:
        </p>

        <CodeBlock
          code={`// custom-verifiers.ts
import { registerVerifier } from '@intentos/verify';

// Custom verifier for email format
registerVerifier('email.is_valid_format', (value: string) => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(value);
});

// Custom verifier for entity existence
registerVerifier('User.exists', async (id: string) => {
  const user = await db.users.findUnique({ where: { id } });
  return user !== null;
});

// Custom verifier with database check
registerVerifier('User.exists_by_email', async (email: string) => {
  const count = await db.users.count({ where: { email } });
  return count > 0;
});`}
          language="typescript"
        />
      </div>
    </div>
  );
}
