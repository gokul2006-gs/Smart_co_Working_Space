import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { authSuccessResponse, registerSchema, registerUser } from "@/lib/auth-core";

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const data = registerSchema.parse(body);
          const result = await registerUser(data);
          return authSuccessResponse(result);
        } catch (err) {
          console.error("Register API error:", err);
          const message = err instanceof Error ? err.message : "Invalid registration request";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
