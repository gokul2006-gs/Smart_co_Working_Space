import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { logoutResponse } from "@/lib/auth-core";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => logoutResponse(),
    },
  },
});
