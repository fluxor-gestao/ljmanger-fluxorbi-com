// Catch-all for /api/public/* to ensure unmatched API paths return JSON
// (not the SPA's HTML 404 shell). External clients like Power BI need
// `Content-Type: application/json` even on errors.
import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, jsonResponse } from "@/lib/bi-auth.server";

function notFoundJson({ params }: { params: { _splat?: string } }) {
  return jsonResponse(
    {
      error: "Not found",
      path: `/api/public/${params._splat ?? ""}`,
      hint: "Available: bi-comercial, bi-financeiro, bi-operacao, bi-kpis-comercial, bi-kpis-financeiro, bi-kpis-operacao.",
    },
    404,
  );
}

export const Route = createFileRoute("/api/public/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: notFoundJson,
      POST: notFoundJson,
      PUT: notFoundJson,
      DELETE: notFoundJson,
      PATCH: notFoundJson,
    },
  },
});
