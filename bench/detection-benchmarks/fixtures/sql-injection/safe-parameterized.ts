import { Request, Response } from 'express';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface UserSearchParams {
  username?: string;
  role?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export async function searchUsers(req: Request, res: Response) {
  const {
    username,
    role,
    active,
    page = 1,
    limit = 20,
  } = req.query as unknown as UserSearchParams;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (username) {
    conditions.push(`username ILIKE $${paramIndex++}`);
    params.push(`%${username}%`);
  }

  if (role) {
    conditions.push(`role = $${paramIndex++}`);
    params.push(role);
  }

  if (active !== undefined) {
    conditions.push(`active = $${paramIndex++}`);
    params.push(active);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = (Number(page) - 1) * Number(limit);

  const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
  const dataQuery = `
    SELECT id, username, email, role, active, created_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  try {
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataParams = [...params, Number(limit), offset];
    const dataResult = await pool.query(dataQuery, dataParams);

    return res.json({
      success: true,
      users: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('User search failed:', error);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
}

export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, username, email, role, active, created_at FROM users WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('User lookup failed:', error);
    return res.status(500).json({ success: false, message: 'Lookup failed' });
  }
}
