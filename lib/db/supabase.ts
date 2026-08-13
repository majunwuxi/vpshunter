import {
  createClient,
  type SupabaseClient
} from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;
let anon: SupabaseClient | null = null;

function requireEnv(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    return '';
  }

  return value;
}

export function getSupabaseAdmin() {
  if (admin) return admin;

  const url =
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL'
    );

  const secret =
    requireEnv(
      'SUPABASE_SECRET_KEY'
    );

  if (!url || !secret) {
    return null;
  }

  admin = createClient(
    url,
    secret,
    {
      auth: {
        persistSession: false
      }
    }
  );

  return admin;
}

export function isDbConfigured() {
  return Boolean(
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL'
    ) &&
      requireEnv(
        'SUPABASE_SECRET_KEY'
      )
  );
}

export function getSupabaseAnon() {
  if (anon) return anon;

  const url =
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL'
    );

  const key =
    requireEnv(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );

  if (!url || !key) {
    return null;
  }

  anon = createClient(
    url,
    key
  );

  return anon;
}