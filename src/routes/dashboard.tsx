import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, CreditCard, CheckCircle2, Clock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { fetchMemberBookings } from "@/lib/bookings-data";
import {
  bookingStatusLabels,
  bookingStatusStyles,
  formatBookingDate,
  formatBookingTimeRange,
  formatBookingTime,
  getBookingTiming,
} from "@/lib/booking-utils";
import type { BookingDTO } from "@/models/Booking";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    // Space owners go to their portal; admins go to admin panel
    if (context.user.role === "space_owner") throw redirect({ to: "/owner" });
    if (context.user.role === "admin") throw redirect({ to: "/admin" });
  },
  loader: async () => {
    try {
      return { bookings: await fetchMemberBookings() };
    } catch {
      return { bookings: [] };
    }
  },
  head: () => ({ meta: [{ title: "My Bookings — Aperture" }] }),
  component: MemberDashboard,
});

function MemberDashboard() {
  const { user } = Route.useRouteContext();
  const { bookings: initial } = Route.useLoaderData();
  const [bookings, setBookings] = useState<BookingDTO[]>(initial);
  const [loading, setLoading] = useState(initial.length === 0);
  const [now, setNow] = useState(new Date());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Always pull fresh bookings from server
  useEffect(() => {
    setLoading(true);
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d: { bookings?: BookingDTO[] }) => {
        if (Array.isArray(d.bookings)) setBookings(d.bookings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load Razorpay script
  useEffect(() => {
    if (document.getElementById("rzp-script")) return;
    const s = document.createElement("script");
    s.id = "rzp-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const refreshBooking = (updated: BookingDTO) =>
    setBookings((prev) => prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)));

  const handlePayNow = async (b: BookingDTO) => {
    setPayingId(b.bookingId);
    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: b.bookingId }),
      });
      const data = (await res.json()) as {
        orderId?: string; keyId?: string; amount?: number; currency?: string;
        booking?: { spaceName: string; spaceCity: string; memberName: string; memberEmail: string; totalAmount: number };
        error?: string;
      };
      if (!res.ok || !data.orderId) throw new Error(data.error ?? "Failed to create order");

      const inr = `₹${(data.booking?.totalAmount ?? 0 * 83).toLocaleString("en-IN")}`;
      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency ?? "INR",
        order_id: data.orderId,
        name: "Aperture Spaces",
        description: `${data.booking?.spaceName}, ${data.booking?.spaceCity}`,
        prefill: { name: data.booking?.memberName ?? "", email: data.booking?.memberEmail ?? "", contact: "" },
        config: {
          display: {
            blocks: { netbanking: { name: "Pay via Net Banking", instruments: [{ method: "netbanking" }] } },
            sequence: ["block.netbanking"],
            preferences: { show_default_blocks: false },
          },
        },
        theme: { color: "#c17f59" },
        handler: async (resp: { razorpay_payment_id: string }) => {
          try {
            const cr = await fetch(`/api/payments/confirm/${b.bookingId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId: resp.razorpay_payment_id }),
            });
            const cd = (await cr.json()) as { booking?: BookingDTO };
            if (cd.booking) refreshBooking(cd.booking);
            toast.success(`Payment of ${inr} successful — booking confirmed!`);
          } catch {
            toast.success("Payment received — your booking is confirmed.");
          } finally {
            setPayingId(null);
          }
        },
        modal: { ondismiss: () => { toast.info("Payment cancelled."); setPayingId(null); } },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
      setPayingId(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "PATCH" });
      const d = (await res.json()) as { booking?: BookingDTO; error?: string };
      if (!res.ok || d.error) throw new Error(d.error ?? "Failed");
      if (d.booking) refreshBooking(d.booking);
      toast.success("Booking cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  const pending = bookings.filter((b) => b.status === "pending").length;
  const awaitingPay = bookings.filter((b) => b.status === "awaiting_payment").length;
  const confirmed = bookings.filter((b) => b.status === "confirmed" && b.paymentStatus === "paid").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
          <p className="eyebrow">Member Dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-bold">
            Welcome, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your booking requests and payments.</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 space-y-10">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Clock, label: "Pending requests", value: pending, color: "text-amber-600" },
            { icon: CreditCard, label: "Awaiting payment", value: awaitingPay, color: "text-blue-600" },
            { icon: CheckCircle2, label: "Confirmed & paid", value: confirmed, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-5 shadow-soft">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <p className="mt-3 font-display text-3xl font-bold">{s.value}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Bookings list */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Your bookings</h2>
            <Button asChild variant="accent" size="sm">
              <Link to="/spaces"><CalendarDays className="mr-1.5 h-4 w-4" /> Book a space</Link>
            </Button>
          </div>

          {loading ? (
            <div className="mt-5 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
                  <div className="flex gap-4">
                    <div className="h-20 w-24 rounded-md bg-muted" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 w-1/2 rounded bg-muted" />
                      <div className="h-3 w-3/4 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border py-16 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-display text-lg font-bold">No bookings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Find a space and send your first request.</p>
              <Button asChild variant="accent" className="mt-4">
                <Link to="/spaces">Browse spaces</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {bookings.map((b) => {
                const timing = getBookingTiming(b.date, b.startTime, b.endTime, now);
                return (
                  <div key={b.bookingId} className="rounded-lg border border-border bg-card shadow-soft">
                    {/* Card header */}
                    <div className="flex items-start gap-4 p-4">
                      <img
                        src={b.spaceImage}
                        alt={b.spaceName}
                        className="h-20 w-24 flex-shrink-0 rounded-md object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="font-display text-lg font-bold leading-tight">{b.spaceName}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusStyles[b.status]}`}>
                            {bookingStatusLabels[b.status]}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {b.spaceCity} · {formatBookingDate(b.date)} · {formatBookingTimeRange(b.startTime, b.endTime)}
                          · {b.seats} seat{b.seats > 1 ? "s" : ""} · <span className="font-medium text-foreground">${b.totalAmount}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Owner: {b.ownerName}</p>
                      </div>
                    </div>

                    {/* Pending — waiting for owner */}
                    {b.status === "pending" && (
                      <div className="border-t border-border bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3 text-sm">
                        <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                          <Clock className="h-4 w-4" /> Waiting for owner to review your request
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">You'll get an email once the owner accepts or declines.</p>
                      </div>
                    )}

                    {/* Awaiting payment — Pay Now button */}
                    {b.status === "awaiting_payment" && (
                      <div className="border-t border-border bg-blue-50/50 dark:bg-blue-900/10 px-4 py-4 text-sm space-y-3">
                        <p className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                          <CreditCard className="h-4 w-4" /> Owner accepted — pay to confirm your seat
                        </p>
                        <p className="text-muted-foreground">
                          Amount due:{" "}
                          <span className="font-semibold text-foreground text-base">
                            ₹{(b.totalAmount * 83).toLocaleString("en-IN")}
                          </span>
                          <span className="ml-1 text-xs">(${b.totalAmount})</span>
                        </p>
                        <Button
                          variant="accent"
                          size="sm"
                          className="gap-2"
                          disabled={payingId === b.bookingId}
                          onClick={() => handlePayNow(b)}
                        >
                          <CreditCard className="h-4 w-4" />
                          {payingId === b.bookingId
                            ? "Opening payment…"
                            : `Pay ₹${(b.totalAmount * 83).toLocaleString("en-IN")} via Net Banking`}
                        </Button>
                        <p className="text-xs text-muted-foreground">Powered by Razorpay · Secure &amp; encrypted</p>
                      </div>
                    )}

                    {/* Confirmed + paid */}
                    {b.status === "confirmed" && b.paymentStatus === "paid" && (
                      <div className="border-t border-border bg-green-50/50 dark:bg-green-900/10 px-4 py-3 text-sm">
                        <p className="flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" /> Booking confirmed &amp; paid
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {timing.label}: {timing.detail} · Exit by {formatBookingTime(timing.exitTime)}
                        </p>
                        {b.ownerNotes && (
                          <p className="mt-1 text-muted-foreground">Note: {b.ownerNotes}</p>
                        )}
                      </div>
                    )}

                    {/* Rejected */}
                    {b.status === "rejected" && (
                      <div className="border-t border-border bg-destructive/5 px-4 py-3 text-sm">
                        <p className="font-medium text-destructive">Booking request declined</p>
                        {b.ownerNotes && <p className="mt-0.5 text-muted-foreground">{b.ownerNotes}</p>}
                      </div>
                    )}

                    {/* Cancel button for active bookings */}
                    {["pending", "awaiting_payment"].includes(b.status) && (
                      <div className="border-t border-border px-4 py-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={cancellingId === b.bookingId}
                          onClick={() => handleCancel(b.bookingId)}
                        >
                          {cancellingId === b.bookingId ? "Cancelling…" : "Cancel booking"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
