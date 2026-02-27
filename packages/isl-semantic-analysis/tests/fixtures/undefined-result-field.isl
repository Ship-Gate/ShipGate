/**
 * Test Fixture: Undefined Result Fields in Postconditions
 * 
 * Contains examples of postconditions that reference fields
 * not declared in the output type, triggering E0312 diagnostics.
 */

domain UndefinedResultField version "1.0.0"

/**
 * Example 1: Typo in result field name
 */
behavior TransferWithTypo {
  input {
    amount: Decimal
  }
  output {
    success: { transferred: Decimal, fee: Decimal }
  }
  
  postconditions on success {
    result.ammount > 0  // E0312: should be 'transferred' or 'fee', not 'ammount'
  }
}

/**
 * Example 2: Completely wrong field name
 */
behavior CreateUser {
  input {
    name: String
    email: String
  }
  output {
    success: { id: UUID, created: Boolean }
  }
  
  postconditions on success {
    result.userId != null      // E0312: should be 'id'
    result.wasCreated == true  // E0312: should be 'created'
  }
}

/**
 * Example 3: Accessing nested field that doesn't exist
 */
behavior ProcessOrder {
  input {
    orderId: UUID
  }
  output {
    success: { 
      order: { 
        id: UUID
        total: Decimal 
      }
    }
  }
  
  postconditions on success {
    result.order.subtotal > 0  // E0312: 'subtotal' not in order, only 'id' and 'total'
  }
}
