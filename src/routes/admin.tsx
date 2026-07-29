import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Building2, ShieldCheck, CalendarClock, Plus, RefreshCw, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAdminData } from "@/lib/bookings-data";
import { bookingStatusLabels, bookingStatusStyles, formatBookingDate } from "@/lib/booking-utils";
import type { BookingDTO } from "@/models/Booking";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    if (context.user.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  loader: () =>
    fetchAdminData().catch(() => ({
      bookings: [],
      users: [],
      stats: { userCount: 0, spaceCount: 0, total: 0, pending: 0, awaitingPayment: 0, confirmed: 0, rejected: 0 },
    })),
  head: () => ({ meta: [{ title: "Admin Panel — Aperture" }, { name: "robots", content: "noindex" }] }),
  component: AdminPanel,
});

const roleBadge: Record<string, string> = {
  user: "bg-secondary text-secondary-foreground",
  space_owner: "bg-accent/15 text-accent",
  admin: "bg-destructive/15 text-destructive",
};

type AdminUser = { id: string; name: string; email: string; role: string; createdAt?: string };

function AdminPanel() {
  const { user } = Route.useRouteContext();
  const initial = Route.useLoaderData();
  const [users, setUsers] = useState<AdminUser[]>(initial.users);
  const [bookings, setBookings] = useState<BookingDTO[]>(initial.bookings);
  const [stats, setStats] = useState(initial.stats);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as "user" | "space_owner" | "admin" });
  const [activeTab, setActiveTab] = useState<"users" | "bookings">("users");

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchAdminData();
      setUsers(data.users);
      setBookings(data.bookings);
      setStats(data.stats);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { user?: AdminUser; error?: string };
      if (!res.ok || data.error) { toast.error(data.error ?? "Failed to create user"); return; }
      toast.success(`${form.name} created as ${form.role}`);
      setForm({ name: "", email: "", password: "", role: "user" });
      setShowForm(false);
      await refresh();
    } catch {
      toast.error("Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const members = users.filter((u) => u.role === "user");
  const owners = users.filter((u) => u.role === "space_owner");
  const admins = users.filter((u) => u.role === "admin");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <p className="eyebrow">Admin Panel</p>
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold">Platform overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.name} (admin)</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 space-y-10">

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Users, label: "Total users", value: stats.userCount },
            { icon: Building2, label: "Space owners", value: owners.length },
            { icon: CalendarClock, label: "Total bookings", value: stats.total },
            { icon: CheckCircle2, label: "Confirmed & paid", value: stats.confirmed },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-5 shadow-soft">
              <s.icon className="h-5 w-5 text-accent" />
              <p className="mt-3 font-display text-3xl font-bold">{s.value}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Booking pipeline summary */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Pending", value: stats.pending, style: "bg-amber-500/10 text-amber-700" },
            { label: "Awaiting payment", value: stats.awaitingPayment, style: "bg-blue-500/10 text-blue-700" },
            { label: "Confirmed", value: stats.confirmed, style: "bg-green-500/10 text-green-700" },
            { label: "Rejected", value: stats.rejected, style: "bg-destructive/10 text-destructive" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg px-4 py-3 text-sm font-medium ${s.style}`}>
              {s.label}: <span className="font-bold text-lg ml-1">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeTab === "users" ? "accent" : "outline"}
                onClick={() => setActiveTab("users")}
              >
                <Users className="mr-1.5 h-4 w-4" /> Users
              </Button>
              <Button
                size="sm"
                variant={activeTab === "bookings" ? "accent" : "outline"}
                onClick={() => setActiveTab("bookings")}
              >
                <CalendarClock className="mr-1.5 h-4 w-4" /> Bookings
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={refreshing} onClick={refresh}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {activeTab === "users" && (
                <Button size="sm" variant="accent" onClick={() => setShowForm((v) => !v)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add user
                </Button>
              )}
            </div>
          </div>

          {/* Create user form */}
          {activeTab === "users" && showForm && (
            <form
              onSubmit={handleCreateUser}
              className="mb-6 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="u-name">Full name</Label>
                <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="u-email">Email</Label>
                <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="u-pass">Password</Label>
                <Input id="u-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="u-role">Role</Label>
                <select
                  id="u-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="user">Member (user)</option>
                  <option value="space_owner">Space Owner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" variant="accent" size="sm" disabled={creating}>
                  {creating ? "Creating…" : "Create user"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <div className="space-y-6">
              {/* Members */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Members ({members.length})
                </h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">No members yet.</td></tr>
                      ) : members.map((u) => (
                        <tr key={u.id} className="border-t border-border">
                          <td className="px-4 py-3 font-medium">{u.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[u.role]}`}>{u.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Space Owners */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Space Owners ({owners.length})
                </h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owners.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">No space owners yet.</td></tr>
                      ) : owners.map((u) => (
                        <tr key={u.id} className="border-t border-border">
                          <td className="px-4 py-3 font-medium">{u.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[u.role]}`}>{u.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admins */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Admins ({admins.length})
                </h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Email</th>
                        <th className="px-4 py-3 text-left font-semibold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((u) => (
                        <tr key={u.id} className="border-t border-border">
                          <td className="px-4 py-3 font-medium">{u.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[u.role]}`}>{u.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === "bookings" && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[860px] text-sm">
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
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No bookings yet.</td>
                    </tr>
                  ) : bookings.map((b) => (
                    <tr key={b.bookingId} className="border-t border-border hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium">{b.spaceName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.memberName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.ownerName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBookingDate(b.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">${b.totalAmount}</span>
                        <span className="ml-1 text-xs text-muted-foreground">
                          (₹{(b.totalAmount * 83).toLocaleString("en-IN")})
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bookingStatusStyles[b.status]}`}>
                          {bookingStatusLabels[b.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.paymentStatus === "paid" ? (
                          <span className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                          </span>
                        ) : b.paymentProvider ? (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <CreditCard className="h-3.5 w-3.5" /> {b.paymentProvider}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
