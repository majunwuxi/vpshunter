import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/db/server';
import { getSupabaseAdmin } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

/**
 * Approves or rejects a pending user.
 * Only admins may call this. The update runs with the service-role key
 * (bypasses RLS), so the caller's admin role is verified server-side first.
 */
export async function POST(
  request: Request
) {
  const session =
    await getServerSession();

  if (
    !session ||
    session.role !== 'admin'
  ) {
    return Response.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  const url = new URL(
    request.url
  );

  const userId =
    url.searchParams.get(
      'userId'
    );

  const action =
    url.searchParams.get('action');

  if (!userId || !action) {
    return Response.json(
      { error: 'Missing params' },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  if (!admin) {
    return Response.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  if (action === 'approve') {
    const { error } = await admin
      .from('profiles')
      .update({
        role: 'user',
        approved_at: new Date()
          .toISOString()
      })
      .eq('id', userId);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      { ok: true, action: 'approved' }
    );
  }

  if (action === 'reject') {
    // Delete the profile and the auth user (service role can do this).
    const { error } = await admin
      .auth.admin.deleteUser(userId);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      { ok: true, action: 'rejected' }
    );
  }

  return Response.json(
    { error: 'Unknown action' },
    { status: 400 }
  );
}

export async function GET() {
  redirect('/admin');
}