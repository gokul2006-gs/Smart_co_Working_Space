import { Link } from "@tanstack/react-router";
import { MapPin, Star, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Space } from "@/lib/spaces";

export function SpaceCard({ space }: { space: Space }) {
  const { isAuthenticated } = useAuth();
  const scarce = space.seatsAvailable <= 5;
  return (
    <Link
      to="/spaces/$id"
      params={{ id: space.id }}
      className="group block overflow-hidden rounded-lg border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant"
    >
      <div className="relative aspect-[4/3] overflow-hidden reveal-image">
        <img
          src={space.image}
          alt={space.name}
          loading="lazy"
          width={1200}
          height={900}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
          {space.type}
        </span>
        <span
          className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur ${
            scarce
              ? "bg-accent text-accent-foreground"
              : "bg-background/90 text-foreground"
          }`}
        >
          {space.seatsAvailable} seats left
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold leading-tight">
              {space.name}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {space.neighborhood}, {space.city}
            </p>
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4 fill-accent text-accent" />
            {space.rating.toFixed(1)}
          </span>
        </div>

        <p className="mt-3 font-serif-body text-sm italic text-muted-foreground">
          {space.tagline}
        </p>

        {isAuthenticated && space.ownerEmail ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${space.ownerEmail}`} className="hover:text-foreground">
              {space.ownerEmail}
            </a>
          </p>
        ) : null}

        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <p>
            <span className="font-display text-2xl font-bold">${space.price}</span>
            <span className="text-sm text-muted-foreground"> / day</span>
          </p>
          <span className="text-sm font-medium text-accent transition-transform group-hover:translate-x-0.5">
            View details →
          </span>
        </div>
      </div>
    </Link>
  );
}
