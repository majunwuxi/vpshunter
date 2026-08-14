import { getServerSession, getServerClient } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session =
    await getServerSession();

  const client =
    await getServerClient();

  let profileCheck:
    | string
    | null = null;

  if (client && session) {
    const { data, error } =
      await client
        .from('profiles')
        .select('id, email, role')
        .eq('id', session.userId)
        .maybeSingle();

    profileCheck =
      error
        ? `ERR ${error.message}`
        : JSON.stringify(data);
  }

  return Response.json({
    session: session
      ? {
          userId:
            session.userId,
          email:
            session.email,
          role:
            session.role
        }
      : null,
    profileCheck
  });
}