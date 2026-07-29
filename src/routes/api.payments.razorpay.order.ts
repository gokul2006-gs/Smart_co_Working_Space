import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { z } from "zod";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { connectDB } from "@/lib/db";
import { BookingModel, toBookingDTO } from "@/models/Booking";

const schema = z.object({ bookingId: z.string().min(1) });

/** Call Razorpay Orders API directly via fetch — no Node SDK, no require() */
async function createRazorpayOrder(params: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  currency: string;
  receipt: string;
  bookingId: string;
}) {
  const credentials = Buffer.from(`${params.keyId}:${params.keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: { bookingId: params.bookingId },
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
    throw new Error(err.error?.description ?? `Razorpay API error ${res.status}`);
  }

  return res.json() as Promise<{ id: string; amount: number; currency: string; receipt: string }>;
}

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

          const currency = (process.env.RAZORPAY_CURRENCY ?? "INR").toUpperCase();
          const rate = Number(process.env.RAZORPAY_USD_INR_RATE ?? 83);
          const amountInPaise = Math.round(booking.totalAmount * rate * 100);

          const order = await createRazorpayOrder({
            keyId,
            keySecret,
            amountPaise: amountInPaise,
            currency,
            receipt: bookingId.slice(0, 40),
            bookingId,
          });

          // Persist the order id
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
              spaceCity: dto.spaceCity,
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
