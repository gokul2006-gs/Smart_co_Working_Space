import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Star,
  Users,
  Check,
  Wifi,
  CalendarDays,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpaceCard } from "@/components/SpaceCard";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { getSpaceById, getSpaces } from "@/lib/spaces-data";

export const Route = createFileRoute("/spaces/$id")({
  loader: async ({ params }) => {
    const space = await getSpaceById({ data: { id: params.id } });
    if (!space) throw notFound();
    const allSpaces = await getSpaces();
    return { space, allSpaces };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Space not found — Aperture" }, { name: "robots", content: "noindex" }] };
    }
    const { space } = loaderData;
    return {
      meta: [
        { title: `${space.name} — Aperture` },
        { name: "description", content: space.description },
        { property: "og:title", content: `${space.name} — Aperture` },
        { property: "og:description", content: space.tagline },
        { property: "og:image", content: space.image },
        { name: "twitter:image", content: space.image },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-32 text-center">
        <div>
          <h1 className="font-display text-4xl font-bold">Space not found</h1>
          <p className="mt-2 text-muted-foreground">
            This workspace may have been removed.
          </p>
          <Button asChild variant="accent" className="mt-6">
            <Link to="/spaces">Back to all spaces</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  ),
  component: SpaceDetail,
});

function SpaceDetail() {
  const { space, allSpaces } = Route.useLoaderData();
  const { user, isAuthenticated } = useAuth();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const related = allSpaces.filter((s) => s.id !== space.id).slice(0, 3);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error("Please sign in to request a booking.");
      return;
    }

    if (user?.role !== "user") {
      toast.error("Only members can request bookings. Use a member account.");
      return;
    }

    if (!date) {
      toast.error("Please choose a date for your booking.");
      return;
    }

    if (!startTime || !endTime || startTime >= endTime) {
      toast.error("Please choose a valid booking time range.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId: space.id, date, seats, startTime, endTime }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok || result.error) {
        toast.error(result.error ?? "Booking request failed");
        return;
      }

      toast.success(`Booking request sent to ${space.host}`, {
        description: `${seats} seat${seats > 1 ? "s" : ""} on ${new Date(date).toLocaleDateString()} — awaiting owner confirmation.`,
      });
      window.location.href = "/dashboard";
    } catch {
      toast.error("Booking request failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Toaster position="top-center" richColors />

      <div className="mx-auto max-w-7xl px-4 pt-24 md:px-8">
        <Link
          to="/spaces"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All spaces
        </Link>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 reveal">
        <div className="overflow-hidden rounded-2xl shadow-elegant">
          <img
            src={space.image}
            alt={space.name}
            width={1600}
            height={900}
            className="h-[340px] w-full object-cover md:h-[460px]"
          />
        </div>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px] reveal">
          {/* Left: content */}
          <div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              {space.type}
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">
              {space.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {space.neighborhood}, {space.city}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-accent text-accent" />
                {space.rating.toFixed(1)} ({space.reviews} reviews)
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" /> Up to {space.capacity} people
              </span>
            </div>

            <p className="mt-8 max-w-2xl font-serif-body text-lg leading-relaxed text-foreground/90">
              {space.description}
            </p>

            <h2 className="mt-12 font-display text-2xl font-bold">Amenities</h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {space.amenities.map((a: string) => (
                <div
                  key={a}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
                >
                  <Check className="h-4 w-4 text-accent" />
                  <span className="text-sm">{a}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Hosted by {space.host}</p>
                {space.ownerEmail ? (
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${space.ownerEmail}`} className="hover:text-foreground">
                      {space.ownerEmail}
                    </a>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Owner contact info unavailable.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Verified host · Responds within an hour
                </p>
              </div>
            </div>
          </div>

          {/* Right: booking card */}
          <aside>
            <div className="sticky top-24 rounded-xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-baseline justify-between">
                <p>
                  <span className="font-display text-3xl font-bold">
                    ${space.price}
                  </span>
                  <span className="text-sm text-muted-foreground"> / day</span>
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    space.seatsAvailable <= 5
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {space.seatsAvailable} seats left
                </span>
              </div>

              <form onSubmit={handleBook} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="date" className="mb-1.5 block">
                    Date
                  </Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="start-time" className="mb-1.5 block">
                      Start time
                    </Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="end-time" className="mb-1.5 block">
                      End time
                    </Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="seats" className="mb-1.5 block">
                    Seats
                  </Label>
                  <Input
                    id="seats"
                    type="number"
                    min={1}
                    max={space.seatsAvailable}
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">
                    ${space.price} × {seats} {seats > 1 ? "seats" : "seat"}
                  </span>
                  <span className="font-display text-lg font-bold">
                    ${space.price * seats}
                  </span>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "Sending request…" : "Request booking"}
                </Button>
                {!isAuthenticated ? (
                  <p className="text-center text-xs text-muted-foreground">
                    <Link to="/login" className="font-medium text-accent hover:underline">
                      Sign in
                    </Link>{" "}
                    to request a booking.
                  </p>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Your request goes to the space owner for approval and payment details.
                  </p>
                )}
              </form>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 reveal">
        <h2 className="font-display text-3xl font-bold">You might also like</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3 reveal-stagger">
          {related.map((s) => (
            <SpaceCard key={s.id} space={s} />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
