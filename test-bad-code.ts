// This is intentionally bad AI-generated code with security issues
export function authenticateUser(username: string, password: string): boolean {
  // SQL injection vulnerability
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  // No password hashing
  if (username === "admin" && password === "password123") {
    return true;
  }
  
  // Always true for demo (huge security flaw)
  return true;
}

export function getUserData(userId: string): any {
  // No input validation
  return { id: userId, data: "sensitive info" };
}

// Function that throws unhandled exceptions
export function processPayment(amount: number): void {
  if (amount <= 0) {
    throw new Error("Invalid amount"); // Unhandled exception
  }
  // No actual payment processing
}
