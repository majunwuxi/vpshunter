import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { UserRole } from '@/lib/db/auth';

/**
 * Server-side Supabase client that reads the auth session from cookies.
 * Used by server components (dashboard guard, admin page).
 */
export async function getServerClient() {
  const cookieStore = await cookies();

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) =>
                cookieStore.set(
                  name,
                  value,
                  options
                )
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        }
      }
    }
  );
}

export interface ServerSession {
  userId: string;
  email: string | null;
  role: UserRole | null;
}

/**
 * Returns the logged-in user and their role from the server.
 * role is null when the profile row is missing (e.g. legacy user).
 */
export async function getServerSession(): Promise<
  ServerSession | null
> {
  const supabase =
    await getServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email:
      (data?.email as string) ??
      user.email ??
      null,
    role:
      (data?.role as UserRole) ??
      null
  };
}