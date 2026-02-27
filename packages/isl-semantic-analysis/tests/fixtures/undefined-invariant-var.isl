/**
 * Test Fixture: Undefined Variables in Invariants
 * 
 * Contains examples of invariants that reference variables
 * not in scope, triggering E0313 diagnostics.
 */

domain UndefinedInvariantVar version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
  owner: String
}

entity User {
  id: UUID
  email: String
  name: String
  
  // Entity-level invariants have access to own fields
  invariants {
    emal != null   // E0313: typo, should be 'email'
    namee.length > 0  // E0313: typo, should be 'name'
  }
}

/**
 * Example 1: Referencing undefined entity in global invariant
 */
invariant "bad entity reference" global {
  undefinedEntity.balance >= 0  // E0313: 'undefinedEntity' not defined
}

/**
 * Example 2: Missing quantifier binding
 * Without 'all a in Account:', 'a' is not bound
 */
invariant "missing quantifier" global {
  a.balance >= 0  // E0313: 'a' not defined (missing: all a in Account:)
}

/**
 * Example 3: Correct usage with quantifier (for comparison)
 */
invariant "valid with quantifier" global {
  all account in Account: account.balance >= 0  // Valid: 'account' bound by quantifier
}

/**
 * Example 4: Referencing field from wrong entity
 */
invariant "wrong entity field" global {
  all u in User: u.balance >= 0  // E0313: User doesn't have 'balance' field
}
