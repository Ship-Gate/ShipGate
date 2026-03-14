/**
 * ISL Spec Prompt Builder
 *
 * Constructs structured LLM prompts that reliably produce valid ISL output.
 * Uses a few-shot approach with the ISL grammar embedded.
 * @module @isl-lang/spec-generator/prompts
 */

import type { AppTemplate } from './types.js';

const ISL_GRAMMAR_SUMMARY = `
ISL (Intent Specification Language) grammar summary:

domain <Name> {
  version: "<semver>"

  enum <EnumName> {
    VALUE_ONE
    VALUE_TWO
  }

  entity <EntityName> {
    fieldName: Type [modifiers]
    invariants {
      expression
    }
  }

  behavior <BehaviorName> {
    input  { field: Type }
    output {
      success: ReturnType
      errors {
        ERROR_CODE { when: "human-readable description" }
      }
    }
    pre  { precondition_expression }
    post success { postcondition_expression }
    temporal { within 200ms (p99): response returned }
  }
}

Supported field types: String, Int, Decimal, Boolean, DateTime, UUID, Email, URL
Field modifiers: [immutable] [unique] [indexed] [optional] [default: value] [sensitive]
Expressions: ==, !=, <, >, <=, >=, &&, ||, !, .length, .contains(), .is_valid, old(), not, null
Special: forall, exists, old(expr), result, input
`.trim();

const TEMPLATE_HINTS: Record<AppTemplate, string> = {
  saas: `Include: User, Organization, Subscription, Member entities. Include team invite, seat management, billing, RBAC behaviors.`,
  marketplace: `Include: User, Listing, Order, Review, Payment entities. Include listing creation, purchase, fulfillment, review behaviors.`,
  crm: `Include: Contact, Company, Deal, Activity, Pipeline entities. Include CRUD behaviors, pipeline stage transitions, activity logging.`,
  'internal-tool': `Include: User, Resource, AuditLog entities. Focus on CRUD behaviors with full audit trails and role-based access.`,
  booking: `Include: User, Service, Slot, Booking, Payment entities. Include availability, reservation, cancellation, payment behaviors.`,
  'ai-agent-app': `Include: User, Agent, Task, Message, Tool entities. Include task dispatch, message handling, tool execution, result behaviors.`,
  ecommerce: `Include: User, Product, Cart, Order, Payment, Inventory entities. Include product listing, cart management, checkout, fulfillment behaviors.`,
  custom: ``,
};

const FEW_SHOT_EXAMPLE = `
domain TaskManager {
  version: "1.0.0"

  enum TaskStatus { PENDING IN_PROGRESS COMPLETED CANCELLED }

  entity Task {
    id:          UUID     [immutable, unique]
    title:       String
    description: String   [optional]
    status:      TaskStatus [default: PENDING]
    assigneeId:  UUID     [optional]
    createdAt:   DateTime [immutable]
    dueAt:       DateTime [optional]
    invariants {
      title.length > 0
      status == COMPLETED implies completedAt != null
    }
  }

  behavior CreateTask {
    input  { title: String; description: String; dueAt: DateTime }
    output {
      success: Task
      errors {
        TITLE_REQUIRED { when: "Title is empty" }
        DUE_DATE_PAST  { when: "Due date is in the past" }
      }
    }
    pre  { title.length > 0 }
    post success {
      result.id   != null
      result.title == input.title
      result.status == PENDING
    }
  }

  behavior CompleteTask {
    input  { taskId: UUID }
    output {
      success: Task
      errors {
        NOT_FOUND      { when: "Task does not exist" }
        ALREADY_DONE   { when: "Task is already completed" }
      }
    }
    pre  { Task.exists(taskId) }
    post success {
      result.status == COMPLETED
      result.completedAt != null
      result.id == input.taskId
    }
    temporal { within 100ms (p99): response returned }
  }
}
`.trim();

export function buildGenerationPrompt(
  userPrompt: string,
  template?: AppTemplate,
): string {
  const templateHint = template ? TEMPLATE_HINTS[template] : '';
  return `You are an expert software architect. Convert the following app description into a valid ISL (Intent Specification Language) domain spec.

${ISL_GRAMMAR_SUMMARY}

RULES:
- Output ONLY the ISL domain block — no markdown fences, no explanations.
- Use PascalCase for entity/behavior/enum names, camelCase for fields.
- Every entity needs an id: UUID [immutable, unique] field.
- Every entity needs createdAt: DateTime [immutable] and updatedAt: DateTime fields.
- Every behavior must have at least one error case.
- Use the exact syntax shown. Do not invent new keywords.
- All monetary amounts must use Decimal type.
- All date/time fields must use DateTime type.
- Sensitive fields (passwords, tokens, secrets) must have the [sensitive] modifier.
${templateHint ? `\nTEMPLATE HINTS: ${templateHint}` : ''}

EXAMPLE:
${FEW_SHOT_EXAMPLE}

APP DESCRIPTION:
${userPrompt}

OUTPUT (ISL only):`;
}

export function buildRefinementPrompt(
  existingISL: string,
  changeRequest: string,
): string {
  return `You are an expert software architect. Update the following ISL spec based on the change request.

${ISL_GRAMMAR_SUMMARY}

RULES:
- Output ONLY the complete updated ISL domain block — no markdown fences, no explanations.
- Preserve all existing behaviors and entities unless the change explicitly removes them.
- Maintain backward compatibility: do not rename existing fields or behaviors.
- Every new behavior must have at least one error case.
- New entities must follow the same conventions as existing ones.
- Summarize your changes in a single-line comment at the top: // Changes: <brief summary>

EXISTING SPEC:
${existingISL}

CHANGE REQUEST:
${changeRequest}

OUTPUT (complete updated ISL only):`;
}

export function buildValidationRepairPrompt(
  invalidISL: string,
  errors: string[],
): string {
  return `You are an expert in ISL (Intent Specification Language). Fix the following invalid ISL spec.

${ISL_GRAMMAR_SUMMARY}

VALIDATION ERRORS:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

INVALID ISL:
${invalidISL}

OUTPUT (corrected ISL only, no markdown, no explanations):`;
}
