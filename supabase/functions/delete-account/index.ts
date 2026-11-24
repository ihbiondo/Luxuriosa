import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins = new Set([
  "https://luxuriosa.com.br",
  "https://www.luxuriosa.com.br",
  "http://localhost:8000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://luxuriosa.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function readJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, origin);
  if (!origin || !allowedOrigins.has(origin)) return json({ error: "Origem não autorizada." }, 403, origin);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || "")) {
    return json({ error: "Formato de requisição inválido." }, 415, origin);
  }

  const authorization = req.headers.get("Authorization") || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return json({ error: "Sessão não identificada. Entre novamente." }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4096) {
      return json({ error: "Solicitação muito grande." }, 413, origin);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Solicitação inválida." }, 400, origin);
  }

  if (body.confirmation !== "EXCLUIR") {
    return json({ error: "Confirme digitando EXCLUIR." }, 400, origin);
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 256) return json({ error: "Confirmação inválida." }, 400, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Configuração obrigatória ausente para delete-account.");
    return json({ error: "Serviço temporariamente indisponível." }, 503, origin);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(tokenMatch[1]);
  const user = authData.user;
  if (authError || !user?.id || !user.email) {
    return json({ error: "Sessão inválida ou expirada. Entre novamente." }, 401, origin);
  }

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const hasGoogleIdentity = user.app_metadata?.provider === "google" ||
    identities.some((identity) => identity.provider === "google");

  if (password) {
    // Se o cliente optar por senha, ela é validada no servidor.
    const { data: verified, error: passwordError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (passwordError || verified.user?.id !== user.id) {
      return json({ error: "Senha incorreta. A conta não foi alterada." }, 403, origin);
    }
  } else if (hasGoogleIdentity) {
    // JWT validado pelo Auth; exige autenticação recente para contas Google sem senha.
    const claims = readJwtClaims(tokenMatch[1]);
    const authenticationMethods = Array.isArray(claims?.amr) ? claims.amr : [];
    const oauthAuthTime = authenticationMethods.reduce((latest, entry) => {
      if (!entry || typeof entry !== "object") return latest;
      const method = entry as Record<string, unknown>;
      if (typeof method.method !== "string" || !method.method.startsWith("oauth")) return latest;
      const timestamp = Number(method.timestamp);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
    const authTime = oauthAuthTime || Number(claims?.auth_time);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(authTime) || authTime > now + 60 || now - authTime > 600) {
      return json({
        error: "Por segurança, saia da conta e entre novamente com Google antes de solicitar a exclusão.",
      }, 403, origin);
    }
  } else {
    return json({ error: "Informe sua senha atual para confirmar sua identidade." }, 400, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { error: revokeError } = await adminClient.auth.admin.signOut(tokenMatch[1]);
  if (revokeError) {
    console.error("Falha ao revogar sessões antes da exclusão:", revokeError.message);
    return json({ error: "Não foi possível encerrar as sessões ativas. A conta não foi excluída." }, 500, origin);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    console.error("Falha administrativa ao excluir conta:", deleteError.message);
    return json({ error: "Não foi possível concluir a exclusão. Entre em contato com o atendimento." }, 500, origin);
  }

  return json({ success: true }, 200, origin);
});
