import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { handlePayuWebhook, verifyPayuWebhookSignature } from "@/lib/payment.server";

export const Route = createFileRoute("/api/webhooks/payu")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-payu-signature");

        // If a signature is configured, verify it
        if (process.env.PAYU_CLIENT_SECRET || process.env.PAYU_SALT) {
          if (!(await verifyPayuWebhookSignature(rawBody, signature))) {
            return Response.json({ error: "Invalid signature" }, { status: 400 });
          }
        }

        const payload = JSON.parse(rawBody);
        await handlePayuWebhook(payload);
        return Response.json({ received: true });
      },
    },
  },
});
