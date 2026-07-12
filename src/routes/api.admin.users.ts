import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { adminCreateUser, adminCreateUserSchema, getSessionFromCookieHeader } from "@/lib/auth-core";
import { getAdminStats, getAllUsers } from "@/lib/booking-core";

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user || user.role !== "admin") {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        try {
          const [users, stats] = await Promise.all([getAllUsers(), getAdminStats()]);
          return Response.json({ users, stats });
        } catch (err) {
          console.error("Admin users GET error:", err);
          return Response.json({ error: "Failed to load admin data" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user || user.role !== "admin") {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        try {
          const body = await request.json();
          const data = adminCreateUserSchema.parse(body);
          const result = await adminCreateUser(data);
          if (result.error) {
            return Response.json({ error: result.error }, { status: 400 });
          }
          return Response.json({ user: result.user }, { status: 201 });
        } catch (err) {
          console.error("Admin create user error:", err);
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
      },
    },
  },
});
