import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { z } from "zod";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { connectDB } from "@/lib/db";
import { BookingModel, toBookingDTO } from "@/models/Booking";

const schema = z.object({ bookingId: z.string().min(1) });

export const Route = createFileRoute("/api/payments/razorpay/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const body = await request.json();
          const { bookingId } = schema.parse(body);

          await connectDB();
          const booking = await BookingModel.findOne({ bookingId });
          if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

          if (booking.memberId !== user.userId && user.role !== "admin") {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          if (booking.status !== "awaiting_payment") {
            return Response.json({ error: "Booking is not awaiting payment" }, { status: 400 });
          }

          const keyId = process.env.RAZORPAY_KEY_ID;
          const keySecret = process.env.RAZORPAY_KEY_SECRET;
          if (!keyId || !keySecret) {
            return Response.json({ error: "Razorpay credentials not configured" }, { status: 500 });
          }

          const Razorpay = (await import("razorpay")).default;
          const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

          const currency = (process.env.RAZORPAY_CURRENCY ?? "INR").toUpperCase();
          const rate = Number(process.env.RAZORPAY_USD_INR_RATE ?? 83);
          const amountInPaise = Math.round(booking.totalAmount * rate * 100);

          const order = await rzp.orders.create({
            amount: amountInPaise,
            currency,
            receipt: bookingId,
            notes: { bookingId },
          });

          // Store orderId on the booking
          booking.paymentSessionId = order.id;
          booking.paymentProvider = "razorpay";
          await booking.save();

          const dto = toBookingDTO(booking.toObject());

          return Response.json({
            orderId: order.id,
            keyId,
            amount: amountInPaise,
            currency,
            booking: {
              bookingId: dto.bookingId,
              spaceName: dto.spaceName,
              memberName: dto.memberName,
              memberEmail: dto.memberEmail,
              totalAmount: dto.totalAmount,
            },
          });
        } catch (err) {
          console.error("Razorpay order error:", err);
          const msg = err instanceof Error ? err.message : "Failed to create order";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
