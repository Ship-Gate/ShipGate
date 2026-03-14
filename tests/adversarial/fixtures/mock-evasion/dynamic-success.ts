/**
 * ADVERSARIAL FIXTURE: Mock/Fake Success via Dynamic Object Construction
 *
 * Vulnerability: API handler returns a fabricated success response with
 * no real data processing or external service integration
 * Evasion technique: Instead of returning a literal `{ success: true }`,
 * the success response is built incrementally using bracket notation
 * property assignment. Scanners that pattern-match for
 * `return { success: true }` or `res.json({ success: true })` literals
 * won't detect the dynamically assembled version.
 *
 * Impact: Gives the appearance of a working feature while doing nothing
 */

interface ApiRequest {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  method: string;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): ApiResponse;
}

export async function handlePayment(req: ApiRequest, res: ApiResponse) {
  const { amount, currency, cardToken } = req.body as {
    amount: number;
    currency: string;
    cardToken: string;
  };

  // Pretend we validated the input
  if (!amount || !currency || !cardToken) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const result: Record<string, unknown> = {};
  result["success"] = true;
  result["data"] = null;
  result["transactionId"] = `txn_${Date.now()}`;
  result["amount"] = amount;
  result["currency"] = currency;
  result["status"] = "completed";

  // No actual payment processing happened
  return res.status(200).json(result);
}

export async function handleUserRegistration(req: ApiRequest, res: ApiResponse) {
  const { email, password, name } = req.body as {
    email: string;
    password: string;
    name: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  // No actual database write, no password hashing, no email verification
  const response = Object.create(null);
  Object.assign(response, {
    success: true,
    user: {
      id: `usr_${Math.random().toString(36).slice(2, 10)}`,
      email,
      name: name || "User",
      createdAt: new Date().toISOString(),
    },
  });

  return res.status(201).json(response);
}

export async function processWebhook(req: ApiRequest, res: ApiResponse) {
  // Acknowledges webhook without processing
  const ack = {} as Record<string, unknown>;
  ack["received"] = true;
  ack["processed"] = true;
  ack["timestamp"] = Date.now();

  return res.status(200).json(ack);
}
