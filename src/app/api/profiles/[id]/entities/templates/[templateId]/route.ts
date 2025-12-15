/**
 * Entity Template API Routes (Single Template)
 * 
 * NOTE: These routes are disabled - entityTemplate model was removed
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint is no longer supported.' },
    { status: 501 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'This endpoint is no longer supported.' },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'This endpoint is no longer supported.' },
    { status: 501 }
  );
}
