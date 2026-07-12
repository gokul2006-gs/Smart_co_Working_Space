import mongoose, { Schema } from "mongoose";

export type UserRole = "user" | "space_owner" | "admin";

export interface UserDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "space_owner", "admin"], default: "user" },
  },
  { timestamps: true },
);

export const UserModel =
  mongoose.models.User ?? mongoose.model<UserDocument>("User", userSchema);
