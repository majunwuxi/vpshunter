import { getSupabaseAdmin } from '@/lib/db/supabase';
import type {
  VpsOffer
} from '@/monitors/types';
import type { Evaluation } from '@/monitors/types';

function db() {
  const client = getSupabaseAdmin();

  if (!client) {
    throw new Error(
      'Supabase admin env not configured'
    );
  }

  return client;
}

async function upsertProvider(
  provider: string
): Promise<string | null> {
  const slug = provider
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data, error } =
    await db()
      .from('providers')
      .upsert(
        { slug, name: provider },
        { onConflict: 'slug' }
      )
      .select('id')
      .single();

  if (error) {
    throw new Error(
      `provider upsert: ${error.message}`
    );
  }

  return data.id;
}

export async function saveOffer(
  offer: VpsOffer
): Promise<{ id: string }> {
  const providerId =
    await upsertProvider(
      offer.provider
    );

  const { data, error } =
    await db()
      .from('plans')
      .upsert(
        {
          provider_id: providerId,
          external_id:
            `${offer.provider}:${offer.planName}:${offer.countryCode}`,
          name: offer.planName,
          location:
            offer.city ?? null,
          cpu: offer.cpu,
          ram_mb: offer.ramMb,
          storage_gb: offer.storageGb,
          storage_type:
            offer.storageType,
          traffic_gb:
            offer.trafficGb ?? null,
          bandwidth_mbps:
            offer.bandwidthMbps ?? null,
          ipv4_count:
            offer.ipv4Count,
          dedicated_ipv4:
            offer.dedicatedIpv4,
          rdns_supported:
            offer.rdnsStatus === 'confirmed'
              ? true
              : offer.rdnsStatus,
          rdns_method:
            offer.rdnsMethod ?? null,
          smtp25_policy:
            offer.smtp25Policy ?? null,
          price: offer.price,
          currency: offer.currency,
          billing_period:
            offer.billingPeriod,
          price_usd_year:
            offer.priceUsdYear,
          order_url:
            offer.orderUrl ?? null,
          product_url:
            offer.productUrl,
          available:
            offer.available,
          verification_level:
            offer.verificationLevel,
          last_verified_at:
            offer.verifiedAt
              .toISOString()
        },
        {
          onConflict: 'external_id'
        }
      )
      .select('id')
      .single();

  if (error) {
    throw new Error(
      `plan upsert: ${error.message}`
    );
  }

  return { id: data.id };
}

export async function recordCheck(
  planId: string,
  offer: VpsOffer,
  evaluation: Evaluation,
  priceUsdYear?: number
) {
  const { error } =
    await db()
      .from('checks')
      .insert({
        plan_id: planId,
        status:
          evaluation.qualified
            ? 'qualified'
            : 'unqualified',
        price_usd_year:
          priceUsdYear ?? offer.priceUsdYear,
        available: offer.available,
        verification_level:
          offer.verificationLevel,
        failure_reason:
          evaluation.reasons.join(', ') ||
          null,
        raw_data: {
          productPage: offer.productUrl,
          orderPage: offer.orderUrl ?? null,
          price: offer.price,
          currency: offer.currency,
          billingPeriod: offer.billingPeriod
        }
      });

  if (error) {
    throw new Error(
      `check insert: ${error.message}`
    );
  }
}

export async function recordPriceHistory(
  planId: string,
  offer: VpsOffer
) {
  const { error } =
    await db()
      .from('price_history')
      .insert({
        plan_id: planId,
        price: offer.price,
        currency: offer.currency,
        price_usd_year:
          offer.priceUsdYear
      });

  if (error) {
    throw new Error(
      `price_history insert: ${error.message}`
    );
  }
}

export async function notificationSeen(
  offerHash: string
): Promise<boolean> {
  const { data, error } =
    await db()
      .from('notifications')
      .select('id')
      .eq(
        'notification_hash',
        offerHash
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `notification lookup: ${error.message}`
    );
  }

  return data !== null;
}

export async function saveNotification(
  planId: string,
  offerHash: string,
  channel = 'email'
) {
  const { error } =
    await db()
      .from('notifications')
      .insert({
        plan_id: planId,
        channel,
        notification_hash: offerHash,
        status: 'sent'
      });

  if (error) {
    if (error.code === '23505') {
      return;
    }

    throw new Error(
      `notification insert: ${error.message}`
    );
  }
}