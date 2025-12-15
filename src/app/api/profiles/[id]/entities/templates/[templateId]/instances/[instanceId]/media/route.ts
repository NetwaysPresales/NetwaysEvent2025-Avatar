/**
 * Entity Media Upload API Route (under template/instance)
 * 
 * NOTE: This route is disabled - entityTemplate and entityInstance models were removed
 * Use /api/profiles/[id]/entities/[entityId]/media instead
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is no longer supported. Use /api/profiles/[id]/entities/[entityId]/media instead.' },
    { status: 501 }
  );
}
