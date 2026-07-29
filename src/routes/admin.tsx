import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  Users, Building2, ShieldCheck, CalendarClock, Plus,
  RefreshCw, CreditCard, CheckCircle2, UserCheck, UserCog,
} from "lucide-react";
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

const roleLabel: Record<string, string> = {
  user: "Member",
  space_owner: "Space Owner",
  admin: "Admin",
};

type AdminUser = { id: string; name: string; email: string; role: string };

/** User card for mobile view */
function UserCard({ u }: { u: AdminUser }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-bold text-sm">
        {u.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{u.name}</p>
        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${roleBadge[u.role]}`}>
        {roleLabel[u.role] ?? u.role}
      </span>
    </div>
  );
}

function AdminPanel() {
  const { user } = Route.useRouteContext();
  const initial = Route.useLoaderData();
  const [users, setUsers] = useState<AdminUser[]>(initial.users);
  const [bookings, setBookings] = useState<BookingDTO[]>(initial.bookings);
  const [stats, setStats] = useState(initial.stats);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    role: "user" as "user" | "space_owner" | "admin",
  });
  const [activeTab, setActiveTab] = useState<"users" | "bookings">("users");

  const refresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchAdminData();
      setUsers(data.users);
      setBookings(data.bookings);
      setStats(data.stats);
      toast.success("Data refreshed");
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
      toast.success(`${form.name} created as ${roleLabel[form.role]}`);
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

      {/* Header */}
      <section className="border-b border-border bg-secondary/30 pt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <p className="eyebrow">Admin Panel</p>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Platform overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.name}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 space-y-8">

        {/* Stats — 2 col on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Users, label: "Total users", value: stats.userCount, color: "text-blue-600" },
            { icon: Building2, label: "Space owners", value: owners.length, color: "text-accent" },
            { icon: CalendarClock, label: "Total bookings", value: stats.total, color: "text-amber-600" },
            { icon: CheckCircle2, label: "Paid bookings", value: stats.confirmed, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <p className="mt-2 font-display text-2xl font-bold md:text-3xl">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Booking pipeline — scrollable row on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { label: "Pending", value: stats.pending, style: "bg-amber-500/10 text-amber-700 border-amber-200" },
            { label: "Awaiting pay", value: stats.awaitingPayment, style: "bg-blue-500/10 text-blue-700 border-blue-200" },
            { label: "Confirmed", value: stats.confirmed, style: "bg-green-500/10 text-green-700 border-green-200" },
            { label: "Rejected", value: stats.rejected, style: "bg-destructive/10 text-destructive border-destructive/20" },
          ].map((s) => (
            <div key={s.label} className={`flex-shrink-0 rounded-lg border px-4 py-2.5 text-sm font-medium ${s.style}`}>
              <span className="block text-xl font-bold">{s.value}</span>
              <span className="text-xs">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            {/* Tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "users"
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Users className="h-4 w-4" /> Users
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                  activeTab === "bookings"
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                <CalendarClock className="h-4 w-4" /> Bookings
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={refreshing} onClick={refresh}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {activeTab === "users" && (
                <Button size="sm" variant="accent" onClick={() => setShowForm((v) => !v)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add user</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              )}
            </div>
          </div>

          {/* Create user form */}
          {activeTab === "users" && showForm && (
            <form
              onSubmit={handleCreateUser}
              className="mb-6 rounded-xl border border-border bg-card p-4 space-y-4"
            >
              <h3 className="font-semibold text-sm">Create new user</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="u-name" className="text-xs mb-1 block">Full name</Label>
                  <Input id="u-name" placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="u-email" className="text-xs mb-1 block">Email</Label>
                  <Input id="u-email" type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="u-pass" className="text-xs mb-1 block">Password</Label>
                  <Input id="u-pass" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
                </div>
                <div>
                  <Label htmlFor="u-role" className="text-xs mb-1 block">Role</Label>
                  <select
                    id="u-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="user">Member</option>
                    <option value="space_owner">Space Owner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="accent" size="sm" disabled={creating}>
                  {creating ? "Creating…" : "Create user"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* ── USERS TAB ── */}
          {activeTab === "users" && (
            <div className="space-y-6">

              {/* Members */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Members <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs">{members.length}</span>
                  </h3>
                </div>

                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">No members yet.</p>
                ) : (
                  <>
                    {/* Mobile: cards */}
                    <div className="space-y-2 sm:hidden">
                      {members.map((u) => <UserCard key={u.id} u={u} />)}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden sm:block overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((u) => (
                            <tr key={u.id} className="border-t border-border hover:bg-secondary/20">
                              <td className="px-4 py-3 font-medium">{u.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[u.role]}`}>
                                  {roleLabel[u.role]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Space Owners */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Space Owners <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs">{owners.length}</span>
                  </h3>
                </div>

                {owners.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">No space owners yet.</p>
                ) : (
                  <>
                    <div className="space-y-2 sm:hidden">
                      {owners.map((u) => <UserCard key={u.id} u={u} />)}
                    </div>
                    <div className="hidden sm:block overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {owners.map((u) => (
                            <tr key={u.id} className="border-t border-border hover:bg-secondary/20">
                              <td className="px-4 py-3 font-medium">{u.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[u.role]}`}>
                                  {roleLabel[u.role]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Admins */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Admins <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs">{admins.length}</span>
                  </h3>
                </div>

                {admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">No admins yet.</p>
                ) : (
                  <>
                    <div className="space-y-2 sm:hidden">
                      {admins.map((u) => <UserCard key={u.id} u={u} />)}
                    </div>
                    <div className="hidden sm:block overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admins.map((u) => (
                            <tr key={u.id} className="border-t border-border hover:bg-secondary/20">
                              <td className="px-4 py-3 font-medium">{u.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge[u.role]}`}>
                                  {roleLabel[u.role]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── BOOKINGS TAB ── */}
          {activeTab === "bookings" && (
            <div>
              {bookings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                  No bookings yet.
                </div>
              ) : (
                <>
                  {/* Mobile: booking cards */}
                  <div className="space-y-3 sm:hidden">
                    {bookings.map((b) => (
                      <div key={b.bookingId} className="rounded-xl border border-border bg-card p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-tight">{b.spaceName}</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${bookingStatusStyles[b.status]}`}>
                            {bookingStatusLabels[b.status]}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>Member: <span className="text-foreground font-medium">{b.memberName}</span></p>
                          <p>Owner: <span className="text-foreground">{b.ownerName}</span></p>
                          <p>Date: {formatBookingDate(b.date)}</p>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border">
                          <span className="font-semibold text-sm">
                            ₹{(b.totalAmount * 83).toLocaleString("en-IN")}
                            <span className="ml-1 text-xs text-muted-foreground">(${b.totalAmount})</span>
                          </span>
                          {b.paymentStatus === "paid" ? (
                            <span className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{b.paymentProvider ?? "—"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead className="bg-secondary/50">
                        <tr>
                          {["Space", "Member", "Owner", "Date", "Amount", "Status", "Payment"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b) => (
                          <tr key={b.bookingId} className="border-t border-border hover:bg-secondary/20">
                            <td className="px-4 py-3 font-medium">{b.spaceName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{b.memberName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{b.ownerName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatBookingDate(b.date)}</td>
                            <td className="px-4 py-3">
                              <span className="font-medium">${b.totalAmount}</span>
                              <span className="ml-1 text-xs text-muted-foreground">(₹{(b.totalAmount * 83).toLocaleString("en-IN")})</span>
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
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
