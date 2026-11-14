// Cloudflare Worker for the production Lux-Gestão route.
// The HTML source is fetched from a fixed, public GitHub Raw URL so the
// preview path can be protected by Cloudflare Access without breaking this Worker.

const APP_SOURCE_URL = "https://raw.githubusercontent.com/ihbiondo/Luxuriosa/main/previa/lux-gestao/index.html";
const APP_ROUTES = new Set(["/lux-gestao/", "/lux-gestao/index.html"]);
const ROBOTS = "noindex, nofollow, noarchive, nosnippet";
const VERSION = "2026-11-14.3";

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
      // Use the canonical host and discard query parameters to avoid an
      // attacker-controlled host or query value in the redirect destination.
      return Response.redirect("https://luxuriosa.com.br/lux-gestao/", 308);
    }

    if (APP_ROUTES.has(path)) {
      let sourceResponse;
      try {
        // Fixed origin: never derive the upstream host/path from user input.
        // Redirects are rejected to avoid silently following an unexpected host.
        sourceResponse = await fetch(APP_SOURCE_URL, {
          method: request.method,
          redirect: "error",
          headers: {
            Accept: request.headers.get("Accept") || "text/html"
          }
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
