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
          return Response.json({ error: "Invalid login request" }, { status: 400 });
        }
      },
    },
  },
});
