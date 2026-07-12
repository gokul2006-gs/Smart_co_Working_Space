import bcrypt from "bcryptjs";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { UserModel, type UserRole } from "@/models/User";
import {
  signToken,
  verifyToken,
  buildSetCookieHeader,
  buildClearCookieHeader,
  getTokenFromCookieHeader,
  type SessionPayload,
} from "@/lib/session";

// Public self-registration schema. Intentionally has NO `role` field: anyone
// hitting POST /api/auth/register becomes a plain "user" regardless of what
// the client sends. Space-owner and admin accounts can only be created by an
// existing admin via adminCreateUser/adminCreateUserSchema below — allowing
// clients to self-select a privileged role here would be a privilege
// escalation vulnerability.
export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export const adminCreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["user", "space_owner", "admin"]),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type AuthResult =
  | { user: SessionPayload; error?: never; token?: string }
  | { error: string; user?: never; token?: never };

export function getSessionFromCookieHeader(
  cookieHeader: string | null,
): SessionPayload | null {
  const token = getTokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  return verifyToken(token);
}

export async function registerUser(data: z.infer<typeof registerSchema>): Promise<AuthResult> {
  return createUser(data);
}

export async function adminCreateUser(
  data: z.infer<typeof adminCreateUserSchema>,
): Promise<{ user?: { id: string; name: string; email: string; role: UserRole }; error?: string }> {
  try {
    await connectDB();

    const existing = await UserModel.findOne({ email: data.email }).lean();
    if (existing) return { error: "Email already registered" };

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await UserModel.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (err) {
    console.error("Admin create user error:", err);
    return { error: "Failed to create user" };
  }
}

async function createUser(data: z.infer<typeof registerSchema>): Promise<AuthResult> {
  try {
    await connectDB();

    const existing = await UserModel.findOne({ email: data.email }).lean();
    if (existing) return { error: "Email already registered" };

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await UserModel.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: "user" as UserRole,
    });

    const payload: SessionPayload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return { user: payload, token: signToken(payload) };
  } catch (err) {
    console.error("Register error:", err);
    return { error: "Registration failed" };
  }
}

export async function loginUser(data: z.infer<typeof loginSchema>): Promise<AuthResult> {
  try {
    await connectDB();

    const user = await UserModel.findOne({ email: data.email });
    if (!user) return { error: "Invalid email or password" };

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return { error: "Invalid email or password" };

    const payload: SessionPayload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return { user: payload, token: signToken(payload) };
  } catch (err) {
    console.error("Login error:", err);
    if (err instanceof Error) {
      if (err.message.includes("MONGODB_URI")) {
        return { error: "Database is not configured on the server" };
      }
      if (err.message.includes("JWT_SECRET")) {
        return { error: "Authentication is not configured on the server" };
      }
    }
    return { error: "Login failed" };
  }
}

export function authSuccessResponse(result: AuthResult): Response {
  if (result.error || !result.user || !result.token) {
    return Response.json({ error: result.error ?? "Authentication failed" }, { status: 400 });
  }

  return Response.json(
    { user: result.user },
    {
      headers: {
        "Set-Cookie": buildSetCookieHeader(result.token),
      },
    },
  );
}

export function logoutResponse(): Response {
  return Response.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": buildClearCookieHeader(),
      },
    },
  );
}
