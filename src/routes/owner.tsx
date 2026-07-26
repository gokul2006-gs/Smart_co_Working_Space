import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Plus, CalendarClock, Star, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchOwnerBookings } from "@/lib/bookings-data";
import { getPaymentProvider, isPaymentGatewayEnabled } from "@/lib/payment";
import {
  bookingStatusLabels,
  bookingStatusStyles,
  formatBookingDate,
  formatBookingTimeRange,
} from "@/lib/booking-utils";
import { spaces } from "@/lib/spaces";
import type { BookingDTO } from "@/models/Booking";

export const Route = createFileRoute("/owner")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    if (context.user.role !== "space_owner" && context.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  loader: async ({ context }) => {
    try {
      const bookings = await fetchOwnerBookings();
      return {
        bookings,
        gatewayEnabled: isPaymentGatewayEnabled(),
        paymentProvider: getPaymentProvider(),
      };
    } catch (err) {
      console.error("Owner bookings load failed:", err);
      return {
        bookings: [],
        gatewayEnabled: isPaymentGatewayEnabled(),
        paymentProvider: getPaymentProvider(),
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Owner Portal — Aperture" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

const mySpaces = spaces.slice(0, 2);

function OwnerPage() {
  const { user } = Route.useRouteContext();
  const { bookings: initialBookings, gatewayEnabled, paymentProvider } = Route.useLoaderData();
  const [bookings, setBookings] = useState(initialBookings);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Refresh bookings from API (handles legacy ownership fixes)
  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data: { bookings?: BookingDTO[] }) => {
        if (data.bookings) setBookings(data.bookings);
      })
      .catch(() => {});
  }, []);

  const pending = bookings.filter((b) => b.status === "pending");
  const awaitingPayment = bookings.filter((b) => b.status === "awaiting_payment");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const handleComplete = async (bookingId: string) => {
    setCompletingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: "PATCH" });
      const data = (await res.json().catch(() => ({}))) as { booking?: BookingDTO; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to update booking");
      if (data.booking) refreshBooking(data.booking);
      toast.success("Booking marked as completed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update booking");
    } finally {
      setCompletingId(null);
    }
  };

  const refreshBooking = (updated: BookingDTO) => {
    setBookings((prev) => prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)));
    setAcceptingId(null);
    setPaymentInstructions("");
    setPaymentReference("");
    setOwnerNotes("");
  };

  const handleAccept = async (bookingId: string) => {
    if (!gatewayEnabled && !paymentInstructions.trim()) {
      toast.error("Please add payment instructions for the member.");
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: gatewayEnabled ? undefined : paymentMethod,
          paymentInstructions: gatewayEnabled ? undefined : paymentInstructions,
          paymentReference: gatewayEnabled ? undefined : paymentReference || undefined,
          ownerNotes: ownerNotes || undefined,
        }),
      });
      const result = (await response.json()) as { booking?: BookingDTO; error?: string };
      if (!response.ok || result.error) {
        toast.error(result.error ?? "Failed to accept booking");
        return;
      }
      if (result.booking) refreshBooking(result.booking);
      toast.success(
        gatewayEnabled
          ? "Booking approved — member notified with payment link."
          : "Booking confirmed — member notified with payment details.",
      );
    } catch {
      toast.error("Failed to accept booking");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (bookingId: string) => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerNotes: ownerNotes || "Booking unavailable for selected date." }),
      });
      const result = (await response.json()) as { booking?: BookingDTO; error?: string };
      if (!response.ok || result.error) {
        toast.error(result.error ?? "Failed to reject booking");
        return;
      }
      if (result.booking) refreshBooking(result.booking);
      toast.success("Booking request declined.");
      setAcceptingId(null);
      setOwnerNotes("");
    } catch {
      toast.error("Failed to reject booking");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <p className="eyebrow">Owner Portal</p>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Manage your spaces</h1>
          <p className="mt-2 text-sm text-muted-foreground">Signed in as {user?.name}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 space-y-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: Building2, label: "Listed spaces", value: mySpaces.length },
            { icon: CalendarClock, label: "Pending requests", value: pending.length },
            { icon: Star, label: "Confirmed bookings", value: confirmed.length },
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

        {/* Pending booking requests */}
        <div>
          <h2 className="font-display text-2xl font-bold">Booking requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review member requests, then accept{gatewayEnabled ? " to send a payment link" : " with payment details"} or decline.
          </p>

          {pending.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              No pending booking requests.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {pending.map((b) => (
                <div key={b.bookingId} className="rounded-lg border border-border bg-card p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold">{b.spaceName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {b.memberName} ({b.memberEmail}) · {formatBookingDate(b.date)} · {formatBookingTimeRange(
                          b.startTime,
                          b.endTime,
                        )} · {b.seats} seat{b.seats > 1 ? "s" : ""} · ${b.totalAmount}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingStatusStyles.pending}`}>
                      {bookingStatusLabels.pending}
                    </span>
                  </div>

                  {acceptingId === b.bookingId ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      {gatewayEnabled ? (
                        <p className="text-sm text-muted-foreground">
                          Approving will email the member a secure payment link via{" "}
                          {paymentProvider === "razorpay" ? "Razorpay" : "Stripe"}.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor={`method-${b.bookingId}`}>Payment method</Label>
                              <Input
                                id={`method-${b.bookingId}`}
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                placeholder="e.g. UPI, Bank transfer"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`ref-${b.bookingId}`}>Payment reference (optional)</Label>
                              <Input
                                id={`ref-${b.bookingId}`}
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                                placeholder="UPI ID / account number"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor={`instr-${b.bookingId}`}>Payment instructions</Label>
                            <Textarea
                              id={`instr-${b.bookingId}`}
                              value={paymentInstructions}
                              onChange={(e) => setPaymentInstructions(e.target.value)}
                              placeholder="Tell the member how and when to pay…"
                              rows={3}
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <Label htmlFor={`notes-${b.bookingId}`}>Notes (optional)</Label>
                        <Input
                          id={`notes-${b.bookingId}`}
                          value={ownerNotes}
                          onChange={(e) => setOwnerNotes(e.target.value)}
                          placeholder="Access instructions, check-in time, etc."
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={processing}
                          onClick={() => handleAccept(b.bookingId)}
                        >
                          <Check className="mr-1.5 h-4 w-4" />{" "}
                          {gatewayEnabled ? "Approve & send payment link" : "Confirm & send payment details"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing}
                          onClick={() => handleReject(b.bookingId)}
                        >
                          <X className="mr-1.5 h-4 w-4" /> Decline
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAcceptingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="accent" onClick={() => setAcceptingId(b.bookingId)}>
                        Review & accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processing}
                        onClick={() => handleReject(b.bookingId)}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Awaiting payment */}
        {awaitingPayment.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold">Awaiting payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved and waiting on the member to complete checkout.
            </p>
            <div className="mt-5 space-y-3">
              {awaitingPayment.map((b) => (
                <div
                  key={b.bookingId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-soft"
                >
                  <div>
                    <h3 className="font-display text-base font-bold">{b.spaceName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {b.memberName} · {formatBookingDate(b.date)} · ${b.totalAmount}
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

        {/* Confirmed bookings */}
        {confirmed.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold">Confirmed bookings</h2>
            <div className="mt-5 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Space</th>
                    <th className="px-4 py-3 text-left font-semibold">Member</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Time</th>
                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold">Payment</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmed.map((b) => (
                    <tr key={b.bookingId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{b.spaceName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.memberName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBookingDate(b.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBookingTimeRange(b.startTime, b.endTime)}</td>
                      <td className="px-4 py-3">${b.totalAmount}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.paymentMethod}</td>
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

        {/* Space list */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Your listings</h2>
            <Button size="sm" variant="accent">
              <Plus className="mr-1.5 h-4 w-4" /> Add space
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            {mySpaces.map((space) => (
              <div
                key={space.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-soft"
              >
                <img
                  src={space.image}
                  alt={space.name}
                  className="h-20 w-24 flex-shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold">{space.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {space.city} · {space.type} · ${space.price}/day
                  </p>
                </div>
                <Link to="/spaces/$id" params={{ id: space.id }}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
