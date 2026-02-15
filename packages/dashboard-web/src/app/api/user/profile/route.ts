import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return NextResponse.json({ user: decoded });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
