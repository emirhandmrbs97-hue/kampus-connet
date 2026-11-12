import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

const invalidCredentials = () =>
  Response.json({ error: 'Kullanıcı adı veya şifre hatalı.' }, { status: 401, headers: corsHeaders });

function getServiceRoleKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!secretKeys) return undefined;
  try {
    const keys: unknown = JSON.parse(secretKeys);
    if (typeof keys === 'object' && keys !== null && 'default' in keys && typeof keys.default === 'string') {
      return keys.default;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getServiceRoleKey();
  const publicKey = request.headers.get('apikey');
  if (!supabaseUrl || !serviceRoleKey || !publicKey) {
    console.error('[login-with-username] Required Supabase configuration is missing.');
    return Response.json({ error: 'Login service is not configured.' }, { status: 500, headers: corsHeaders });
  }

  let username: string;
  let password: string;
  try {
    const body = await request.json();
    username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400, headers: corsHeaders });
  }

  if (!/^[a-z0-9._]{3,20}$/.test(username) || password.length === 0 || password.length > 128) {
    return invalidCredentials();
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (profileError) {
      console.error('[login-with-username] Username lookup failed:', profileError.message);
      return Response.json({ error: 'Login service temporarily unavailable.' }, { status: 500, headers: corsHeaders });
    }
    if (!profile) return invalidCredentials();

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData.user?.email) return invalidCredentials();

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userData.user.email, password }),
    });
    if (!authResponse.ok) {
      if (authResponse.status === 429) {
        return Response.json({ error: 'Too many login attempts.' }, { status: 429, headers: corsHeaders });
      }
      return invalidCredentials();
    }

    const session = await authResponse.json();
    return Response.json(
      { access_token: session.access_token, refresh_token: session.refresh_token },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('[login-with-username] Authentication request failed:', error);
    return Response.json({ error: 'Login service temporarily unavailable.' }, { status: 500, headers: corsHeaders });
  }
});
