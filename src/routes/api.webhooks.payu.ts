import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { handlePayuWebhook, verifyPayuWebhookSignature } from "@/lib/payment.server";

export const Route = createFileRoute("/api/webhooks/payu")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-payu-signature");

        // PayU webhook signature is always required when a secret is configured.
        // If no secret is configured we still reject — fail-closed pattern.
        if (!(await verifyPayuWebhookSignature(rawBody, signature))) {
          if (!process.env.PAYU_CLIENT_SECRET && !process.env.PAYU_SALT) {
            console.warn("[payu webhook] No PAYU_CLIENT_SECRET / PAYU_SALT configured — rejecting webhook to avoid unauthorized payment confirmations.");
          }
          return Response.json({ error: "Invalid or missing signature" }, { status: 400 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        await handlePayuWebhook(payload);
        return Response.json({ received: true });
      },
    },
  },
});
