import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getSessionFromCookieHeader } from "@/lib/auth-core";
import {
  getAllBookings,
  getMemberBookings,
  getOwnerBookings,
  getAdminStats,
  getAllUsers,
} from "@/lib/booking-core";
import type { BookingDTO } from "@/models/Booking";
import type { SessionPayload } from "@/lib/session";

/**
 * Every handler below derives the acting user from the signed session cookie
 * rather than trusting an id supplied by the client. Never accept a
 * memberId/ownerId as input here -- that would let any logged-in user read
 * another user's bookings simply by passing a different id (IDOR).
 */
function requireSession(): SessionPayload {
  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? null;
  const user = getSessionFromCookieHeader(cookieHeader);
  if (!user) throw new Error("Unauthorized");
  return user;
}

export const fetchMemberBookings = createServerFn({ method: "GET" }).handler(
  async (): Promise<BookingDTO[]> => {
    const user = requireSession();
    return getMemberBookings(user.userId);
  },
);

export const fetchOwnerBookings = createServerFn({ method: "GET" }).handler(
  async (): Promise<BookingDTO[]> => {
    const user = requireSession();
    if (user.role !== "space_owner" && user.role !== "admin") {
      throw new Error("Forbidden");
    }
    return getOwnerBookings(user.userId);
  },
);

export const fetchAdminData = createServerFn({ method: "GET" }).handler(async () => {
  const user = requireSession();
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }

  const [users, bookings, stats] = await Promise.all([
    getAllUsers(),
    getAllBookings(),
    getAdminStats(),
  ]);
  return { users, bookings, stats };
});
