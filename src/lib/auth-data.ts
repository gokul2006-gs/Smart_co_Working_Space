import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionFromCookieHeader } from "@/lib/auth-core";
import type { SessionPayload } from "@/lib/session";

function getSessionFromRequest(): SessionPayload | null {
  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? null;
  return getSessionFromCookieHeader(cookieHeader);
}

export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionPayload | null> => {
    return getSessionFromRequest();
  },
);
