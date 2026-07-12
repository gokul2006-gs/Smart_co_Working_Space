import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, CalendarCheck, Sparkles, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Aperture" },
      {
        name: "description",
        content:
          "Three simple steps to book premium coworking space on Aperture — discover, reserve, and thrive. Plus how hosts list their spaces.",
      },
      { property: "og:title", content: "How It Works — Aperture" },
      {
        property: "og:description",
        content: "Discover, book, and thrive with Aperture coworking.",
      },
    ],
  }),
  component: HowItWorks,
});

const steps = [
  {
    icon: Search,
    title: "Discover",
    description:
      "Browse curated spaces by city, type, and vibe. Filter by price and see real-time seat availability before you commit.",
  },
  {
    icon: CalendarCheck,
    title: "Book",
    description:
      "Pick your date and seats, then send an instant booking request. Verified hosts confirm within the hour.",
  },
  {
    icon: Sparkles,
    title: "Thrive",
    description:
      "Show up and do your best work. Manage bookings, spending, and favorites from your personal dashboard.",
  },
];

function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8">
          <p className="eyebrow">How it works</p>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-6xl">
            Great work needs the right room
          </h1>
          <p className="mx-auto mt-5 max-w-xl font-serif-body text-lg text-muted-foreground">
            Aperture makes finding and booking a premium workspace effortless —
            for members and hosts alike.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <span className="font-display text-6xl font-black text-accent/15">
                0{i + 1}
              </span>
              <span className="mt-[-1.5rem] flex h-12 w-12 items-center justify-center rounded-md bg-accent/10 text-accent">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold">{s.title}</h3>
              <p className="mt-3 font-serif-body leading-relaxed text-muted-foreground">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <div className="grid gap-6 rounded-2xl border border-border bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <p className="eyebrow">For hosts</p>
            <h2 className="mt-4 font-display text-3xl font-bold">
              List your space, fill your seats
            </h2>
            <p className="mt-4 font-serif-body leading-relaxed text-muted-foreground">
              Own a beautiful workspace? Reach thousands of professionals looking
              for exactly what you offer. Set your pricing, manage availability,
              and approve bookings from one dashboard.
            </p>
            <Button asChild variant="accent" className="mt-6">
              <Link to="/dashboard">
                Go to dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 self-center">
            {[
              "Transparent, commission-light pricing",
              "Real-time occupancy analytics",
              "Instant booking notifications",
              "Verified member community",
            ].map((f) => (
              <li
                key={f}
                className="rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </div>
  );
}
