import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ArrowRight, MapPin, CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { fetchMemberBookings, fetchAdminData } from "@/lib/bookings-data";
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
  },
  loader: async ({ context }) => {
    if (context.user?.role === "admin") {
      try {
        return await fetchAdminData();
      } catch (err) {
        console.error("Admin data load failed:", err);
        return { bookings: [], users: [], stats: { userCount: 0, spaceCount: 0, total: 0, pending: 0, awaitingPayment: 0, confirmed: 0, rejected: 0 } };
      }
    }

    try {
      const bookings = await fetchMemberBookings();
      return { bookings };
    } catch (err) {
      console.error("Member bookings load failed:", err);
      return { bookings: [] };
    }
  },
  head: () => ({ meta: [{ title: "Dashboard — Aperture" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const loader = Route.useLoaderData() as any;
  const initialBookings: BookingDTO[] = loader?.bookings ?? loader?.bookings ?? [];
  const stats = loader?.stats ?? [];

  const [bookings, setBookings] = useState<BookingDTO[]>(initialBookings);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // lightweight refresh — keep server-side in sync if API available
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => {
        if (data.bookings) setBookings(data.bookings);
      })
      .catch(() => {});
  }, []);

  const [payingId, setPayingId] = useState<string | null>(null);

  const handlePayNow = async (bookingId: string) => {
    setPayingId(bookingId);
    try {
      const res = await fetch(`/api/payments/checkout/${bookingId}`, { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as { paymentUrl?: string; error?: string };

      if (!res.ok || !data.paymentUrl) {
        throw new Error(data.error ?? "Payment failed");
      }

      toast.success("Redirecting to secure checkout…");
      window.location.href = data.paymentUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
    } finally {
      setPayingId(null);
    }
  };

  // Surface Stripe/Razorpay redirect outcome (?payment=success|cancelled) as a toast, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const bookingId = params.get("booking");

    // Clean the URL immediately regardless of outcome
    params.delete("payment");
    params.delete("booking");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);

    if (!payment) return;

    if (payment === "success" && bookingId) {
      // Confirm server-side first (fallback if webhook hasn't fired yet)
      fetch(`/api/payments/confirm/${bookingId}`, { method: "POST" })
        .then((r) => r.json())
        .then((data: { booking?: BookingDTO }) => {
          if (data.booking) {
            setBookings((prev) =>
              prev.map((b) => (b.bookingId === data.booking!.bookingId ? data.booking! : b)),
            );
          }
          toast.success("Payment received — your booking is confirmed!");
        })
        .catch(() => {
          toast.success("Payment received — your booking is confirmed!");
        });

      // Poll /api/bookings a few times to catch any async webhook update
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        fetch("/api/bookings")
          .then((r) => r.json())
          .then((data: { bookings?: BookingDTO[] }) => {
            if (data.bookings) setBookings(data.bookings);
          })
          .catch(() => {})
          .finally(() => {
            if (attempts >= 4) clearInterval(poll);
          });
      }, 1500);

    } else if (payment === "cancelled") {
      toast.info("Payment cancelled. You can try again from your dashboard.");
      // Refresh to get latest state
      fetch("/api/bookings")
        .then((r) => r.json())
        .then((data: { bookings?: BookingDTO[] }) => {
          if (data.bookings) setBookings(data.bookings);
        })
        .catch(() => {});
    }
  }, []);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm("Cancel this booking? This can't be undone.")) return;
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "PATCH" });
      const data = (await res.json().catch(() => ({}))) as { booking?: BookingDTO; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to cancel booking");
      if (data.booking) {
        setBookings((prev) => prev.map((b) => (b.bookingId === data.booking!.bookingId ? data.booking! : b)));
      }
      toast.success("Booking cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const mySpaces = [] as any[];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Welcome back{user ? `, ${user.name}` : ""}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Overview of your account and bookings.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 space-y-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: Building2, label: "Your listings", value: mySpaces.length },
            { icon: MapPin, label: "Bookings", value: bookings.length },
            { icon: CreditCard, label: "Payments", value: "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-6 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
                <s.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-3xl font-bold">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold">Your bookings</h2>
            {bookings.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-border py-16 text-center">
                <p className="font-display text-lg font-bold">No bookings yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Browse spaces and send your first booking request.</p>
                <Button asChild variant="accent" className="mt-4">
                  <Link to="/spaces">Browse spaces</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {bookings.map((b) => {
                  const timing = getBookingTiming(b.date, b.startTime, b.endTime, now);
                  const timingLabel = timing.status === "in_progress" ? "Ongoing" : timing.status === "completed" ? "Expired" : "Upcoming";
                  const timingClasses =
                    timing.status === "in_progress"
                      ? "bg-accent/15 text-accent"
                      : timing.status === "completed"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/15 text-amber-700";

                  return (
                    <div key={b.bookingId} className="rounded-lg border border-border bg-card p-4 shadow-soft">
                      <div className="flex items-start gap-4">
                        <img src={b.spaceImage} alt={b.spaceName} loading="lazy" className="h-20 w-24 flex-shrink-0 rounded-md object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-display text-lg font-bold leading-tight">{b.spaceName}</h3>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${timingClasses}`}>{timingLabel}</span>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusStyles[b.status]}`}>{bookingStatusLabels[b.status]}</span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {b.spaceCity} · {formatBookingDate(b.date)} · {formatBookingTimeRange(b.startTime, b.endTime)} · {b.seats} seat{b.seats > 1 ? "s" : ""} · ${b.totalAmount}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">Owner: {b.ownerName}</p>
                        </div>
                      </div>

                      {b.status === "awaiting_payment" && (
                        <div className="mt-4 rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400"><CreditCard className="h-4 w-4" /> Payment required</p>
                          <p className="mt-2 text-muted-foreground">Your booking was approved. Pay ${b.totalAmount} to confirm your reservation.</p>
                          <Button
                            variant="accent"
                            size="sm"
                            className="mt-3"
                            disabled={payingId === b.bookingId}
                            onClick={() => handlePayNow(b.bookingId)}
                          >
                            {payingId === b.bookingId ? "Redirecting…" : "Pay now"}
                          </Button>
                        </div>
                      )}

                      {b.status === "confirmed" && (
                        <div className="mt-4 rounded-md border border-accent/20 bg-accent/5 p-3 text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-accent"><CreditCard className="h-4 w-4" /> Booking time monitor</p>
                          <p className="mt-2 text-muted-foreground">{timing.label}: {timing.detail}</p>
                          <p className="mt-1 text-muted-foreground">Exit by {formatBookingTime(timing.exitTime)}</p>
                          {b.ownerNotes && <p className="mt-1 text-muted-foreground">{b.ownerNotes}</p>}
                        </div>
                      )}

                      {["pending", "awaiting_payment", "confirmed"].includes(b.status) &&
                        timing.status !== "completed" && (
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
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

          <div>
            <h2 className="font-display text-2xl font-bold">Recommended for you</h2>
            <div className="mt-5 rounded-lg border border-border bg-card p-6 shadow-soft">
              <p className="font-serif-body text-sm text-muted-foreground">Based on your recent visits, you might love a quiet focus space.</p>
              <Button asChild variant="accent" className="mt-5 w-full">
                <Link to="/spaces">Browse all spaces <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
