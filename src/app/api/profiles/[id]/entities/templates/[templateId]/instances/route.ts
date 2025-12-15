/**
 * Entity Instances API Routes (under template)
 * 
 * NOTE: These routes are disabled - entityTemplate and entityInstance models were removed
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint is no longer supported.' },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is no longer supported.' },
    { status: 501 }
  );
}
