import { getSupabaseAdmin } from '@/lib/db/supabase';

function db() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw new Error(
      'Supabase admin env not configured'
    );
  }

  return client;
}

export interface MonitorRunResult {
  providersChecked: number;
  offersFound: number;
  offersQualified: number;
  notificationsSent: number;
  providerStats: Record<string, unknown>;
}

export async function startMonitorRun() {
  const { data, error } =
    await db()
      .from('monitor_runs')
      .insert({
        status: 'running'
      })
      .select('id')
      .single();

  if (error) {
    throw new Error(
      `monitor_runs start: ${error.message}`
    );
  }

  return data.id as string;
}

export async function finishMonitorRun(
  runId: string,
  result: MonitorRunResult
) {
  const { error } =
    await db()
      .from('monitor_runs')
      .update({
        finished_at: new Date()
          .toISOString(),
        providers_checked:
          result.providersChecked,
        offers_found:
          result.offersFound,
        offers_qualified:
          result.offersQualified,
        notifications_sent:
          result.notificationsSent,
        provider_stats:
          result.providerStats,
        status: 'success'
      })
      .eq('id', runId);

  if (error) {
    throw new Error(
      `monitor_runs finish: ${error.message}`
    );
  }
}

export async function failMonitorRun(
  runId: string,
  error: Error
) {
  await db()
    .from('monitor_runs')
    .update({
      finished_at: new Date()
        .toISOString(),
      status: 'failed',
      error: error.message
    })
    .eq('id', runId);
}
