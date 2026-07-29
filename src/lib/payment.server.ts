import type { BookingDTO } from "@/models/Booking";
import type Stripe from "stripe";
import { getAppUrl, getPaymentProvider, type PaymentProvider } from "./payment";

async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

async function getRazorpay() {
  const Razorpay = (await import("razorpay")).default;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not set");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function razorpayAmount(totalUsd: number): number {
  const rate = Number(process.env.RAZORPAY_USD_INR_RATE ?? 83);
  return Math.round(totalUsd * rate * 100);
}

export interface PaymentSessionResult {
  provider: PaymentProvider;
  paymentUrl: string;
  sessionId: string;
}

export async function createPaymentSession(
  booking: BookingDTO,
  provider?: PaymentProvider,
): Promise<PaymentSessionResult> {
  const selectedProvider = provider ?? getPaymentProvider();
  const appUrl = getAppUrl();

  if (selectedProvider === "stripe") {
    const stripe = await getStripe();
    const currency = (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.memberEmail,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${booking.spaceName} — ${booking.date}`,
              description: `${booking.seats} seat(s) at ${booking.spaceCity}`,
            },
            unit_amount: Math.round(booking.totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { bookingId: booking.bookingId },
      success_url: `${appUrl}/dashboard?payment=success&booking=${booking.bookingId}`,
      cancel_url: `${appUrl}/dashboard?payment=cancelled&booking=${booking.bookingId}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { provider: "stripe", paymentUrl: session.url, sessionId: session.id };
  }

  if (selectedProvider === "razorpay") {
    const razorpay = await getRazorpay();
    const currency = (process.env.RAZORPAY_CURRENCY ?? "INR").toUpperCase();
    const amount = razorpayAmount(booking.totalAmount);

    const link = await razorpay.paymentLink.create({
      amount,
      currency,
      description: `Booking: ${booking.spaceName} on ${booking.date}`,
      customer: { email: booking.memberEmail, name: booking.memberName },
      notify: { email: false, sms: false },
      reminder_enable: false,
      callback_url: `${appUrl}/dashboard?payment=success&booking=${booking.bookingId}`,
      callback_method: "get",
      notes: { bookingId: booking.bookingId },
    });

    const paymentUrl = link.short_url;
    if (!paymentUrl) throw new Error("Razorpay did not return a payment URL");
    return { provider: "razorpay", paymentUrl, sessionId: link.id };
  }

  throw new Error(`Payment provider "${selectedProvider}" does not support session creation in manual/demo mode`);
}

async function getBookingDeps() {
  const { connectDB } = await import("@/lib/db");
  const { BookingModel, toBookingDTO } = await import("@/models/Booking");
  const { SpaceModel } = await import("@/models/Space");
  return { connectDB, BookingModel, toBookingDTO, SpaceModel };
}

export async function markBookingPaid(
  bookingId: string,
  paymentId: string,
): Promise<BookingDTO | null> {
  const { connectDB, BookingModel, toBookingDTO, SpaceModel } = await getBookingDeps();
  await connectDB();

  // Atomic find-and-update: only transition from awaiting_payment → confirmed.
  // This prevents duplicate webhook calls from double-deducting seats.
  const booking = await BookingModel.findOneAndUpdate(
    { bookingId, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        status: "confirmed",
        paymentStatus: "paid",
        paymentId,
        confirmedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!booking) {
    // Either not found or already paid — return current state if it exists
    const existing = await BookingModel.findOne({ bookingId });
    return existing ? toBookingDTO(existing.toObject()) : null;
  }

  // Commit the seats now that payment has actually gone through.
  await SpaceModel.updateOne(
    { id: booking.spaceId },
    [
      {
        $set: {
          seatsAvailable: {
            $max: [0, { $min: ["$capacity", { $subtract: ["$seatsAvailable", booking.seats] }] }],
          },
        },
      },
    ],
    { updatePipeline: true },
  );

  return toBookingDTO(booking.toObject());
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: "STRIPE_WEBHOOK_SECRET not configured" };
  if (!signature) return { ok: false, error: "Missing stripe-signature header" };

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return { ok: false, error: `Webhook signature verification failed: ${err}` };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      await markBookingPaid(bookingId, (session.payment_intent as string) ?? session.id);
    }
  }

  return { ok: true };
}

export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;

  const crypto = await import("node:crypto");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}

export async function handleRazorpayWebhook(
  payload: {
    event: string;
    payload?: {
      payment?: { entity?: { id?: string; notes?: { bookingId?: string } } };
      payment_link?: { entity?: { notes?: { bookingId?: string } } };
    };
  },
): Promise<{ ok: boolean }> {
  if (payload.event === "payment.captured") {
    const payment = payload.payload?.payment?.entity;
    const bookingId = payment?.notes?.bookingId;
    if (bookingId && payment?.id) {
      await markBookingPaid(bookingId, payment.id);
    }
  }

  if (payload.event === "payment_link.paid") {
    const link = payload.payload?.payment_link?.entity;
    const bookingId = link?.notes?.bookingId;
    if (bookingId) {
      await markBookingPaid(bookingId, `plink_${Date.now()}`);
    }
  }

  return { ok: true };
}

export async function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;

  const crypto = await import("node:crypto");
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return false;

  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return expected === signature;
}

export async function handlePaystackWebhook(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  const data = payload.data as Record<string, unknown> | undefined;
  const event = (payload.event ?? payload.eventType) as string | undefined;

  if (event === "charge.success") {
    const meta = (data?.metadata ?? {}) as Record<string, unknown>;
    const bookingId = (meta.bookingId ?? meta.booking ?? null) as string | null;
    const reference = (data?.reference ?? data?.id) as string | undefined;
    if (bookingId && reference) {
      await markBookingPaid(bookingId, reference);
    }
  }

  return { ok: true };
}

export async function verifyPayuWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;

  const crypto = await import("node:crypto");
  const secret = process.env.PAYU_CLIENT_SECRET ?? process.env.PAYU_SALT;
  if (!secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}

export async function handlePayuWebhook(payload: Record<string, unknown>): Promise<{ ok: boolean }> {
  const meta = (payload.metadata ?? (payload.data as Record<string, unknown> | undefined)?.metadata ?? {}) as Record<string, unknown>;
  const bookingId = (meta.bookingId ?? payload.bookingId) as string | undefined;
  const paymentId = (payload.payment_id ?? (payload.data as Record<string, unknown> | undefined)?.payment_id ?? payload.id ?? `payu_${Date.now()}`) as string;

  if (bookingId) {
    await markBookingPaid(bookingId, paymentId);
  }

  return { ok: true };
}

