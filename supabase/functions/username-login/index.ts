const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = request.headers.get('apikey');
  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    return jsonResponse({ error: 'Giriş servisi yapılandırılmamış.' }, 500);
  }

  let input: { username?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'Geçersiz istek.' }, 400);
  }

  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!/^[a-z0-9._]{3,20}$/.test(username) || password.length === 0 || password.length > 256) {
    return jsonResponse({ error: 'Kullanıcı adı veya şifre hatalı.' }, 401);
  }

  try {
    const profilesUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
    profilesUrl.searchParams.set('select', 'id');
    profilesUrl.searchParams.set('username', `eq.${username}`);
    profilesUrl.searchParams.set('limit', '1');
    const profileResponse = await fetch(profilesUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!profileResponse.ok) {
      console.error('Username login profile lookup failed:', profileResponse.status);
      return jsonResponse({ error: 'Giriş şu anda tamamlanamıyor.' }, 500);
    }
    const profiles = (await profileResponse.json()) as { id: string }[];
    if (!profiles[0]) return jsonResponse({ error: 'Kullanıcı adı veya şifre hatalı.' }, 401);

    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(profiles[0].id)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!userResponse.ok) {
      console.error('Username login user lookup failed:', userResponse.status);
      return jsonResponse({ error: 'Giriş şu anda tamamlanamıyor.' }, 500);
    }
    const userResult = (await userResponse.json()) as { email?: string; user?: { email?: string } };
    const email = userResult.email ?? userResult.user?.email;
    if (!email) return jsonResponse({ error: 'Kullanıcı adı veya şifre hatalı.' }, 401);

    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const tokenResult = (await tokenResponse.json()) as {
      code?: string;
      error?: string;
      error_code?: string;
      error_description?: string;
      message?: string;
      msg?: string;
    };
    if (!tokenResponse.ok) {
      const errorCode = tokenResult.code ?? tokenResult.error_code ?? tokenResult.error;
      const errorMessage = tokenResult.error_description ?? tokenResult.message ?? tokenResult.msg ?? '';
      if (errorCode === 'email_not_confirmed' || /email not confirmed/i.test(errorMessage)) {
        return jsonResponse({ error: 'E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.' }, 401);
      }
      if (tokenResponse.status === 429) {
        return jsonResponse({ error: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.' }, 429);
      }
      return jsonResponse({ error: 'Kullanıcı adı veya şifre hatalı.' }, 401);
    }
    return jsonResponse(tokenResult);
  } catch (error) {
    console.error('Username login request failed:', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse({ error: 'Giriş şu anda tamamlanamıyor.' }, 500);
  }
});
