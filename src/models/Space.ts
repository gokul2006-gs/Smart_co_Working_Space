import mongoose, { Schema } from "mongoose";

import type { SpaceType } from "@/lib/spaces";

export interface SpaceDocument {
  id: string;
  name: string;
  tagline: string;
  city: string;
  neighborhood: string;
  type: SpaceType;
  price: number;
  rating: number;
  reviews: number;
  capacity: number;
  seatsAvailable: number;
  image: string;
  amenities: string[];
  description: string;
  host: string;
  ownerId?: string;
}

const spaceSchema = new Schema<SpaceDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    city: { type: String, required: true },
    neighborhood: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["Hot Desk", "Private Office", "Meeting Room", "Lounge"],
    },
    price: { type: Number, required: true },
    rating: { type: Number, required: true },
    reviews: { type: Number, required: true },
    capacity: { type: Number, required: true },
    seatsAvailable: { type: Number, required: true },
    image: { type: String, required: true },
    amenities: { type: [String], required: true },
    description: { type: String, required: true },
    host: { type: String, required: true },
    ownerId: { type: String, index: true },
  },
  { timestamps: true },
);

export const SpaceModel =
  mongoose.models.Space ?? mongoose.model<SpaceDocument>("Space", spaceSchema);
