import { Link } from "@tanstack/react-router";
import { Building2, Coffee, Menu, X, LogOut, ShieldCheck, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/spaces", label: "Spaces" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Coffee className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">Aperture</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {publicLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated && (
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Dashboard
            </Link>
          )}
          {user?.role === "space_owner" && (
            <Link
              to="/owner"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              My Spaces
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Desktop right actions */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="accent" size="sm">
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border/60 bg-background px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {publicLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            )}
            {user?.role === "space_owner" && (
              <Link
                to="/owner"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Building2 className="h-4 w-4" /> My Spaces
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ShieldCheck className="h-4 w-4" /> Admin Panel
              </Link>
            )}

            <div className="mt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  onClick={() => { setOpen(false); handleLogout(); }}
                >
                  <LogOut className="mr-1.5 h-4 w-4" /> Sign out ({user?.name})
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline">
                    <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
                  </Button>
                  <Button asChild variant="accent">
                    <Link to="/register" onClick={() => setOpen(false)}>Register</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
