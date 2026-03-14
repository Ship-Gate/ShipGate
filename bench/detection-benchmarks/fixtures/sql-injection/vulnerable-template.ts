import { Request, Response } from 'express';
import mysql from 'mysql2/promise';

const connectionConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'app',
};

interface ProductFilter {
  name?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  order?: 'ASC' | 'DESC';
}

export async function getProducts(req: Request, res: Response) {
  const filter = req.query as unknown as ProductFilter;
  const connection = await mysql.createConnection(connectionConfig);

  try {
    let whereClause = 'WHERE deleted_at IS NULL';

    if (filter.name) {
      whereClause += ` AND name LIKE '%${filter.name}%'`;
    }

    if (filter.category) {
      whereClause += ` AND category = '${filter.category}'`;
    }

    if (filter.minPrice) {
      whereClause += ` AND price >= ${filter.minPrice}`;
    }

    if (filter.maxPrice) {
      whereClause += ` AND price <= ${filter.maxPrice}`;
    }

    const sortColumn = filter.sortBy ?? 'created_at';
    const sortOrder = filter.order ?? 'DESC';

    const query = `
      SELECT id, name, category, price, stock_count, image_url, created_at
      FROM products
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT 50
    `;

    const [rows] = await connection.execute(query);

    return res.json({
      success: true,
      products: rows,
    });
  } catch (error) {
    console.error('Product query failed:', error);
    return res.status(500).json({ success: false, message: 'Query failed' });
  } finally {
    await connection.end();
  }
}

export async function getProductReviews(req: Request, res: Response) {
  const { productId } = req.params;
  const { rating } = req.query;
  const connection = await mysql.createConnection(connectionConfig);

  try {
    const query = `
      SELECT r.id, r.rating, r.comment, r.created_at, u.username
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = '${productId}'
      ${rating ? `AND r.rating = ${rating}` : ''}
      ORDER BY r.created_at DESC
    `;

    const [rows] = await connection.execute(query);
    return res.json({ success: true, reviews: rows });
  } catch (error) {
    console.error('Review query failed:', error);
    return res.status(500).json({ success: false, message: 'Query failed' });
  } finally {
    await connection.end();
  }
}
