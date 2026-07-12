import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  MapPin,
  Sparkles,
  Zap,
  ShieldCheck,
  Bell,
  Users,
  Star,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SpaceCard } from "@/components/SpaceCard";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/spaces-data";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  loader: () => getSpaces(),
  component: Index,
});

const features = [
  {
    icon: MapPin,
    title: "Discover spaces",
    description:
      "Filter by city, vibe, and price to find premium workspaces with real-time seat availability.",
  },
  {
    icon: Sparkles,
    title: "Curated, not crowded",
    description:
      "Every space is hand-selected for design, light, and atmosphere — quality over quantity.",
  },
  {
    icon: Zap,
    title: "Instant booking",
    description:
      "Reserve a desk, office, or boardroom in seconds with immediate confirmation.",
  },
  {
    icon: ShieldCheck,
    title: "Verified hosts",
    description:
      "Trusted owners, transparent pricing, and honest reviews from real members.",
  },
  {
    icon: Bell,
    title: "Smart notifications",
    description:
      "Stay ahead with alerts for bookings, availability, and space updates.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description:
      "Bring your team, book recurring rooms, and manage everything from one dashboard.",
  },
];

function Index() {
  const spaces = Route.useLoaderData();
  const featured = spaces.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 reveal">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <p className="eyebrow">Curated coworking, worldwide</p>
            <h1 className="mt-5 font-display text-5xl font-black leading-[1.05] md:text-6xl lg:text-7xl">
              Discover your
              <br />
              <span className="text-accent italic">perfect workspace</span>
            </h1>
            <p className="mt-6 max-w-md font-serif-body text-lg leading-relaxed text-muted-foreground">
              Aperture connects professionals with premium coworking spaces.
              Find, book, and thrive in the room that matches your ambition.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="hero">
                <Link to="/spaces">
                  Explore spaces <ArrowRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/how-it-works">How it works</Link>
              </Button>
            </div>

            <div className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8">
              <Stat value="500+" label="Premium spaces" />
              <Stat value="10K+" label="Active members" />
              <Stat value="50+" label="Cities" />
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-xl shadow-elegant">
              <img
                src={heroImg}
                alt="A premium, sunlit coworking space interior"
                width={1600}
                height={1200}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-lg border border-border bg-card p-4 shadow-soft sm:block">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-accent text-accent" />
                <span className="font-display text-xl font-bold">4.9</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                from 2,400+ reviews
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30 reveal">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="max-w-2xl">
            <p className="eyebrow">Why Aperture</p>
            <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
              Everything you need to work brilliantly
            </h2>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-card p-7 shadow-soft transition-shadow hover:shadow-elegant"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold">{f.title}</h3>
                <p className="mt-2 font-serif-body text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured spaces */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 reveal">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="mt-4 font-display text-4xl font-bold md:text-5xl">
              Spaces worth the commute
            </h2>
          </div>
          <Link
            to="/spaces"
            className="hidden text-sm font-medium text-accent hover:underline sm:block"
          >
            View all spaces →
          </Link>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((s) => (
            <SpaceCard key={s.id} space={s} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8 reveal">
        <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground md:py-24">
          <p className="eyebrow">Ready when you are</p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-bold text-primary-foreground md:text-5xl">
            Your next great idea needs a great room
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-serif-body text-primary-foreground/80">
            Join thousands of members who found their perfect workspace on
            Aperture.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="hero">
              <Link to="/spaces">
                Find your space <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-bold text-accent">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
