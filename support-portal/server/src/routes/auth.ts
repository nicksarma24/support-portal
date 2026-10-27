import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../env";
import { COOKIE_NAME, cookieOptions } from "../lib/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { emailSchema } from "../lib/schemas";
import { authenticate } from "../middleware/auth";
import { get, toUser, USER_SELECT } from "../db";

const router = Router();
// Compared against when the email is unknown, so response time doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).strict();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = get<any>(`SELECT * FROM "User" WHERE email = ?`, email);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new HttpError(401, "Invalid email or password");
    if (!user.isActive) throw new HttpError(403, "This account has been deactivated");

    const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: `${env.SESSION_HOURS}h` });
    const { passwordHash: _omit, ...publicUser } = toUser(user);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: env.SESSION_HOURS * 3600 * 1000 }).json({ user: publicUser });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions).json({ message: "Logged out" });
});

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const row = get(`${USER_SELECT} WHERE id = ?`, req.user!.id);
    if (!row) throw new HttpError(401, "Invalid or expired session");
    res.json({ user: toUser(row) });
  })
);

export default router;
