// ============================================================================
// DeleteUser Implementation - Test fixture
// ============================================================================

export interface DeleteUserInput {
  userId: string;
}

/**
 * Delete a user by ID
 * Note: This implementation intentionally has a bug for mutation testing
 */
export async function deleteUser(input: DeleteUserInput): Promise<void> {
  // Validate user ID
  if (!input.userId) {
    throw new Error('User ID is required');
  }
  
  // In a real implementation, would delete from database
  // For testing, we just return
}
