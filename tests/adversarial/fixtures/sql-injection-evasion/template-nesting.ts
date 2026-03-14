/**
 * ADVERSARIAL FIXTURE: SQL Injection via Nested Template Literals
 *
 * Vulnerability: SQL injection through unsanitized template interpolation
 * Evasion technique: The user input is first interpolated into an
 * intermediate template literal variable, then that variable is
 * interpolated into the SQL query. Scanners that only track single-level
 * template literal interpolation miss the multi-hop taint propagation.
 *
 * Exploit: POST /api/search { "userId": "1; DROP TABLE users; --" }
 */

interface DbPool {
  query(sql: string): Promise<{ rows: unknown[] }>;
}

interface SearchRequest {
  userId: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

declare const pool: DbPool;

export async function searchOrders(params: SearchRequest) {
  const { userId, startDate, endDate, status } = params;

  const userFilter = `${userId}`;
  const dateFilter = startDate && endDate
    ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'`
    : "";
  const statusFilter = status ? `AND status = '${status}'` : "";

  const query = `SELECT * FROM orders WHERE user_id = ${userFilter} ${dateFilter} ${statusFilter} ORDER BY created_at DESC`;

  const result = await pool.query(query);
  return result.rows;
}

export async function getOrderStats(userId: string) {
  const sanitizedId = `${userId}`;
  const innerQuery = `SELECT order_id FROM orders WHERE user_id = ${sanitizedId}`;
  const outerQuery = `SELECT status, COUNT(*) as count FROM orders WHERE order_id IN (${innerQuery}) GROUP BY status`;

  const result = await pool.query(outerQuery);
  return result.rows;
}
