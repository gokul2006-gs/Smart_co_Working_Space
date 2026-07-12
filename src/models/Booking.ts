import mongoose, { Schema } from "mongoose";

export type BookingStatus =
  | "pending"
  | "awaiting_payment"
  | "confirmed"
  | "rejected"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "failed";

export interface BookingDocument {
  bookingId: string;
  spaceId: string;
  spaceName: string;
  spaceCity: string;
  spaceImage: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  date: string;
  seats: number;
  pricePerDay: number;
  totalAmount: number;
  startTime?: string;
  endTime?: string;
  status: BookingStatus;
  paymentProvider?: string;
  paymentStatus?: PaymentStatus;
  paymentSessionId?: string;
  paymentUrl?: string;
  paymentId?: string;
  paymentMethod?: string;
  paymentInstructions?: string;
  paymentReference?: string;
  ownerNotes?: string;
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingDocument>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    spaceId: { type: String, required: true, index: true },
    spaceName: { type: String, required: true },
    spaceCity: { type: String, required: true },
    spaceImage: { type: String, required: true },
    memberId: { type: String, required: true, index: true },
    memberName: { type: String, required: true },
    memberEmail: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    ownerEmail: { type: String, required: true },
    date: { type: String, required: true },
    seats: { type: Number, required: true, min: 1 },
    pricePerDay: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    startTime: { type: String },
    endTime: { type: String },
    status: {
      type: String,
      enum: ["pending", "awaiting_payment", "confirmed", "rejected", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentProvider: { type: String },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "failed"], default: "unpaid" },
    paymentSessionId: { type: String },
    paymentUrl: { type: String },
    paymentId: { type: String },
    paymentMethod: { type: String },
    paymentInstructions: { type: String },
    paymentReference: { type: String },
    ownerNotes: { type: String },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
);

import { resolveSpaceImage } from "@/lib/spaces";

export const BookingModel =
  mongoose.models.Booking ?? mongoose.model<BookingDocument>("Booking", bookingSchema);

export type BookingDTO = Omit<BookingDocument, "_id"> & { id: string };

export function toBookingDTO(doc: BookingDocument & { _id?: unknown }): BookingDTO {
  const { _id, ...rest } = doc as BookingDocument & { _id?: unknown };
  return {
    ...rest,
    spaceImage: resolveSpaceImage(rest.spaceImage),
    id: rest.bookingId,
  };
}
