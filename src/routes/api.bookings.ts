import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import {
  acceptBookingSchema,
  createBooking,
  createBookingSchema,
  getAllBookings,
  getMemberBookings,
  getOwnerBookings,
} from "@/lib/booking-core";

function requireSession(request: Request) {
  const user = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!user) return null;
  return user;
}

export const Route = createFileRoute("/api/bookings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = requireSession(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          if (user.role === "admin") {
            const bookings = await getAllBookings();
            return Response.json({ bookings });
          }
          if (user.role === "space_owner") {
            const bookings = await getOwnerBookings(user.userId);
            return Response.json({ bookings });
          }
          const bookings = await getMemberBookings(user.userId);
          return Response.json({ bookings });
        } catch (err) {
          console.error("Get bookings error:", err);
          return Response.json({ error: "Failed to load bookings" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        const user = requireSession(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const body = await request.json();
          const data = createBookingSchema.parse(body);
          const result = await createBooking(user, data);
          if (result.error) {
            return Response.json({ error: result.error }, { status: 400 });
          }
          return Response.json({ booking: result.booking }, { status: 201 });
        } catch (err) {
          console.error("Create booking error:", err);
          return Response.json({ error: "Invalid booking request" }, { status: 400 });
        }
      },
    },
  },
});
