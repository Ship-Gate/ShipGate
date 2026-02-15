domain WithImports {
  version: "1.0.0"

  imports { User, Session as UserSession } from "auth"
  imports { Payment, Refund } from "payments"

  entity Order {
    id: UUID [immutable, unique]
    user_id: UUID
    payment_id: UUID
  }
}
