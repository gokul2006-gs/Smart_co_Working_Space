import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SpaceCard } from "@/components/SpaceCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/spaces-data";
import { spaceTypes, type SpaceType } from "@/lib/spaces";

export const Route = createFileRoute("/spaces/")({
  loader: () => getSpaces(),
  head: () => ({
    meta: [
      { title: "Browse Spaces — Aperture" },
      {
        name: "description",
        content:
          "Browse premium coworking spaces: hot desks, private offices, meeting rooms, and lounges with real-time availability.",
      },
      { property: "og:title", content: "Browse Spaces — Aperture" },
      {
        property: "og:description",
        content: "Find and filter premium coworking spaces near you.",
      },
    ],
  }),
  component: SpacesPage,
});

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

function SpacesPage() {
  const spaces = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SpaceType | "All">("All");
  const [sort, setSort] = useState<Sort>("featured");

  const results = useMemo(() => {
    let list = spaces.filter((s) => {
      const matchesType = type === "All" || s.type === type;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return 0;
    });
    return list;
  }, [query, type, sort]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16 reveal">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
          <p className="eyebrow">The collection</p>
          <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">
            Find your space
          </h1>
          <p className="mt-3 max-w-xl font-serif-body text-muted-foreground">
            {spaces.length} curated workspaces across {new Set(spaces.map((s) => s.city)).size}{" "}
            cities. Filter to your flow.
          </p>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or city…"
                className="h-11 pl-10"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to high</option>
              <option value="price-desc">Price: High to low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["All", ...spaceTypes] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={type === t ? "accent" : "outline"}
                onClick={() => setType(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-8 reveal">
        <p className="mb-8 text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "space" : "spaces"} found
        </p>
        {results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-24 text-center">
            <p className="font-display text-xl font-bold">No spaces match</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different search or clear your filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 reveal-stagger">
            {results.map((s) => (
              <SpaceCard key={s.id} space={s} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
