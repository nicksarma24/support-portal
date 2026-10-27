import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { all, get, like, now, run, toUser, USER_SELECT } from "../db";
import { asyncHandler, HttpError } from "../lib/http";
import { emailSchema, idParams, nameSchema, passwordSchema, roleSchema } from "../lib/schemas";
import { authenticate, requireRole } from "../middleware/auth";

// .strict() rejects unknown keys, which blocks mass assignment (e.g. passwordHash, id)
const createSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema.default("USER"),
    isActive: z.boolean().default(true),
  })
  .strict();

const updateSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    role: roleSchema.optional(),
    password: passwordSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const statusBody = z.object({ isActive: z.boolean() }).strict();
const listQuery = z.object({ search: z.string().trim().max(100).optional() });

const findUser = (id: string) => {
  const row = get(`${USER_SELECT} WHERE id = ?`, id);
  if (!row) throw new HttpError(404, "User not found");
  return toUser(row);
};

/** Applies a partial update and returns the fresh user (404 if missing). */
function updateUser(id: string, fields: Record<string, string | number>) {
  findUser(id);
  const cols = Object.keys(fields);
  run(`UPDATE "User" SET ${cols.map((c) => `${c} = ?`).join(", ")}, updatedAt = ? WHERE id = ?`, ...cols.map((c) => fields[c]), now(), id);
  return findUser(id);
}

const router = Router();
router.use(authenticate);

router.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { search } = listQuery.parse(req.query);
    const rows = search
      ? all(`${USER_SELECT} WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' ORDER BY createdAt DESC, rowid DESC`, like(search), like(search))
      : all(`${USER_SELECT} ORDER BY createdAt DESC, rowid DESC`);
    res.json({ users: rows.map(toUser) });
  })
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { password, name, email, role, isActive } = createSchema.parse(req.body);
    const id = randomUUID();
    const t = now();
    run(
      `INSERT INTO "User" (id, name, email, passwordHash, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, name, email, await bcrypt.hash(password, 12), role, isActive ? 1 : 0, t, t
    );
    res.status(201).json({ user: findUser(id) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    if (req.user!.role !== "ADMIN" && req.user!.id !== id) throw new HttpError(403, "Forbidden");
    res.json({ user: findUser(id) });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { password, ...rest } = updateSchema.parse(req.body);
    if (id === req.user!.id && rest.role !== undefined) throw new HttpError(400, "You cannot change your own role");
    const fields: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) fields[k] = v;
    if (password) fields.passwordHash = await bcrypt.hash(password, 12);
    res.json({ user: updateUser(id, fields) });
  })
);

router.patch(
  "/:id/status",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { isActive } = statusBody.parse(req.body);
    if (id === req.user!.id && !isActive) throw new HttpError(400, "You cannot deactivate your own account");
    res.json({ user: updateUser(id, { isActive: isActive ? 1 : 0 }) });
  })
);

// ---- /api/profile (current user only; identity comes from the verified token) ----
export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ user: findUser(req.user!.id) });
  })
);

// Only `name` is editable here, so role/email/isActive can never be self-modified
profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const { name } = z.object({ name: nameSchema }).strict().parse(req.body);
    res.json({ user: updateUser(req.user!.id, { name }) });
  })
);

export default router;
