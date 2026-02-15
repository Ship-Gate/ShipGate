import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function verifyAuth(request: Request): string {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    throw new UnauthorizedError();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    return (decoded as { userId: string }).userId;
  } catch {
    throw new UnauthorizedError();
  }
}

class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED');
    Object.setPrototypeOf(this, new.target.prototype);
  }
}