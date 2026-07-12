import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { connectDB } from "@/lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await connectDB();
          return Response.json({
            status: "ok",
            database: "connected",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json(
            {
              status: "error",
              database: "disconnected",
              message,
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
