import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizeEmail, PLATFORM_ADMIN_EMAIL } from '@/lib/access-control';

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  console.error('[Admin Accounts] Error:', error);
  return NextResponse.json({ error: 'Account operation failed' }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();
    const accounts = await db.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const email = normalizeEmail(String(body?.email || ''));
    const name = String(body?.name || '').trim() || null;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    const adminAccount = await db.user.findUnique({ where: { email: PLATFORM_ADMIN_EMAIL }, select: { passwordHash: true } });
    if (!adminAccount?.passwordHash) throw new Error('Administrator password is not initialized');
    const account = await db.user.upsert({
      where: { email },
      create: {
        email,
        name,
        role: email === PLATFORM_ADMIN_EMAIL ? 'ADMIN' : 'USER',
        isActive: true,
        passwordHash: adminAccount.passwordHash,
      },
      update: {
        ...(name ? { name } : {}),
        role: email === PLATFORM_ADMIN_EMAIL ? 'ADMIN' : 'USER',
        isActive: true,
        passwordHash: adminAccount.passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const id = String(body?.id || '');
    const isActive = body?.isActive;
    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Account id and active state are required' }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (existing.email === PLATFORM_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'The platform administrator cannot be disabled' }, { status: 400 });
    }
    const account = await db.user.update({
      where: { id },
      data: { isActive, role: 'USER' },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}
