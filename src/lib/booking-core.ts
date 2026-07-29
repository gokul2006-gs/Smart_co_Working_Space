import { z } from "zod";

import { connectDB } from "@/lib/db";
import {
  notifyMemberBookingConfirmed,
  notifyMemberBookingRejected,
  notifyOwnerNewBooking,
} from "@/lib/email";
import { createPaymentSession } from "@/lib/payment.server";
import { isPaymentGatewayEnabled, getPaymentProvider, type PaymentProvider } from "@/lib/payment";
import { spaces as fallbackSpaces, type Space, resolveSpaceImage } from "@/lib/spaces";
import { BookingModel, toBookingDTO, type BookingDTO } from "@/models/Booking";
import { SpaceModel } from "@/models/Space";
import type { SpacePaymentMethod } from "@/models/Space";
import { UserModel } from "@/models/User";
import type { SessionPayload } from "@/lib/session";

/** Bookings with no specific owner yet — visible to all space owners */
export const UNASSIGNED_OWNER = "unassigned";

/**
 * Resolve the effective payment provider for a space.
 * "global" defers to the app-level PAYMENT_PROVIDER env var.
 */
function resolveSpacePaymentProvider(spacePaymentMethod?: SpacePaymentMethod): {
  provider: PaymentProvider;
  gatewayEnabled: boolean;
} {
  const method = spacePaymentMethod ?? "global";
  if (method === "global") {
    const provider = getPaymentProvider();
    return { provider, gatewayEnabled: provider === "stripe" || provider === "razorpay" };
  }
  if (method === "manual") return { provider: "manual", gatewayEnabled: false };
  return { provider: method, gatewayEnabled: true };
}

export const createBookingSchema = z.object({
  spaceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  seats: z.number().int().min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM").optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be HH:MM").optional(),
});

export const acceptBookingSchema = z.object({
  paymentMethod: z.string().optional(),
  paymentInstructions: z.string().optional(),
  paymentReference: z.string().optional(),
  ownerNotes: z.string().optional(),
});

function generateBookingId(): string {
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type SpaceForBooking = Space & { ownerId?: string; paymentMethod?: SpacePaymentMethod; manualPaymentInstructions?: string };

async function findSpaceForBooking(spaceId: string): Promise<SpaceForBooking | null> {
  await connectDB();

  const doc = await SpaceModel.findOne({ id: spaceId }).lean();
  if (doc) {
    return {
      id: String(doc.id),
      name: String(doc.name),
      tagline: String(doc.tagline),
      city: String(doc.city),
      neighborhood: String(doc.neighborhood),
      type: doc.type as Space["type"],
      price: Number(doc.price),
      rating: Number(doc.rating),
      reviews: Number(doc.reviews),
      capacity: Number(doc.capacity),
      seatsAvailable: Number(doc.seatsAvailable),
      // Store the raw canonical path (e.g. "/assets/space-1.jpg"), NOT resolveSpaceImage's
      // output. resolveSpaceImage returns a build-specific bundled asset URL (Vite content
      // hash), and that string gets copied straight into the Booking document at creation
      // time. If we resolved it here, the hash would be frozen into the DB forever and break
      // the moment the app is rebuilt/redeployed. Resolve at read-time instead (toBookingDTO /
      // getMemberBookings do this), so the image always matches the currently running build.
      image: String(doc.image),
      amenities: doc.amenities as string[],
      description: String(doc.description),
      host: String(doc.host),
      ownerId: doc.ownerId ? String(doc.ownerId) : undefined,
      paymentMethod: (doc.paymentMethod as SpacePaymentMethod) ?? "global",
      manualPaymentInstructions: doc.manualPaymentInstructions
        ? String(doc.manualPaymentInstructions)
        : undefined,
    };
  }

  return fallbackSpaces.find((s) => s.id === spaceId) ?? null;
}

async function resolveOwnerForSpace(space: SpaceForBooking): Promise<{
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
}> {
  if (space.ownerId) {
    const owner = await UserModel.findById(space.ownerId).lean();
    if (owner && owner.role === "space_owner") {
      return {
        ownerId: owner._id.toString(),
        ownerName: owner.name,
        ownerEmail: owner.email,
      };
    }
  }

  const owners = await UserModel.find({ role: "space_owner" }).lean();

  // Only one owner in the system — assign directly
  if (owners.length === 1) {
    return {
      ownerId: owners[0]._id.toString(),
      ownerName: owners[0].name,
      ownerEmail: owners[0].email,
    };
  }

  // Multiple owners or none — leave unassigned so all owners can see & claim
  return {
    ownerId: UNASSIGNED_OWNER,
    ownerName: "Awaiting owner",
    ownerEmail: "",
  };
}

/**
 * Commit or release seats against a space's seatsAvailable counter.
 * Pass a negative delta to reserve seats (on confirmation) and a positive
 * delta to release them back (on cancellation of an already-confirmed
 * booking). No-op for spaces that only exist in the static fallback catalog
 * (no DB document to update).
 */
async function adjustSeatsAvailable(spaceId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  await connectDB();
  await SpaceModel.updateOne(
    { id: spaceId },
    [
      {
        $set: {
          seatsAvailable: {
            $max: [0, { $min: ["$capacity", { $add: ["$seatsAvailable", delta] }] }],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
}

function ownerCanManageBooking(
  actor: SessionPayload,
  booking: { ownerId: string; status: string },
): boolean {
  if (actor.role === "admin") return true;
  if (actor.role !== "space_owner") return false;
  if (booking.ownerId === actor.userId) return true;
  // Any space owner can claim unassigned pending bookings
  if (booking.ownerId === UNASSIGNED_OWNER && booking.status === "pending") return true;
  return false;
}

export async function createBooking(
  member: SessionPayload,
  data: z.infer<typeof createBookingSchema>,
): Promise<{ booking?: BookingDTO; error?: string }> {
  if (member.role !== "user") {
    return { error: "Only members can request bookings" };
  }

  const space = await findSpaceForBooking(data.spaceId);
  if (!space) return { error: "Space not found" };

  if (data.seats > space.seatsAvailable) {
    return { error: `Only ${space.seatsAvailable} seats available` };
  }

  const owner = await resolveOwnerForSpace(space);
  const totalAmount = space.price * data.seats;
  const bookingId = generateBookingId();
  const startTime = data.startTime ?? "09:00";
  const endTime = data.endTime ?? "18:00";

  if (startTime >= endTime) {
    return { error: "End time must be after start time" };
  }

  const booking = await BookingModel.create({
    bookingId,
    spaceId: space.id,
    spaceName: space.name,
    spaceCity: space.city,
    spaceImage: space.image,
    memberId: member.userId,
    memberName: member.name,
    memberEmail: member.email,
    ownerId: owner.ownerId,
    ownerName: owner.ownerName,
    ownerEmail: owner.ownerEmail,
    date: data.date,
    seats: data.seats,
    startTime,
    endTime,
    pricePerDay: space.price,
    totalAmount,
    status: "pending",
    paymentStatus: "unpaid",
  });

  const dto = toBookingDTO(booking.toObject());

  // Notify owner(s) — specific owner or all space owners if unassigned
  const ownerEmails: string[] = [];
  if (owner.ownerEmail) {
    ownerEmails.push(owner.ownerEmail);
  } else {
    const allOwners = await UserModel.find({ role: "space_owner" }).lean();
    ownerEmails.push(...allOwners.map((o) => o.email));
  }
  notifyOwnerNewBooking(dto, ownerEmails);

  return { booking: dto };
}

/**
 * Booked spaceImage values can go stale (see the comment in findSpaceForBooking above) —
 * either from bookings created before this fix, or simply because a space's photo changed
 * after the booking was made. Re-resolve each booking's image against the space's current
 * image at read time so the dashboard always shows something that actually exists.
 */
async function attachLiveSpaceImages(bookings: BookingDTO[]): Promise<BookingDTO[]> {
  const spaceIds = [...new Set(bookings.map((b) => b.spaceId))];
  if (spaceIds.length === 0) return bookings;

  const spaceDocs = await SpaceModel.find({ id: { $in: spaceIds } }).lean();
  const imageBySpaceId = new Map(
    spaceDocs.map((s) => [s.id, resolveSpaceImage(String(s.image))]),
  );

  return bookings.map((b) => {
    const liveImage = imageBySpaceId.get(b.spaceId);
    return liveImage ? { ...b, spaceImage: liveImage } : b;
  });
}

export async function getMemberBookings(memberId: string): Promise<BookingDTO[]> {
  await connectDB();
  const docs = await BookingModel.find({ memberId }).sort({ createdAt: -1 }).lean();
  const bookings = docs.map((doc) => toBookingDTO(doc as Parameters<typeof toBookingDTO>[0]));
  return attachLiveSpaceImages(bookings);
}

export async function getOwnerBookings(ownerId: string): Promise<BookingDTO[]> {
  await connectDB();

  await fixLegacyBookingOwnership();

  const ownedSpaceIds = await SpaceModel.find({ ownerId }).distinct("id");

  const orConditions: Record<string, unknown>[] = [
    { ownerId },
    { ownerId: UNASSIGNED_OWNER },
  ];

  if (ownedSpaceIds.length > 0) {
    orConditions.push({ spaceId: { $in: ownedSpaceIds } });
  }

  const docs = await BookingModel.find({ $or: orConditions })
    .sort({ createdAt: -1 })
    .lean();

  // Deduplicate in case a booking matches multiple conditions
  const seen = new Set<string>();
  const unique = docs.filter((doc) => {
    if (seen.has(doc.bookingId)) return false;
    seen.add(doc.bookingId);
    return true;
  });

  const bookings = unique.map((doc) => toBookingDTO(doc as Parameters<typeof toBookingDTO>[0]));
  return attachLiveSpaceImages(bookings);
}

export async function getAllBookings(): Promise<BookingDTO[]> {
  await connectDB();
  const docs = await BookingModel.find().sort({ createdAt: -1 }).lean();
  const bookings = docs.map((doc) => toBookingDTO(doc as Parameters<typeof toBookingDTO>[0]));
  return attachLiveSpaceImages(bookings);
}

export async function acceptBooking(
  actor: SessionPayload,
  bookingId: string,
  data: z.infer<typeof acceptBookingSchema>,
): Promise<{ booking?: BookingDTO; error?: string }> {
  await connectDB();

  const booking = await BookingModel.findOne({ bookingId });
  if (!booking) return { error: "Booking not found" };

  if (booking.status !== "pending") {
    return { error: "This booking has already been processed" };
  }

  if (!ownerCanManageBooking(actor, booking)) {
    return { error: "You are not allowed to accept this booking" };
  }

  // Claim unassigned booking for this owner
  if (booking.ownerId === UNASSIGNED_OWNER && actor.role === "space_owner") {
    booking.ownerId = actor.userId;
    booking.ownerName = actor.name;
    booking.ownerEmail = actor.email;
  }

  booking.ownerNotes = data.ownerNotes;

  // Resolve payment method: space-level setting takes priority over global env var
  const spaceDoc = await SpaceModel.findOne({ id: booking.spaceId }).lean();
  const { provider, gatewayEnabled } = resolveSpacePaymentProvider(
    spaceDoc?.paymentMethod as SpacePaymentMethod | undefined,
  );

  if (gatewayEnabled) {
    // Don't create a payment link/session at accept time.
    // The Razorpay order is created on-demand when the member clicks "Pay Now"
    // so the inline checkout popup can be used instead of a redirect.
    booking.status = "awaiting_payment";
    booking.paymentProvider = provider;
    booking.paymentStatus = "unpaid";
    booking.paymentMethod = provider === "stripe" ? "Stripe" : "Razorpay — Net Banking";
    booking.paymentInstructions = `Pay securely via ${provider === "stripe" ? "Stripe" : "Razorpay"}`;
    await booking.save();

    const saved = toBookingDTO(booking.toObject());
    notifyMemberBookingConfirmed(saved, { gateway: true });
    return { booking: saved };
  }

  // Manual payment — use space's pre-configured instructions or owner-provided ones
  const spaceInstructions = spaceDoc?.manualPaymentInstructions?.trim();
  const instructions = data.paymentInstructions?.trim() || spaceInstructions;

  if (!instructions) {
    return { error: "Payment instructions are required when no payment gateway is configured" };
  }

  booking.status = "confirmed";
  booking.paymentMethod = data.paymentMethod ?? "Manual";
  booking.paymentInstructions = instructions;
  booking.paymentReference = data.paymentReference;
  booking.paymentProvider = "manual";
  booking.paymentStatus = "unpaid";
  booking.confirmedAt = new Date();
  await booking.save();
  await adjustSeatsAvailable(booking.spaceId, -booking.seats);

  const saved = toBookingDTO(booking.toObject());
  notifyMemberBookingConfirmed(saved, { gateway: false });
  return { booking: saved };
}

export async function rejectBooking(
  actor: SessionPayload,
  bookingId: string,
  ownerNotes?: string,
): Promise<{ booking?: BookingDTO; error?: string }> {
  await connectDB();

  const booking = await BookingModel.findOne({ bookingId });
  if (!booking) return { error: "Booking not found" };

  if (booking.status !== "pending") {
    return { error: "This booking has already been processed" };
  }

  if (!ownerCanManageBooking(actor, booking)) {
    return { error: "You are not allowed to reject this booking" };
  }

  if (booking.ownerId === UNASSIGNED_OWNER && actor.role === "space_owner") {
    booking.ownerId = actor.userId;
    booking.ownerName = actor.name;
    booking.ownerEmail = actor.email;
  }

  booking.status = "rejected";
  if (ownerNotes) booking.ownerNotes = ownerNotes;
  await booking.save();

  const saved = toBookingDTO(booking.toObject());
  notifyMemberBookingRejected(saved);
  return { booking: saved };
}

/** Member cancels their own booking. Releases any seats already committed. */
export async function cancelBooking(
  actor: SessionPayload,
  bookingId: string,
): Promise<{ booking?: BookingDTO; error?: string }> {
  await connectDB();

  const booking = await BookingModel.findOne({ bookingId });
  if (!booking) return { error: "Booking not found" };

  const isOwnerOfBooking = booking.memberId === actor.userId;
  if (!isOwnerOfBooking && actor.role !== "admin") {
    return { error: "You are not allowed to cancel this booking" };
  }

  if (!["pending", "awaiting_payment", "confirmed"].includes(booking.status)) {
    return { error: "This booking can no longer be cancelled" };
  }

  const wasConfirmed = booking.status === "confirmed";
  booking.status = "cancelled";
  await booking.save();

  if (wasConfirmed) {
    await adjustSeatsAvailable(booking.spaceId, booking.seats);
  }

  return { booking: toBookingDTO(booking.toObject()) };
}

/** Owner (or admin) marks a confirmed, past-dated booking as completed. */
export async function completeBooking(
  actor: SessionPayload,
  bookingId: string,
): Promise<{ booking?: BookingDTO; error?: string }> {
  await connectDB();

  const booking = await BookingModel.findOne({ bookingId });
  if (!booking) return { error: "Booking not found" };

  if (!ownerCanManageBooking(actor, booking)) {
    return { error: "You are not allowed to update this booking" };
  }

  if (booking.status !== "confirmed") {
    return { error: "Only confirmed bookings can be marked complete" };
  }

  const endOfBookingDay = new Date(`${booking.date}T23:59:59`);
  if (endOfBookingDay.getTime() > Date.now()) {
    return { error: "This booking's date hasn't passed yet" };
  }

  booking.status = "completed";
  await booking.save();

  return { booking: toBookingDTO(booking.toObject()) };
}

export async function getBookingStats() {
  await connectDB();
  const [total, pending, awaitingPayment, confirmed, rejected] = await Promise.all([
    BookingModel.countDocuments(),
    BookingModel.countDocuments({ status: "pending" }),
    BookingModel.countDocuments({ status: "awaiting_payment" }),
    BookingModel.countDocuments({ status: "confirmed" }),
    BookingModel.countDocuments({ status: "rejected" }),
  ]);
  return { total, pending, awaitingPayment, confirmed, rejected };
}

export async function getAllUsers() {
  await connectDB();
  const users = await UserModel.find().sort({ createdAt: -1 }).lean();
  return users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }));
}

export async function getAdminStats() {
  await connectDB();
  const [userCount, spaceCount, bookingStats] = await Promise.all([
    UserModel.countDocuments(),
    SpaceModel.countDocuments(),
    getBookingStats(),
  ]);
  return { userCount, spaceCount, ...bookingStats };
}

/** Reassign legacy bookings wrongly assigned to admin or another user */
export async function fixLegacyBookingOwnership(): Promise<void> {
  await connectDB();

  const spaceOwners = await UserModel.find({ role: "space_owner" }).lean();
  const adminIds = (await UserModel.find({ role: "admin" }).distinct("_id")).map(String);

  if (spaceOwners.length === 1) {
    const owner = spaceOwners[0];
    const ownerId = owner._id.toString();
    await BookingModel.updateMany(
      {
        status: "pending",
        ownerId: { $nin: [ownerId, UNASSIGNED_OWNER] },
      },
      {
        $set: {
          ownerId,
          ownerName: owner.name,
          ownerEmail: owner.email,
        },
      },
    );
    return;
  }

  // Multiple owners — move admin-assigned and unlinked-space bookings to the shared pool
  const unassignedUpdate = {
    ownerId: UNASSIGNED_OWNER,
    ownerName: "Awaiting owner",
    ownerEmail: "",
  };

  if (adminIds.length > 0) {
    await BookingModel.updateMany(
      { status: "pending", ownerId: { $in: adminIds } },
      { $set: unassignedUpdate },
    );
  }

  const pendingBookings = await BookingModel.find({ status: "pending" }).lean();
  for (const booking of pendingBookings) {
    if (booking.ownerId === UNASSIGNED_OWNER) continue;

    const space = await SpaceModel.findOne({ id: booking.spaceId }).lean();
    const spaceHasOwner = space?.ownerId && space.ownerId.length > 0;

    // Space has no linked owner — any space owner should be able to claim it
    if (!spaceHasOwner) {
      await BookingModel.updateOne(
        { bookingId: booking.bookingId },
        { $set: unassignedUpdate },
      );
    }
  }
}
