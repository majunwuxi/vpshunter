import { getServerSession, getServerClient } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session =
    await getServerSession();

  if (!session) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const supabase =
    await getServerClient();

  if (!supabase) {
    return Response.json(
      {
        error:
          'Supabase not configured'
      },
      { status: 500 }
    );
  }

  const { data, error } =
    await supabase
      .from('plans')
      .select(
        'id, provider_id, name, location, cpu, ram_mb, storage_gb, storage_type, ipv4_count, dedicated_ipv4, price_usd_year, rdns_supported, verification_level, last_verified_at, available'
      )
      .eq('available', true)
      .order(
        'price_usd_year',
        { ascending: true }
      );

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return Response.json({
    plans: data
  });
}