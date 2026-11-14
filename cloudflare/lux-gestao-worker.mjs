// Cloudflare Worker for the production Lux-Gestão route.
// The public preview is the deployable source of truth; this Worker serves it
// under /lux-gestao without moving the store, online-orders, or intelligence routes.

const APP_SOURCE_PATH = "/previa/lux-gestao/";
const APP_ROUTES = new Set(["/lux-gestao/", "/lux-gestao/index.html"]);
const ROBOTS = "noindex, nofollow, noarchive, nosnippet";
const VERSION = "2026-11-11.1";

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
      // This path is deliberately outside the Worker routes, so it resolves
      // to the GitHub Pages origin instead of invoking this Worker recursively.
      const sourceUrl = new URL(request.url);
      sourceUrl.pathname = APP_SOURCE_PATH;

      let sourceResponse;
      try {
        sourceResponse = await fetch(sourceUrl.toString(), {
          method: request.method,
          headers: { Accept: request.headers.get("Accept") || "text/html" }
        });
      } catch {
        return textResponse("Lux-Gestão temporariamente indisponível. Tente novamente em instantes.", 502);
      }

      if (!sourceResponse.ok) {
        return textResponse("Não foi possível carregar a versão publicada do Lux-Gestão.", 503);
      }

      const headers = privateHeaders(sourceResponse.headers);
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(request.method === "HEAD" ? null : sourceResponse.body, {
        status: 200,
        headers
      });
    }

    // Keep the existing ASSETS binding available for any future route-local
    // static files, while the app itself is served from the versioned Pages source.
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
