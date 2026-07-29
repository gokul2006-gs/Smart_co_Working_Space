import { createServerFn } from "@tanstack/react-start";

import { connectDB } from "@/lib/db";
import { spaces as fallbackSpaces, type Space, resolveSpaceImage } from "@/lib/spaces";
import { SpaceModel } from "@/models/Space";
import { UserModel } from "@/models/User";

function toSpace(doc: Record<string, unknown>): Space {
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
    image: resolveSpaceImage(String(doc.image)),
    amenities: doc.amenities as string[],
    description: String(doc.description),
    host: String(doc.host),
    ownerEmail: doc.ownerEmail ? String(doc.ownerEmail) : undefined,
    paymentMethod: (doc.paymentMethod as Space["paymentMethod"]) ?? "global",
    manualPaymentInstructions: doc.manualPaymentInstructions
      ? String(doc.manualPaymentInstructions)
      : undefined,
  };
}

export const getSpaces = createServerFn({ method: "GET" }).handler(async (): Promise<Space[]> => {
  try {
    await connectDB();
    const docs = await SpaceModel.find().sort({ createdAt: 1 }).lean();
    if (docs.length === 0) {
      return fallbackSpaces;
    }
    return docs.map((doc) => toSpace(doc as Record<string, unknown>));
  } catch (err) {
    console.warn("MongoDB unavailable, using fallback data:", (err as Error).message);
    return fallbackSpaces;
  }
});

export const getSpaceById = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Space | null> => {
    try {
      await connectDB();
      const doc = await SpaceModel.findOne({ id: data.id }).lean();
      if (doc) {
        const space = toSpace(doc as Record<string, unknown>);
        if (doc.ownerId) {
          const owner = await UserModel.findById(String(doc.ownerId)).lean();
          if (owner?.email) {
            space.ownerEmail = owner.email;
          }
        }
        return space;
      }
    } catch (err) {
      console.warn("MongoDB unavailable, using fallback data:", (err as Error).message);
    }
    return fallbackSpaces.find((space) => space.id === data.id) ?? null;
  });
