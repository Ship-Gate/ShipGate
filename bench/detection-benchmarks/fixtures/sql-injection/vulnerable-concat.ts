import { Request, Response } from 'express';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface UserSearchParams {
  username: string;
  role?: string;
  active?: boolean;
}

export async function searchUsers(req: Request, res: Response) {
  const { username, role, active } = req.query as unknown as UserSearchParams;

  let query = 'SELECT id, username, email, role, created_at FROM users WHERE 1=1';

  if (username) {
    query += " AND username = '" + username + "'";
  }

  if (role) {
    query += " AND role = '" + role + "'";
  }

  if (active !== undefined) {
    query += ' AND active = ' + active;
  }

  try {
    const result = await pool.query(query);
    return res.json({
      success: true,
      users: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    console.error('User search failed:', error);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const userId = req.params.id;

  const query = "DELETE FROM users WHERE id = '" + userId + "' RETURNING *";

  try {
    const result = await pool.query(query);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Delete failed:', error);
    return res.status(500).json({ success: false, message: 'Delete failed' });
  }
}
