import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, CalendarClock, CheckCircle2, Check, X, Bell, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchOwnerBookings } from "@/lib/bookings-data";
import { isPaymentGatewayEnabled, getPaymentProvider } from "@/lib/payment";
import { getSpaces } from "@/lib/spaces-data";
import {
  bookingStatusLabels,
  bookingStatusStyles,
  formatBookingDate,
  formatBookingTimeRange,
} from "@/lib/booking-utils";
import type { BookingDTO } from "@/models/Booking";
import type { Space } from "@/lib/spaces";

export const Route = createFileRoute("/owner")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    if (context.user.role !== "space_owner") throw redirect({ to: "/dashboard" });
  },
  loader: async ({ context }) => {
    try {
      const [bookings, allSpaces] = await Promise.all([fetchOwnerBookings(), getSpaces()]);
      const ownerSpaces = allSpaces.filter((s) => s.ownerId === context.user?.userId);
      return {
        bookings,
        ownerSpaces,
        gatewayEnabled: isPaymentGatewayEnabled(),
        paymentProvider: getPaymentProvider(),
      };
    } catch {
      return { bookings: [], ownerSpaces: [], gatewayEnabled: isPaymentGatewayEnabled(), paymentProvider: getPaymentProvider() };
    }
  },
  head: () => ({ meta: [{ title: "Owner Portal — Aperture" }, { name: "robots", content: "noindex" }] }),
  component: OwnerPortal,
});

function OwnerPortal() {
  const { user } = Route.useRouteContext();
  const { bookings: initial, ownerSpaces, gatewayEnabled, paymentProvider } = Route.useLoaderData();
  const [bookings, setBookings] = useState<BookingDTO[]>(initial);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [ownerNotes, setOwnerNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Seed prevConfirmed synchronously so first poll never fires false toasts
  const [prevConfirmed, setPrevConfirmed] = useState<Set<string>>(
    () => new Set(initial.filter((b) => b.paymentStatus === "paid").map((b) => b.bookingId)),
  );

  // Poll for updates every 15s — owner sees payment confirmation in real time
  useEffect(() => {
    const refresh = () => {
      fetch("/api/bookings")
        .then((r) => r.json())
        .then((d: { bookings?: BookingDTO[] }) => {
          if (!Array.isArray(d.bookings)) return;

          // Detect bookings that just became paid since last poll
          setPrevConfirmed((prev) => {
            const freshlyPaid = d.bookings!.filter(
              (b) => b.paymentStatus === "paid" && !prev.has(b.bookingId),
            );
            if (freshlyPaid.length > 0) {
              // Show one toast per newly-paid booking
              freshlyPaid.forEach((b) => {
                toast.success(`Payment received — ${b.spaceName}`, {
                  description: `${b.memberName} paid ₹${(b.totalAmount * 83).toLocaleString("en-IN")} via Razorpay`,
                  duration: 8000,
                });
              });
              const next = new Set(prev);
              freshlyPaid.forEach((b) => next.add(b.bookingId));
              return next;
            }
            return prev;
          });

          setBookings(d.bookings!);
        })
        .catch(() => {});
    };

    // First refresh after a short delay so SSR data is already rendered
    const initialTimer = setTimeout(refresh, 3000);
    const id = setInterval(refresh, 15_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(id);
    };
  }, []);

  const pending = bookings.filter((b) => b.status === "pending");
  const awaitingPayment = bookings.filter((b) => b.status === "awaiting_payment");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const paidCount = bookings.filter((b) => b.paymentStatus === "paid").length;

  const refreshBooking = (updated: BookingDTO) => {
    setBookings((prev) => prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)));
    setAcceptingId(null);
    setOwnerNotes("");
  };

  const handleAccept = async (bookingId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerNotes: ownerNotes || undefined }),
      });
      const data = (await res.json()) as { booking?: BookingDTO; error?: string };
      if (!res.ok || data.error) { toast.error(data.error ?? "Failed to accept"); return; }
      if (data.booking) refreshBooking(data.booking);
      toast.success("Booking accepted — member notified to pay via Razorpay.");
    } catch {
      toast.error("Failed to accept booking");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (bookingId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerNotes: ownerNotes || "Booking unavailable for selected date." }),
      });
      const data = (await res.json()) as { booking?: BookingDTO; error?: string };
      if (!res.ok || data.error) { toast.error(data.error ?? "Failed to reject"); return; }
      if (data.booking) refreshBooking(data.booking);
      toast.success("Booking declined.");
      setAcceptingId(null);
      setOwnerNotes("");
    } catch {
      toast.error("Failed to decline booking");
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async (bookingId: string) => {
    setCompletingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: "PATCH" });
      const data = (await res.json()) as { booking?: BookingDTO; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      if (data.booking) refreshBooking(data.booking);
      toast.success("Booking marked as completed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
          <p className="eyebrow">Owner Portal</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Manage your spaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.name}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 space-y-10">

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { icon: Building2, label: "Your spaces", value: ownerSpaces.length },
            { icon: CalendarClock, label: "Pending requests", value: pending.length },
            { icon: CreditCard, label: "Awaiting payment", value: awaitingPayment.length },
            { icon: CheckCircle2, label: "Payments received", value: paidCount },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-5 shadow-soft">
              <s.icon className="h-5 w-5 text-accent" />
              <p className="mt-3 font-display text-3xl font-bold">{s.value}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ① PENDING REQUESTS */}
        <div>
          <h2 className="font-display text-2xl font-bold">Booking requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accept to notify the member to pay via Razorpay Net Banking, or decline.
          </p>

          {pending.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No pending requests.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {pending.map((b) => (
                <div key={b.bookingId} className="rounded-lg border border-border bg-card shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div>
                      <h3 className="font-display text-lg font-bold">{b.spaceName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {b.memberName} ({b.memberEmail}) · {formatBookingDate(b.date)} ·{" "}
                        {formatBookingTimeRange(b.startTime, b.endTime)} · {b.seats} seat{b.seats > 1 ? "s" : ""} ·{" "}
                        <span className="font-medium text-foreground">
                          ${b.totalAmount} (₹{(b.totalAmount * 83).toLocaleString("en-IN")})
                        </span>
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusStyles.pending}`}>
                      {bookingStatusLabels.pending}
                    </span>
                  </div>

                  {acceptingId === b.bookingId ? (
                    <div className="border-t border-border p-5 space-y-3">
                      <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-300">
                        <strong>Accepting</strong> will notify {b.memberName} to pay{" "}
                        ₹{(b.totalAmount * 83).toLocaleString("en-IN")} via Razorpay Net Banking.
                        Payment goes directly to your account.
                      </div>
                      <div>
                        <Label htmlFor={`notes-${b.bookingId}`}>Note to member (optional)</Label>
                        <Input
                          id={`notes-${b.bookingId}`}
                          value={ownerNotes}
                          onChange={(e) => setOwnerNotes(e.target.value)}
                          placeholder="Access code, check-in time, etc."
                          className="mt-1"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="accent" disabled={processing} onClick={() => handleAccept(b.bookingId)}>
                          <Check className="mr-1.5 h-4 w-4" /> Accept & send payment request
                        </Button>
                        <Button size="sm" variant="outline" disabled={processing} onClick={() => handleReject(b.bookingId)}>
                          <X className="mr-1.5 h-4 w-4" /> Decline
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAcceptingId(null); setOwnerNotes(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-border px-5 py-3 flex gap-2">
                      <Button size="sm" variant="accent" onClick={() => setAcceptingId(b.bookingId)}>
                        Review &amp; accept
                      </Button>
                      <Button size="sm" variant="outline" disabled={processing} onClick={() => handleReject(b.bookingId)}>
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ② AWAITING PAYMENT */}
        {awaitingPayment.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold">Awaiting payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accepted — waiting for members to complete Razorpay checkout.
            </p>
            <div className="mt-4 space-y-3">
              {awaitingPayment.map((b) => (
                <div key={b.bookingId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-soft">
                  <div>
                    <p className="font-semibold">{b.spaceName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {b.memberName} · {formatBookingDate(b.date)} ·{" "}
                      <span className="font-medium text-foreground">₹{(b.totalAmount * 83).toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusStyles.awaiting_payment}`}>
                    {bookingStatusLabels.awaiting_payment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ③ CONFIRMED / PAID BOOKINGS */}
        {confirmed.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold">Confirmed bookings</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Space</th>
                    <th className="px-4 py-3 text-left font-semibold">Member</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Amount (INR)</th>
                    <th className="px-4 py-3 text-left font-semibold">Payment</th>
                    <th className="px-4 py-3 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmed.map((b) => (
                    <tr key={b.bookingId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{b.spaceName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.memberName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBookingDate(b.date)}</td>
                      <td className="px-4 py-3">
                        ₹{(b.totalAmount * 83).toLocaleString("en-IN")}
                        {b.paymentStatus === "paid" && (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Paid</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.paymentMethod ?? "Razorpay"}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={completingId === b.bookingId}
                          onClick={() => handleComplete(b.bookingId)}
                        >
                          {completingId === b.bookingId ? "Updating…" : "Mark complete"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ④ YOUR SPACES */}
        <div>
          <h2 className="font-display text-2xl font-bold">Your spaces</h2>
          {ownerSpaces.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No spaces linked to your account yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {ownerSpaces.map((space) => (
                <div key={space.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-soft">
                  <img src={space.image} alt={space.name} className="h-16 w-20 flex-shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold">{space.name}</p>
                    <p className="text-sm text-muted-foreground">{space.city} · {space.type} · ${space.price}/day</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Payment: <span className="font-medium text-foreground">Razorpay Net Banking</span>
                    </p>
                  </div>
                  <Link to="/spaces/$id" params={{ id: space.id }}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
