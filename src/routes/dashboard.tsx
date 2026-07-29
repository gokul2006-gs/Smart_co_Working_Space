import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ArrowRight, MapPin, CreditCard, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [manualPayRef, setManualPayRef] = useState<Record<string, string>>({});
  const [submittingManualId, setSubmittingManualId] = useState<string | null>(null);

  // Load Razorpay checkout script once
  useEffect(() => {
    if (document.getElementById("razorpay-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handlePayNow = async (booking: BookingDTO) => {
    setPayingId(booking.bookingId);
    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.bookingId }),
      });
      const data = (await res.json()) as {
        orderId?: string;
        keyId?: string;
        amount?: number;
        currency?: string;
        booking?: { spaceName: string; spaceCity: string; memberName: string; memberEmail: string; totalAmount: number };
        error?: string;
      };

      if (!res.ok || !data.orderId) {
        throw new Error(data.error ?? "Failed to create payment order");
      }

      const rate = 83;
      const inrAmount = data.booking?.totalAmount
        ? `₹${Math.round(data.booking.totalAmount * rate)}`
        : "";

      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency ?? "INR",
        order_id: data.orderId,
        name: "Aperture Spaces",
        description: `${data.booking?.spaceName ?? "Space booking"}, ${data.booking?.spaceCity ?? ""}`,
        prefill: {
          name: data.booking?.memberName ?? "",
          email: data.booking?.memberEmail ?? "",
          contact: "",
        },
        // Open directly on Net Banking tab
        config: {
          display: {
            blocks: {
              netbanking: {
                name: "Pay via Net Banking",
                instruments: [{ method: "netbanking" }],
              },
            },
            sequence: ["block.netbanking"],
            preferences: { show_default_blocks: false },
          },
        },
        theme: { color: "#c17f59" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const confirmRes = await fetch(`/api/payments/confirm/${booking.bookingId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId: response.razorpay_payment_id }),
            });
            const confirmData = (await confirmRes.json()) as { booking?: BookingDTO };
            if (confirmData.booking) {
              setBookings((prev) =>
                prev.map((b) =>
                  b.bookingId === confirmData.booking!.bookingId ? confirmData.booking! : b,
                ),
              );
            }
            toast.success(`Payment of ${inrAmount} successful! Booking confirmed.`);
          } catch {
            toast.success("Payment received — your booking is confirmed.");
          } finally {
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled.");
            setPayingId(null);
          },
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
      setPayingId(null);
    }
  };

  // Surface payment cancellation from URL params (fallback for redirect-based flows)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    params.delete("payment");
    params.delete("booking");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    if (payment === "cancelled") {
      toast.info("Payment cancelled. You can try again from your dashboard.");
    }
  }, []);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleManualPayConfirm = async (bookingId: string) => {
    const ref = manualPayRef[bookingId]?.trim();
    if (!ref) {
      toast.error("Please enter your payment reference.");
      return;
    }
    setSubmittingManualId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference: ref }),
      });
      const data = (await res.json().catch(() => ({}))) as { booking?: BookingDTO; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to submit");
      if (data.booking) {
        setBookings((prev) => prev.map((b) => (b.bookingId === data.booking!.bookingId ? data.booking! : b)));
      }
      toast.success("Payment submitted — the owner has been notified.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit payment");
    } finally {
      setSubmittingManualId(null);
    }
  };

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
            { icon: CreditCard, label: "Confirmed & paid", value: bookings.filter((b) => b.paymentStatus === "paid").length },
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

                      {b.status === "awaiting_payment" && b.paymentProvider !== "manual" && (
                        <div className="mt-4 rounded-md border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                            <CreditCard className="h-4 w-4" /> Payment required — owner has accepted your booking
                          </p>
                          <p className="mt-2 text-muted-foreground">
                            Complete your payment of{" "}
                            <span className="font-semibold text-foreground">
                              ₹{Math.round(b.totalAmount * 83)}
                            </span>{" "}
                            via Net Banking to confirm your reservation.
                          </p>
                          <Button
                            variant="accent"
                            size="sm"
                            className="mt-3 gap-2"
                            disabled={payingId === b.bookingId}
                            onClick={() => handlePayNow(b)}
                          >
                            <CreditCard className="h-4 w-4" />
                            {payingId === b.bookingId
                              ? "Opening payment…"
                              : `Pay ₹${Math.round(b.totalAmount * 83)} via Net Banking`}
                          </Button>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Powered by Razorpay · Secure &amp; encrypted
                          </p>
                        </div>
                      )}

                      {b.status === "confirmed" && b.paymentProvider === "manual" && b.paymentStatus !== "paid" && (
                        <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/5 p-4 text-sm space-y-3">
                          <p className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                            <CreditCard className="h-4 w-4" /> Manual payment required
                          </p>
                          {b.paymentMethod && (
                            <p className="text-muted-foreground">Method: <span className="font-medium text-foreground">{b.paymentMethod}</span></p>
                          )}
                          {b.paymentInstructions && (
                            <p className="whitespace-pre-line rounded-md bg-background/60 p-3 border border-border text-foreground">{b.paymentInstructions}</p>
                          )}
                          {b.paymentReference && (
                            <p className="text-muted-foreground">Reference: <span className="font-mono font-medium text-foreground">{b.paymentReference}</span></p>
                          )}
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Label htmlFor={`ref-${b.bookingId}`} className="text-xs mb-1 block">Your payment reference / UTR</Label>
                              <Input
                                id={`ref-${b.bookingId}`}
                                placeholder="e.g. UTR number, transaction ID"
                                value={manualPayRef[b.bookingId] ?? ""}
                                onChange={(e) => setManualPayRef((prev) => ({ ...prev, [b.bookingId]: e.target.value }))}
                              />
                            </div>
                            <Button
                              variant="accent"
                              size="sm"
                              disabled={submittingManualId === b.bookingId}
                              onClick={() => handleManualPayConfirm(b.bookingId)}
                            >
                              {submittingManualId === b.bookingId ? "Submitting…" : "Confirm payment"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {b.status === "confirmed" && b.paymentStatus === "paid" && (
                        <div className="mt-4 rounded-md border border-green-500/20 bg-green-500/5 p-3 text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" /> Payment confirmed
                          </p>
                          <p className="mt-1 text-muted-foreground">{timing.label}: {timing.detail}</p>
                          <p className="mt-0.5 text-muted-foreground">Exit by {formatBookingTime(timing.exitTime)}</p>
                          {b.ownerNotes && <p className="mt-1 text-muted-foreground">{b.ownerNotes}</p>}
                        </div>
                      )}

                      {b.status === "confirmed" && b.paymentStatus !== "paid" && b.paymentProvider !== "manual" && (
                        <div className="mt-4 rounded-md border border-accent/20 bg-accent/5 p-3 text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-accent"><CreditCard className="h-4 w-4" /> Booking confirmed</p>
                          <p className="mt-2 text-muted-foreground">{timing.label}: {timing.detail}</p>
                          <p className="mt-1 text-muted-foreground">Exit by {formatBookingTime(timing.exitTime)}</p>
                          {b.ownerNotes && <p className="mt-1 text-muted-foreground">{b.ownerNotes}</p>}
                        </div>
                      )}

                      {["pending", "awaiting_payment", "confirmed"].includes(b.status) &&
                        timing.status !== "completed" &&
                        b.paymentStatus !== "paid" && (
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
