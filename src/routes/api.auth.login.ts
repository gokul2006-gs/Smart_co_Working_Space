import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { authSuccessResponse, loginSchema, loginUser } from "@/lib/auth-core";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const data = loginSchema.parse(body);
          const result = await loginUser(data);
          return authSuccessResponse(result);
        } catch (err) {
          console.error("Login API error:", err);
          // Return the actual error message so the UI can display it
          const message = err instanceof Error ? err.message : "Invalid login request";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
