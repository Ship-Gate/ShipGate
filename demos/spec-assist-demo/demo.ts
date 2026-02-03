/**
 * Spec Assist Demo
 * 
 * Demonstrates AI-assisted ISL spec generation.
 * 
 * To run:
 *   ISL_AI_ENABLED=true pnpm tsx demos/spec-assist-demo/demo.ts
 */

// Set feature flag for demo
process.env.ISL_AI_ENABLED = 'true';
process.env.ISL_AI_PROVIDER = 'stub';

import {
  createSpecAssist,
  generateSpecFromCode,
  isValidOutput,
  validateISL,
  isSpecAssistAvailable,
  INVALID_OUTPUTS,
} from '../../packages/spec-assist/src/index.js';

async function main() {
  console.log('='.repeat(60));
  console.log('  ISL Spec Assist Demo');
  console.log('='.repeat(60));
  console.log();

  // Check availability
  console.log('1. Checking feature flag...');
  console.log(`   AI assist available: ${isSpecAssistAvailable()}`);
  console.log();

  // Demo: Output validation
  console.log('2. Testing output validation (reject slop)...');
  
  const validISL = `behavior CreateUser {
  input { email: String }
  output { user: User }
}`;
  
  console.log('   Valid ISL:', isValidOutput(validISL).valid ? '✓ ACCEPTED' : '✗ REJECTED');
  console.log('   Prose only:', isValidOutput(INVALID_OUTPUTS.proseOnly).valid ? '✓ ACCEPTED' : '✗ REJECTED');
  console.log('   Empty:', isValidOutput(INVALID_OUTPUTS.empty).valid ? '✓ ACCEPTED' : '✗ REJECTED');
  console.log('   Wrong language:', isValidOutput(INVALID_OUTPUTS.wrongLanguage).valid ? '✓ ACCEPTED' : '✗ REJECTED');
  console.log();

  // Demo: Validation pipeline
  console.log('3. Testing validation pipeline...');
  
  const validResult = await validateISL(validISL);
  console.log(`   Parse OK: ${validResult.parseOk}`);
  console.log(`   Semantic OK: ${validResult.semanticOk}`);
  console.log(`   All passed: ${validResult.allPassed}`);
  console.log();

  // Demo: Full spec generation
  console.log('4. Generating spec from TypeScript code...');
  
  const sampleCode = `
    export async function createUser(
      email: string,
      password: string,
      name?: string
    ): Promise<{ user: User; token: AuthToken }> {
      // Validate email format
      if (!isValidEmail(email)) {
        throw new ValidationError('Invalid email format');
      }
      
      // Check if user exists
      const existing = await db.users.findByEmail(email);
      if (existing) {
        throw new ConflictError('Email already registered');
      }
      
      // Create user
      const user = await db.users.create({
        email,
        passwordHash: await hash(password),
        name: name ?? email.split('@')[0],
        status: 'pending',
        createdAt: new Date(),
      });
      
      // Send verification email
      await sendVerificationEmail(user.email);
      
      // Generate auth token
      const token = await generateAuthToken(user.id);
      
      return { user, token };
    }
  `;

  const result = await generateSpecFromCode(sampleCode, 'typescript', {
    signature: 'createUser',
    hints: [
      'Handles user registration',
      'Validates email format',
      'Sends verification email on success',
    ],
  });

  console.log();
  console.log('   Result:');
  console.log(`   - Success: ${result.success}`);
  console.log(`   - Provider: ${result.metadata.provider}`);
  console.log(`   - Duration: ${result.metadata.durationMs}ms`);
  console.log(`   - Validation passed: ${result.validation.allPassed}`);
  console.log();

  if (result.success && result.isl) {
    console.log('   Generated ISL:');
    console.log('   ' + '-'.repeat(40));
    for (const line of result.isl.split('\n')) {
      console.log('   ' + line);
    }
    console.log('   ' + '-'.repeat(40));
  } else {
    console.log('   Diagnostics:');
    for (const d of result.diagnostics) {
      console.log(`   - [${d.severity}] ${d.message}`);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('  Demo complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
