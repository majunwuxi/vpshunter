import { getSupabaseAdmin } from '@/lib/db/supabase';
import { matchProviderSlug } from '@/config/providerAliases';

function db() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw new Error(
      'Supabase admin env not configured'
    );
  }

  return client;
}

export interface DiscoveryItem {
  source: string;
  sourceUrl: string;
  title: string;
  providerName: string;
  detectedPrice?: string;
  /** ISO timestamp of the source's last activity (Vanilla LastCommentDate). */
  lastActivityAt?: string;
  /** ISO timestamp of the thread's creation (from the detail page). */
  startedAt?: string;
  /**
   * Official / product URLs extracted from the thread body. These point to
   * the provider's site so a candidate can be verified there.
   */
  officialUrls?: string[];
}

export interface ProcessedLead {
  url: string;
  providerSlug: string | null;
  matched: boolean;
}

/**
 * Upserts discovery leads, resolves known providers via aliases and
 * marks matched leads as processed (linked to a provider adapter).
 */
export async function saveDiscoveryItems(
  items: DiscoveryItem[]
): Promise<ProcessedLead[]> {
  const rows = items.map((item) => ({
    source: item.source,
    source_url: item.sourceUrl,
    title: item.title,
    provider_name: item.providerName,
    detected_price:
      item.detectedPrice ?? null,
    source_activity_at:
      item.lastActivityAt ?? null,
    source_started_at:
      item.startedAt ?? null,
    official_urls:
      item.officialUrls ??
      null
  }));

  const { error } =
    await db()
      .from('discovery_items')
      .upsert(
        rows,
        {
          onConflict: 'source_url'
        }
      );

  if (error) {
    throw new Error(
      `discovery upsert: ${error.message}`
    );
  }

  const { data: providerRows, error: providerError } =
    await db()
      .from('providers')
      .select('id, slug');

  if (providerError) {
    throw new Error(
      `providers fetch: ${providerError.message}`
    );
  }

  const slugToId = new Map<
    string,
    string
  >();

  for (const row of providerRows ?? []) {
    slugToId.set(
      row.slug as string,
      row.id as string
    );
  }

  const processed: ProcessedLead[] = [];

  for (const item of items) {
    const providerSlug =
      matchProviderSlug(
        item.providerName
      );

    const providerId =
      providerSlug
        ? slugToId.get(providerSlug)
        : null;

    if (!providerSlug || !providerId) {
      processed.push({
        url: item.sourceUrl,
        providerSlug,
        matched: false
      });

      continue;
    }

    const { error: updateError } =
      await db()
        .from('discovery_items')
        .update({
          provider_id: providerId,
          processed: true
        })
        .eq(
          'source_url',
          item.sourceUrl
        );

    if (updateError) {
      throw new Error(
        `discovery link: ${updateError.message}`
      );
    }

    processed.push({
      url: item.sourceUrl,
      providerSlug,
      matched: true
    });
  }

  return processed;
}