// Cloudflare Worker for the production Lux-Gestão route.
// The preview source is protected by Cloudflare Access and is fetched with a
// dedicated service token stored only as Worker secrets.

const APP_SOURCE_PATH = "/previa/lux-gestao/";
const APP_ROUTES = new Set(["/lux-gestao/", "/lux-gestao/index.html"]);
const ROBOTS = "noindex, nofollow, noarchive, nosnippet";
const VERSION = "2026-11-14.1";

function privateHeaders(sourceHeaders = undefined) {
  const headers = new Headers(sourceHeaders);
  headers.set("X-Robots-Tag", ROBOTS);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("X-Luxuriosa-Worker-Version", VERSION);
  return headers;
}

function textResponse(message, status) {
  return new Response(message, {
    status,
    headers: privateHeaders({ "Content-Type": "text/plain; charset=utf-8" })
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return textResponse("Method Not Allowed", 405);
    }

    if (path === "/lux-gestao") {
      url.pathname = "/lux-gestao/";
      return Response.redirect(url.toString(), 308);
    }

    if (APP_ROUTES.has(path)) {
      const accessClientId = env?.LUX_ACCESS_SERVICE_TOKEN_CLIENT_ID;
      const accessClientSecret = env?.LUX_ACCESS_SERVICE_TOKEN_CLIENT_SECRET;

      // Fail closed: never fetch a protected origin without the dedicated
      // Cloudflare Access service token.
      if (!accessClientId || !accessClientSecret) {
        return textResponse("Lux-Gestão temporariamente indisponível: proteção de origem não configurada.", 503);
      }

      // The source path is protected by a Cloudflare Access Service Auth policy.
      // These credentials exist only as Cloudflare Worker secrets and are never
      // returned to the browser or written to logs.
      const sourceUrl = new URL(request.url);
      sourceUrl.pathname = APP_SOURCE_PATH;

      let sourceResponse;
      try {
        sourceResponse = await fetch(sourceUrl.toString(), {
          method: request.method,
          headers: {
            Accept: request.headers.get("Accept") || "text/html",
            "CF-Access-Client-Id": accessClientId,
            "CF-Access-Client-Secret": accessClientSecret
          }
        });
      } catch {
        return textResponse("Lux-Gestão temporariamente indisponível. Tente novamente em instantes.", 502);
      }

      if (!sourceResponse.ok) {
        // Do not forward the Access login page, token details, or origin response.
        return textResponse("Não foi possível validar ou carregar a origem protegida do Lux-Gestão.", 503);
      }

      const headers = privateHeaders(sourceResponse.headers);
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(request.method === "HEAD" ? null : sourceResponse.body, {
        status: 200,
        headers
      });
    }

    if (path.startsWith("/lux-gestao/") && env?.ASSETS?.fetch) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = path.slice("/lux-gestao".length) || "/";
      const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), {
        method: request.method,
        headers: request.headers
      }));
      const headers = privateHeaders(assetResponse.headers);
      if ((headers.get("Content-Type") || "").toLowerCase().includes("text/html")) {
        headers.set("Cache-Control", "private, no-store, max-age=0");
      }
      return new Response(request.method === "HEAD" ? null : assetResponse.body, {
        status: assetResponse.status,
        headers
      });
    }

    return textResponse("Not Found", 404);
  }
};
