import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { handleStripeWebhook } from "@/lib/payment.server";

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("stripe-signature");

        const result = await handleStripeWebhook(rawBody, signature);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: 400 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
