import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { handleRazorpayWebhook, verifyRazorpayWebhookSignature } from "@/lib/payment.server";

export const Route = createFileRoute("/api/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        if (!(await verifyRazorpayWebhookSignature(rawBody, signature))) {
          return Response.json({ error: "Invalid signature" }, { status: 400 });
        }

        let payload: Parameters<typeof handleRazorpayWebhook>[0];
        try {
          payload = JSON.parse(rawBody) as Parameters<typeof handleRazorpayWebhook>[0];
        } catch {
          return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        await handleRazorpayWebhook(payload);
        return Response.json({ received: true });
      },
    },
  },
});
