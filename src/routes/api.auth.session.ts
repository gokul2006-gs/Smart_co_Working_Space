import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionFromCookieHeader } from "@/lib/auth-core";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        return Response.json({
          authenticated: Boolean(user),
          user,
        });
      },
    },
  },
});
