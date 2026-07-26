import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Building2, ShieldCheck, CalendarClock, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAdminData } from "@/lib/bookings-data";
import {
  bookingStatusLabels,
  bookingStatusStyles,
  formatBookingDate,
} from "@/lib/booking-utils";
import { spaces } from "@/lib/spaces";
import type { BookingDTO } from "@/models/Booking";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    if (context.user.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  loader: () => fetchAdminData().catch((err) => {
    console.error("Admin data load failed:", err);
    return { bookings: [], users: [], stats: { userCount: 0, spaceCount: 0, total: 0, pending: 0, awaitingPayment: 0, confirmed: 0, rejected: 0 } };
  }),
  head: () => ({
    meta: [
      { title: "Admin Panel — Aperture" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const roleBadgeStyle: Record<string, string> = {
  user: "bg-secondary text-secondary-foreground",
  space_owner: "bg-accent/15 text-accent",
  admin: "bg-destructive/15 text-destructive",
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function AdminPage() {
  const { user } = Route.useRouteContext();
  const initialData = Route.useLoaderData();
  const [users, setUsers] = useState<AdminUser[]>(initialData.users);
  const [bookings, setBookings] = useState<BookingDTO[]>(initialData.bookings);
  const [stats, setStats] = useState(initialData.stats);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "space_owner" | "admin",
  });

  const refreshData = async () => {
    const data = await fetchAdminData();
    setUsers(data.users);
    setBookings(data.bookings);
    setStats(data.stats);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { user?: AdminUser; error?: string };
      if (!response.ok || result.error) {
        toast.error(result.error ?? "Failed to create user");
        return;
      }
      toast.success(`User ${form.name} created as ${form.role}`);
      setForm({ name: "", email: "", password: "", role: "user" });
      setShowForm(false);
      await refreshData();
    } catch {
      toast.error("Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <p className="eyebrow">Admin Panel</p>
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Platform overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">Signed in as {user?.name} (admin)</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 space-y-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, label: "Total users", value: stats.userCount },
            { icon: Building2, label: "Listed spaces", value: stats.spaceCount || spaces.length },
            { icon: CalendarClock, label: "Total bookings", value: stats.total },
            { icon: ShieldCheck, label: "Pending approval", value: stats.pending },
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

        {/* Create user (admin only) */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">User management</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Admins can register members, space owners, and other admins.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={refreshData}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
              </Button>
              <Button size="sm" variant="accent" onClick={() => setShowForm((v) => !v)}>
                <Plus className="mr-1.5 h-4 w-4" /> Create user
              </Button>
            </div>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreateUser}
              className="mt-5 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="admin-name">Full name</Label>
                <Input
                  id="admin-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
              <div>
                <Label htmlFor="admin-role">Role</Label>
                <select
                  id="admin-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as typeof form.role })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="user">Member</option>
                  <option value="space_owner">Space Owner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" variant="accent" disabled={creating}>
                  {creating ? "Creating…" : "Create user"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeStyle[u.role]}`}
                      >
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* All bookings */}
        <div>
          <h2 className="font-display text-2xl font-bold">All bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Full audit trail — member requests, owner responses, and payment details.
          </p>
          <div className="mt-5 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Space</th>
                  <th className="px-4 py-3 text-left font-semibold">Member</th>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No bookings yet.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.bookingId} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{b.spaceName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.memberName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.ownerName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBookingDate(b.date)}</td>
                      <td className="px-4 py-3">${b.totalAmount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bookingStatusStyles[b.status]}`}
                        >
                          {bookingStatusLabels[b.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {b.paymentMethod ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Spaces overview */}
        <div>
          <h2 className="font-display text-2xl font-bold">All spaces</h2>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">City</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Price/day</th>
                  <th className="px-4 py-3 text-left font-semibold">Host</th>
                </tr>
              </thead>
              <tbody>
                {spaces.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.city}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.type}</td>
                    <td className="px-4 py-3">${s.price}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.host}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
