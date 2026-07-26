import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { handlePaystackWebhook, verifyPaystackWebhookSignature } from "@/lib/payment.server";

export const Route = createFileRoute("/api/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");

        if (!(await verifyPaystackWebhookSignature(rawBody, signature))) {
          return Response.json({ error: "Invalid signature" }, { status: 400 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        await handlePaystackWebhook(payload);
        return Response.json({ received: true });
      },
    },
  },
});
