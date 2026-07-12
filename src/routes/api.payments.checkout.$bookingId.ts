import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { connectDB } from "@/lib/db";
import { BookingModel } from "@/models/Booking";
import { createPaymentSession } from "@/lib/payment.server";
import { isPaymentGatewayEnabled } from "@/lib/payment";

export const Route = createFileRoute("/api/payments/checkout/$bookingId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        if (!isPaymentGatewayEnabled()) {
          return Response.json(
            {
              error:
                "Payment gateway is disabled. Manual/demo mode is active, so bookings are confirmed with owner-provided instructions instead of checkout.",
            },
            { status: 400 },
          );
        }

        try {
          await connectDB();
          const booking = await BookingModel.findOne({ bookingId: params.bookingId });
          if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

          const isMember = booking.memberId === user.userId;
          const isAdmin = user.role === "admin";
          if (!isMember && !isAdmin) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          if (booking.status !== "awaiting_payment") {
            return Response.json({ error: "This booking is not awaiting payment" }, { status: 400 });
          }

          if (booking.paymentUrl) {
            return Response.json({
              paymentUrl: booking.paymentUrl,
              provider: booking.paymentProvider,
            });
          }

          const { toBookingDTO } = await import("@/models/Booking");
          const session = await createPaymentSession(toBookingDTO(booking.toObject()));
          booking.paymentUrl = session.paymentUrl;
          booking.paymentSessionId = session.sessionId;
          booking.paymentProvider = session.provider;
          await booking.save();

          return Response.json({
            paymentUrl: session.paymentUrl,
            provider: session.provider,
          });
        } catch (err) {
          console.error("Checkout error:", err);
          return Response.json({ error: "Failed to create payment session" }, { status: 500 });
        }
      },
    },
  },
});
