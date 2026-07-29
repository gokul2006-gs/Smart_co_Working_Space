import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { connectDB } from "@/lib/db";
import { BookingModel, toBookingDTO } from "@/models/Booking";
import { SpaceModel } from "@/models/Space";
import { UserModel } from "@/models/User";
import { notifyPaymentReceived } from "@/lib/email";

export const Route = createFileRoute("/api/payments/confirm/$bookingId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          await connectDB();

          const booking = await BookingModel.findOne({ bookingId: params.bookingId });
          if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

          const isMember = booking.memberId === user.userId;
          const isAdmin = user.role === "admin";
          if (!isMember && !isAdmin) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          // Already confirmed - return current state
          if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
            return Response.json({ booking: toBookingDTO(booking.toObject()) });
          }

          // Only confirm bookings that are awaiting payment
          if (booking.status !== "awaiting_payment") {
            return Response.json({ booking: toBookingDTO(booking.toObject()) });
          }

          // Atomic update - safe to call multiple times
          const updated = await BookingModel.findOneAndUpdate(
            { bookingId: params.bookingId, paymentStatus: { $ne: "paid" } },
            {
              $set: {
                status: "confirmed",
                paymentStatus: "paid",
                paymentId: `redirect_${Date.now()}`,
                confirmedAt: new Date(),
              },
            },
            { returnDocument: "after" },
          );

          if (updated) {
            await SpaceModel.updateOne(
              { id: updated.spaceId },
              [
                {
                  $set: {
                    seatsAvailable: {
                      $max: [0, { $min: ["$capacity", { $subtract: ["$seatsAvailable", updated.seats] }] }],
                    },
                  },
                },
              ],
              { updatePipeline: true },
            );
            const dto = toBookingDTO(updated.toObject());
            // Notify owner + admins
            const admins = await UserModel.find({ role: "admin" }).lean();
            const adminEmails = admins.map((a) => a.email);
            notifyPaymentReceived(dto, adminEmails);
            return Response.json({ booking: dto });
          }

          // Another process already confirmed it
          const final = await BookingModel.findOne({ bookingId: params.bookingId });
          return Response.json({ booking: final ? toBookingDTO(final.toObject()) : null });
        } catch (err) {
          console.error("Payment confirm error:", err);
          return Response.json({ error: "Failed to confirm payment" }, { status: 500 });
        }
      },
    },
  },
});
