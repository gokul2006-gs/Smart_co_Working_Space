import { useRouteContext } from "@tanstack/react-router";
import type { SessionPayload } from "@/lib/session";
import type { UserRole } from "@/models/User";

export function useAuth(): {
  user: SessionPayload | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
} {
  const { user } = useRouteContext({ from: "__root__" });

  const hasRole = (role: UserRole | UserRole[]) => {
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  };

  return { user, isAuthenticated: !!user, hasRole };
}
