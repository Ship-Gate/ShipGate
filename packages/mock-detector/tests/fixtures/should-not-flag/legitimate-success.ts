/**
 * Should NOT flag: Legitimate success response with error handling
 */
async function processPayment(amount: number) {
  try {
    const result = await paymentGateway.charge(amount);
    return { success: true, transactionId: result.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
