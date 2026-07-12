import bcrypt from "bcryptjs";

import { connectDB } from "../src/lib/db";
import { UserModel } from "../src/models/User";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@aperture.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin123!";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Aperture Admin";

export async function seedAdmin(): Promise<string | null> {
  await connectDB();

  const existing = await UserModel.findOne({ role: "admin" }).lean();
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
    return existing._id.toString();
  }

  const byEmail = await UserModel.findOne({ email: ADMIN_EMAIL }).lean();
  if (byEmail) {
    if (byEmail.role !== "admin") {
      await UserModel.updateOne({ _id: byEmail._id }, { $set: { role: "admin" } });
      console.log(`Promoted existing user to admin: ${ADMIN_EMAIL}`);
      return byEmail._id.toString();
    }
    console.log(`Admin email already registered: ${ADMIN_EMAIL}`);
    return byEmail._id.toString();
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await UserModel.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash,
    role: "admin",
  });

  console.log(`Created admin: ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`);
  return admin._id.toString();
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed-admin.ts")) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Admin seed failed:", err);
      process.exit(1);
    });
}
