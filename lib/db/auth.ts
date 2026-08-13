import {
  createClient,
  type SupabaseClient
} from '@supabase/supabase-js';

let browserClient:
  | SupabaseClient
  | null = null;

/**
 * Browser-context Supabase client that persists the auth session
 * (localStorage). Used by login/register pages and the dashboard.
 * Returns null when Supabase is not configured.
 */
export function getSupabaseBrowser() {
  if (browserClient) {
    return browserClient;
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  browserClient = createClient(
    url,
    key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    }
  );

  return browserClient;
}

export type UserRole =
  | 'admin'
  | 'user'
  | 'pending';

/**
 * Reads the caller's role from the profiles table using the current
 * auth session. Returns null when unauthenticated or Supabase is off.
 */
export async function getCurrentRole(): Promise<
  UserRole | null
> {
  const client = getSupabaseBrowser();

  if (!client) {
    return null;
  }

  const {
    data: { session }
  } = await client.auth.getSession();

  if (!session) {
    return null;
  }

  const { data } = await client
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  return (
    (data?.role as UserRole) ??
    null
  );
}

export async function getSessionUser() {
  const client = getSupabaseBrowser();

  if (!client) {
    return null;
  }

  const {
    data: { session }
  } = await client.auth.getSession();

  return session?.user ?? null;
}

export async function signIn(
  email: string,
  password: string
) {
  const client = getSupabaseBrowser();

  if (!client) {
    throw new Error(
      'Supabase not configured'
    );
  }

  return client.auth.signInWithPassword({
    email,
    password
  });
}

export async function signUp(
  email: string,
  password: string
) {
  const client = getSupabaseBrowser();

  if (!client) {
    throw new Error(
      'Supabase not configured'
    );
  }

  return client.auth.signUp({
    email,
    password,
    options: {
      data: { email }
    }
  });
}

export async function signOut() {
  const client = getSupabaseBrowser();

  if (!client) {
    return;
  }

  await client.auth.signOut();
}