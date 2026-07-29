import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionFromCookieHeader } from "@/lib/auth-core";
import { connectDB } from "@/lib/db";
import { SpaceModel } from "@/models/Space";

const updateSchema = z.object({
  paymentMethod: z.enum(["global", "stripe", "razorpay", "manual"]),
  manualPaymentInstructions: z.string().optional(),
});

export const Route = createFileRoute("/api/spaces/$id/payment")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const session = getSessionFromCookieHeader(request.headers.get("cookie"));
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        if (session.role !== "space_owner" && session.role !== "admin") {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        try {
          const body = await request.json();
          const data = updateSchema.parse(body);

          await connectDB();
          const space = await SpaceModel.findOne({ id: params.id });
          if (!space) return Response.json({ error: "Space not found" }, { status: 404 });

          // Only the owning space_owner or any admin can update
          if (session.role === "space_owner" && space.ownerId !== session.userId) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }

          space.paymentMethod = data.paymentMethod;
          space.manualPaymentInstructions = data.manualPaymentInstructions ?? "";
          await space.save();

          return Response.json({ success: true, paymentMethod: space.paymentMethod });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Invalid request";
          return Response.json({ error: msg }, { status: 400 });
        }
      },
    },
  },
});
