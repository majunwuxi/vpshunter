import { getSupabaseAdmin } from '@/lib/db/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  defaultRules,
  type MonitorRules,
  type MonitorRulesInput,
  rulesFromInput
} from '@/lib/rules/types';

export interface RulesRow {
  id: number;
  preferred_regions: string[];
  min_vcpu: number;
  min_ram_mb: number;
  min_storage_gb: number;
  require_solid_state: boolean;
  require_dedicated_ipv4: boolean;
  standard_max_usd_year: number;
  rdns_max_usd_year: number;
  price_buffer_usd: number;
}

export function rowToRules(
  row: RulesRow
): MonitorRules {
  return {
    preferredRegions:
      row.preferred_regions ?? [],
    hardware: {
      minVcpu: row.min_vcpu,
      minRamMb: row.min_ram_mb,
      minStorageGb: row.min_storage_gb,
      requireSolidState:
        row.require_solid_state,
      requireDedicatedIpv4:
        row.require_dedicated_ipv4
    },
    pricing: {
      standardMaxUsdYear:
        row.standard_max_usd_year,
      rdnsMaxUsdYear:
        row.rdns_max_usd_year
    },
    priceBufferUsd:
      row.price_buffer_usd
  };
}

function rulesToRow(
  rules: MonitorRules
): Omit<RulesRow, 'id'> {
  return {
    preferred_regions:
      rules.preferredRegions,
    min_vcpu:
      rules.hardware.minVcpu,
    min_ram_mb:
      rules.hardware.minRamMb,
    min_storage_gb:
      rules.hardware.minStorageGb,
    require_solid_state:
      rules.hardware.requireSolidState,
    require_dedicated_ipv4:
      rules.hardware.requireDedicatedIpv4,
    standard_max_usd_year:
      rules.pricing.standardMaxUsdYear,
    rdns_max_usd_year:
      rules.pricing.rdnsMaxUsdYear,
    price_buffer_usd:
      rules.priceBufferUsd
  };
}

let cached: MonitorRules | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Loads the current rules. Uses the provided client, or the admin client,
 * or falls back to the static config when unavailable. Cached briefly.
 *
 * @param client optional Supabase client (e.g. the server auth client on the
 *               dashboard); defaults to the admin client.
 */
export async function loadRules(
  client?: SupabaseClient | null
): Promise<MonitorRules> {
  if (
    cached &&
    Date.now() - cachedAt < CACHE_TTL_MS
  ) {
    return cached;
  }

  const admin =
    client ?? getSupabaseAdmin();

  if (!admin) {
    cached = defaultRules();
    cachedAt = Date.now();
    return cached;
  }

  const { data, error } =
    await admin
      .from('monitor_rules')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

  if (error || !data) {
    cached = defaultRules();
    cachedAt = Date.now();
    return cached;
  }

  cached = rowToRules(
    data as unknown as RulesRow
  );
  cachedAt = Date.now();

  return cached;
}

/**
 * Updates the stored rules. Returns the new rules, or the current
 * rules if the update failed.
 */
export async function updateRules(
  input: MonitorRulesInput
): Promise<{
  rules: MonitorRules;
  error?: string;
}> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return {
      rules: defaultRules(),
      error:
        'Supabase not configured'
    };
  }

  const current =
    await loadRules();

  const next =
    rulesFromInput(input, current);

  const { error } = await admin
    .from('monitor_rules')
    .update({
      ...rulesToRow(next),
      updated_at: new Date()
        .toISOString()
    })
    .eq('id', 1);

  if (error) {
    return {
      rules: current,
      error: error.message
    };
  }

  cached = next;
  cachedAt = Date.now();

  return { rules: next };
}