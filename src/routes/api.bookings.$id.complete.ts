import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { completeBooking } from "@/lib/booking-core";

export const Route = createFileRoute("/api/bookings/$id/complete")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const result = await completeBooking(user, params.id);
          if (result.error) {
            return Response.json({ error: result.error }, { status: 400 });
          }
          return Response.json({ booking: result.booking });
        } catch (err) {
          console.error("Complete booking error:", err);
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
      },
    },
  },
});
