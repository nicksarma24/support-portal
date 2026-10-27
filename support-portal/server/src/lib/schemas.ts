import { z } from "zod";

export const ROLES = ["ADMIN", "USER"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type Role = (typeof ROLES)[number];

export const emailSchema = z.string().trim().toLowerCase().email("Invalid email address").max(254);
export const nameSchema = z.string().trim().min(1, "Name is required").max(100);
// bcrypt only uses the first 72 bytes, so cap the length
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters");
export const roleSchema = z.enum(ROLES);
export const statusSchema = z.enum(TICKET_STATUSES);
export const idParams = z.object({ id: z.string().min(1).max(64) });
