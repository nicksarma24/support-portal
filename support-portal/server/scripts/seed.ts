import "dotenv/config";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { get, run, now } from "../src/db";

const isProd = process.env.NODE_ENV === "production";

function pick(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`${name} must be set when seeding in production`);
  return devDefault;
}

async function main() {
  const accounts: { name: string; email: string; password: string; role: "ADMIN" | "USER" }[] = [
    { name: "Admin", email: pick("SEED_ADMIN_EMAIL", "admin@example.com"), password: pick("SEED_ADMIN_PASSWORD", "Admin@12345"), role: "ADMIN" },
    { name: "Demo User", email: pick("SEED_USER_EMAIL", "user@example.com"), password: pick("SEED_USER_PASSWORD", "User@12345"), role: "USER" },
  ];
  for (const a of accounts) {
    const email = a.email.trim().toLowerCase();
    // Existing accounts are left alone (no duplicates, no password reset)
    if (!get(`SELECT 1 FROM "User" WHERE email = ?`, email)) {
      const t = now();
      run(
        `INSERT INTO "User" (id, name, email, passwordHash, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        randomUUID(), a.name, email, await bcrypt.hash(a.password, 12), a.role, t, t
      );
    }
    console.log(`Seeded ${a.role}: ${email}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
