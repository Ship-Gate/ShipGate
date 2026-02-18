import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Line 18: ISSUE - missing-auth, no authentication or authorization
    const { id } = params;
    
    // Delete logic here
    return NextResponse.json({ message: 'Todo deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
