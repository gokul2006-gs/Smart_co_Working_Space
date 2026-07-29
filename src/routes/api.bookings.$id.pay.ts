import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { z } from "zod";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { connectDB } from "@/lib/db";
import { BookingModel, toBookingDTO } from "@/models/Booking";
import { SpaceModel } from "@/models/Space";
import { UserModel } from "@/models/User";
import { notifyPaymentReceived } from "@/lib/email";

const schema = z.object({
  paymentReference: z.string().min(1, "Payment reference is required"),
});

export const Route = createFileRoute("/api/bookings/$id/pay")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const body = await request.json();
          const { paymentReference } = schema.parse(body);

          await connectDB();
          const booking = await BookingModel.findOne({ bookingId: params.id });
          if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

          if (booking.memberId !== user.userId && user.role !== "admin") {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          // Only allowed when booking is confirmed (manual) and unpaid
          if (booking.status !== "confirmed" || booking.paymentProvider !== "manual") {
            return Response.json(
              { error: "This booking does not require manual payment confirmation" },
              { status: 400 },
            );
          }

          if (booking.paymentStatus === "paid") {
            return Response.json({ booking: toBookingDTO(booking.toObject()) });
          }

          booking.paymentStatus = "paid";
          booking.paymentReference = paymentReference;
          booking.paymentId = paymentReference;
          await booking.save();

          // Release seats — manual bookings didn't deduct until now? No — seats are
          // deducted on accept. Just keep the record clean.
          const dto = toBookingDTO(booking.toObject());

          // Notify owner + admins
          const admins = await UserModel.find({ role: "admin" }).lean();
          const adminEmails = admins.map((a) => a.email);
          notifyPaymentReceived(dto, adminEmails);

          return Response.json({ booking: dto });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Invalid request";
          return Response.json({ error: msg }, { status: 400 });
        }
      },
    },
  },
});
