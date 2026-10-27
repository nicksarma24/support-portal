import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { all, get, getTicket, like, listTickets, now, run } from "../db";
import { asyncHandler, HttpError } from "../lib/http";
import { idParams, Role, statusSchema } from "../lib/schemas";
import { authenticate, requireRole } from "../middleware/auth";

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: statusSchema.optional(),
});
const createSchema = z
  .object({ title: z.string().trim().min(1, "Title is required").max(200), description: z.string().trim().min(1, "Description is required").max(5000) })
  .strict();
const statusBody = z.object({ status: statusSchema }).strict();
const assignBody = z.object({ assigneeId: z.string().min(1).max(64).nullable() }).strict();
const commentBody = z.object({ content: z.string().trim().min(1, "Comment cannot be empty").max(2000) }).strict();

type AuthUser = { id: string; role: Role };

/** Non-admins get a 404 for tickets they didn't create and aren't assigned to, so ticket IDs can't be enumerated. */
function getAccessibleTicket(id: string, user: AuthUser) {
  const ticket = getTicket(id);
  if (!ticket || (user.role !== "ADMIN" && ticket.creatorId !== user.id && ticket.assigneeId !== user.id)) throw new HttpError(404, "Ticket not found");
  return ticket;
}

const authorOf = (r: any) => ({ id: r.id, content: r.content, ticketId: r.ticketId, authorId: r.authorId, createdAt: r.createdAt, author: { id: r.authorId, name: r.aName, role: r.aRole } });
const COMMENT_SELECT = `SELECT c.*, u.name AS aName, u.role AS aRole FROM "Comment" c JOIN "User" u ON u.id = c.authorId`;

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, status } = listQuery.parse(req.query);
    const conds: string[] = [];
    const params: string[] = [];
    if (req.user!.role !== "ADMIN") { conds.push("(t.creatorId = ? OR t.assigneeId = ?)"); params.push(req.user!.id, req.user!.id); }
    if (status) { conds.push("t.status = ?"); params.push(status); }
    if (search) { conds.push("(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')"); params.push(like(search), like(search)); }
    res.json({ tickets: listTickets(conds.length ? `WHERE ${conds.join(" AND ")}` : "", params) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const id = randomUUID();
    const t = now();
    // creator always comes from the token
    run(`INSERT INTO "Ticket" (id, title, description, creatorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`, id, data.title, data.description, req.user!.id, t, t);
    res.status(201).json({ ticket: getTicket(id) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    res.json({ ticket: getAccessibleTicket(id, req.user!) });
  })
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { status } = statusBody.parse(req.body);
    getAccessibleTicket(id, req.user!);
    if (req.user!.role !== "ADMIN" && status !== "CLOSED") throw new HttpError(403, "You can only close your own tickets");
    run(`UPDATE "Ticket" SET status = ?, updatedAt = ? WHERE id = ?`, status, now(), id);
    res.json({ ticket: getTicket(id) });
  })
);

router.patch(
  "/:id/assign",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { assigneeId } = assignBody.parse(req.body);
    if (!getTicket(id)) throw new HttpError(404, "Record not found");
    if (assigneeId) {
      const assignee = get<{ isActive: number }>(`SELECT isActive FROM "User" WHERE id = ?`, assigneeId);
      if (!assignee) throw new HttpError(404, "Assignee not found");
      if (!assignee.isActive) throw new HttpError(400, "Cannot assign a ticket to a deactivated user");
    }
    run(`UPDATE "Ticket" SET assigneeId = ?, updatedAt = ? WHERE id = ?`, assigneeId, now(), id);
    res.json({ ticket: getTicket(id) });
  })
);

router.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    getAccessibleTicket(id, req.user!);
    const comments = all(`${COMMENT_SELECT} WHERE c.ticketId = ? ORDER BY c.createdAt ASC, c.rowid ASC`, id).map(authorOf);
    res.json({ comments });
  })
);

router.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { content } = commentBody.parse(req.body);
    getAccessibleTicket(id, req.user!);
    const cid = randomUUID();
    run(`INSERT INTO "Comment" (id, content, ticketId, authorId, createdAt) VALUES (?, ?, ?, ?, ?)`, cid, content, id, req.user!.id, now());
    res.status(201).json({ comment: authorOf(get(`${COMMENT_SELECT} WHERE c.id = ?`, cid)) });
  })
);

export default router;