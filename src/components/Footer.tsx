import { Link } from "@tanstack/react-router";
import { Coffee } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Coffee className="h-5 w-5" />
              </span>
              <span className="font-display text-xl font-bold">Aperture</span>
            </div>
            <p className="mt-4 max-w-xs font-serif-body text-sm leading-relaxed text-muted-foreground">
              A curated platform connecting professionals with premium coworking
              spaces worldwide.
            </p>
          </div>

          <FooterCol
            title="Explore"
            items={[
              { label: "All spaces", to: "/spaces" },
              { label: "How it works", to: "/how-it-works" },
              { label: "Your dashboard", to: "/dashboard" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { label: "About", to: "/how-it-works" },
              { label: "For hosts", to: "/how-it-works" },
              { label: "Contact", to: "/how-it-works" },
            ]}
          />
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-widest">
              Stay in the loop
            </h4>
            <p className="mt-4 font-serif-body text-sm text-muted-foreground">
              New spaces, curated for you. No noise.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Aperture. Crafted for focused work.</p>
          <p className="font-serif-body italic">Find. Book. Thrive.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; to: string }[];
}) {
  return (
    <div>
      <h4 className="font-display text-sm font-bold uppercase tracking-widest">
        {title}
      </h4>
      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              to={i.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
