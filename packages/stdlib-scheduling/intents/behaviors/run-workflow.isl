/**
 * RunWorkflow Behavior
 * 
 * Start a multi-step workflow.
 */

import { Workflow, WorkflowStatus, WorkflowStepInput, HandlerName } from "../domain.isl"

behavior RunWorkflow {
  description: "Start a multi-step workflow"
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Input
  // ═══════════════════════════════════════════════════════════════════════════
  
  input {
    /** Workflow name */
    name: String { minLength: 1, maxLength: 255 }
    
    /** Description */
    description: String?
    
    /** Steps to execute */
    steps: List<WorkflowStepInput> { minLength: 1, maxLength: 100 }
    
    /** Initial context data */
    initial_context: Map<String, Any>?
    
    /** Continue execution if a step fails */
    continue_on_failure: Boolean? { default: false }
    
    /** Maximum parallel step execution */
    max_parallelism: Int? { min: 1, max: 10, default: 1 }
    
    /** Tags for categorization */
    tags: List<String>?
    
    /** Custom metadata */
    metadata: Map<String, Any>?
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Output
  // ═══════════════════════════════════════════════════════════════════════════
  
  output {
    success: Workflow
    
    errors {
      INVALID_DEPENDENCIES {
        message: "Step dependencies form a cycle"
        when: "Dependency graph contains cycles"
        data: { cycle: List<String> }
      }
      
      MISSING_DEPENDENCY {
        message: "Step depends on non-existent step"
        when: "depends_on references unknown step"
        data: { step: String, missing: String }
      }
      
      DUPLICATE_STEP_NAME {
        message: "Step names must be unique"
        when: "Two or more steps have the same name"
        data: { duplicate: String }
      }
      
      HANDLER_NOT_FOUND {
        message: "Handler not registered"
        when: "A step references an unknown handler"
        data: { step: String, handler: String }
      }
      
      TOO_MANY_STEPS {
        message: "Too many steps"
        when: "Workflow exceeds maximum step count"
        data: { count: Int, max: Int }
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Preconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  preconditions {
    // At least one step
    input.steps.length > 0
      as "Workflow must have at least one step"
    
    // Step names are unique
    input.steps.map(s => s.name).distinct().length == input.steps.length
      as "Step names must be unique"
    
    // All dependencies reference existing steps
    forall step in input.steps:
      step.depends_on == null or
      forall dep in step.depends_on:
        input.steps.any(s => s.name == dep)
      as "All dependencies must reference existing steps"
    
    // No circular dependencies
    isValidDAG(input.steps)
      as "Step dependencies must not form cycles"
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Postconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  postconditions {
    success implies {
      // Workflow was created
      Workflow.exists(result.id)
      
      // Workflow has correct name
      result.name == input.name
      
      // All steps are created
      result.steps.length == input.steps.length
      
      // All steps start as PENDING
      result.steps.all(s => s.status == PENDING)
      
      // Context is initialized
      input.initial_context != null implies result.context == input.initial_context
      
      // Workflow is pending or already running
      result.status in [PENDING, RUNNING]
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Temporal Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  
  temporal {
    response within 200.ms (p99)
    eventually within 2.seconds: workflow_persisted
    eventually within 5.seconds: first_step_started
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenarios
// ═══════════════════════════════════════════════════════════════════════════

scenarios RunWorkflow {
  scenario "run simple sequential workflow" {
    when {
      result = RunWorkflow(
        name: "order-processing",
        steps: [
          { name: "validate", handler: "orders.validate" },
          { name: "charge", handler: "payments.charge", depends_on: ["validate"] },
          { name: "fulfill", handler: "inventory.fulfill", depends_on: ["charge"] },
          { name: "notify", handler: "notifications.send", depends_on: ["fulfill"] }
        ],
        initial_context: { order_id: "order-123" }
      )
    }
    
    then {
      result is success
      result.workflow.steps.length == 4
      result.workflow.status in [PENDING, RUNNING]
      result.workflow.context.order_id == "order-123"
    }
  }
  
  scenario "run parallel workflow" {
    when {
      result = RunWorkflow(
        name: "data-aggregation",
        steps: [
          { name: "fetch-users", handler: "data.fetch_users" },
          { name: "fetch-orders", handler: "data.fetch_orders" },
          { name: "fetch-products", handler: "data.fetch_products" },
          { 
            name: "aggregate", 
            handler: "data.aggregate",
            depends_on: ["fetch-users", "fetch-orders", "fetch-products"]
          }
        ],
        max_parallelism: 3
      )
    }
    
    then {
      result is success
      result.workflow.max_parallelism == 3
    }
  }
  
  scenario "workflow with conditional steps" {
    when {
      result = RunWorkflow(
        name: "conditional-flow",
        steps: [
          { name: "check-inventory", handler: "inventory.check" },
          { 
            name: "order-stock", 
            handler: "inventory.order",
            depends_on: ["check-inventory"],
            condition: "context.inventory_low == true"
          },
          { 
            name: "fulfill", 
            handler: "orders.fulfill",
            depends_on: ["check-inventory", "order-stock"]
          }
        ]
      )
    }
    
    then {
      result is success
      result.workflow.steps[1].condition != null
    }
  }
  
  scenario "detect circular dependencies" {
    when {
      result = RunWorkflow(
        name: "circular-deps",
        steps: [
          { name: "step-a", handler: "test.a", depends_on: ["step-c"] },
          { name: "step-b", handler: "test.b", depends_on: ["step-a"] },
          { name: "step-c", handler: "test.c", depends_on: ["step-b"] }
        ]
      )
    }
    
    then {
      result is INVALID_DEPENDENCIES
      result.error.cycle contains "step-a"
      result.error.cycle contains "step-b"
      result.error.cycle contains "step-c"
    }
  }
  
  scenario "detect missing dependency" {
    when {
      result = RunWorkflow(
        name: "missing-dep",
        steps: [
          { name: "step-a", handler: "test.a" },
          { name: "step-b", handler: "test.b", depends_on: ["step-x"] }
        ]
      )
    }
    
    then {
      result is MISSING_DEPENDENCY
      result.error.step == "step-b"
      result.error.missing == "step-x"
    }
  }
  
  scenario "detect duplicate step names" {
    when {
      result = RunWorkflow(
        name: "duplicate-names",
        steps: [
          { name: "process", handler: "test.a" },
          { name: "process", handler: "test.b" }
        ]
      )
    }
    
    then {
      result is DUPLICATE_STEP_NAME
      result.error.duplicate == "process"
    }
  }
  
  scenario "workflow with retry policy" {
    when {
      result = RunWorkflow(
        name: "retryable-workflow",
        steps: [
          { 
            name: "flaky-step", 
            handler: "external.call",
            retry_policy: {
              max_attempts: 3,
              initial_delay: 1000,
              backoff_multiplier: 2.0
            }
          }
        ]
      )
    }
    
    then {
      result is success
      result.workflow.steps[0].retry_policy.max_attempts == 3
    }
  }
}
