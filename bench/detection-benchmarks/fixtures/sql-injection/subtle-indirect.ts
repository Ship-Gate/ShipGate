import { Request, Response } from 'express';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function buildSortClause(sortField: string, sortDir: string): string {
  return `ORDER BY ${sortField} ${sortDir}`;
}

function buildFilterCondition(field: string, value: string): string {
  return `${field} = '${value}'`;
}

function buildSearchCondition(field: string, term: string): string {
  const escapedTerm = term.replace(/'/g, "''");
  return `${field} LIKE '%${escapedTerm}%'`;
}

interface ReportParams {
  startDate?: string;
  endDate?: string;
  department?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
  search?: string;
}

export async function generateReport(req: Request, res: Response) {
  const params = req.body as ReportParams;

  const conditions: string[] = ['1=1'];

  if (params.startDate) {
    conditions.push(buildFilterCondition('created_at >=', params.startDate));
  }

  if (params.endDate) {
    conditions.push(buildFilterCondition('created_at <=', params.endDate));
  }

  if (params.department) {
    conditions.push(buildFilterCondition('department', params.department));
  }

  if (params.status) {
    conditions.push(buildFilterCondition('status', params.status));
  }

  if (params.search) {
    conditions.push(buildSearchCondition('description', params.search));
  }

  const whereClause = conditions.join(' AND ');
  const sort = buildSortClause(
    params.sortBy ?? 'created_at',
    params.sortDir ?? 'DESC',
  );

  const query = `
    SELECT
      t.id,
      t.title,
      t.description,
      t.department,
      t.status,
      t.priority,
      t.created_at,
      u.username as assigned_to
    FROM tickets t
    LEFT JOIN users u ON t.assigned_user_id = u.id
    WHERE ${whereClause}
    ${sort}
    LIMIT 100
  `;

  try {
    const result = await pool.query(query);

    const summary = {
      total: result.rowCount,
      byStatus: groupBy(result.rows, 'status'),
      byDepartment: groupBy(result.rows, 'department'),
    };

    return res.json({
      success: true,
      tickets: result.rows,
      summary,
    });
  } catch (error) {
    console.error('Report generation failed:', error);
    return res.status(500).json({ success: false, message: 'Report failed' });
  }
}

function groupBy(
  rows: Record<string, unknown>[],
  key: string,
): Record<string, number> {
  return rows.reduce(
    (acc, row) => {
      const val = String(row[key] ?? 'unknown');
      acc[val] = (acc[val] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
