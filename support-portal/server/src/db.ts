import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, SQLInputValue } from "node:sqlite";
import { env } from "./env";

const file = resolve(process.cwd(), env.DATABASE_PATH);
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

// Schema is created on first run; rerunning is a no-op.
db.exec(`
CREATE TABLE IF NOT EXISTS "User" (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN','USER')),
  isActive     INTEGER NOT NULL DEFAULT 1,
  createdAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "Ticket" (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  creatorId   TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  assigneeId  TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updatedAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "Comment" (
  id        TEXT PRIMARY KEY,
  content   TEXT NOT NULL,
  ticketId  TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  authorId  TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS Ticket_creatorId_idx  ON "Ticket"(creatorId);
CREATE INDEX IF NOT EXISTS Ticket_assigneeId_idx ON "Ticket"(assigneeId);
CREATE INDEX IF NOT EXISTS Ticket_status_idx     ON "Ticket"(status);
CREATE INDEX IF NOT EXISTS Comment_ticketId_idx  ON "Comment"(ticketId);
`);

export const now = () => new Date().toISOString();

export function all<T = Record<string, any>>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T = Record<string, any>>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}

/** Escapes LIKE wildcards so user search text is matched literally (use with ESCAPE '\'). */
export const like = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;

// ---- Row -> API shape ----
const USER_COLS = "id, name, email, role, isActive, createdAt, updatedAt";
export const USER_SELECT = `SELECT ${USER_COLS} FROM "User"`;
export const toUser = (r: any) => ({ ...r, isActive: !!r.isActive });

const TICKET_SELECT = `
SELECT t.*, c.name AS cName, c.email AS cEmail, a.name AS aName, a.email AS aEmail
FROM "Ticket" t
JOIN "User" c ON c.id = t.creatorId
LEFT JOIN "User" a ON a.id = t.assigneeId`;
export const toTicket = (r: any) => ({
  id: r.id, title: r.title, description: r.description, status: r.status,
  creatorId: r.creatorId, assigneeId: r.assigneeId, createdAt: r.createdAt, updatedAt: r.updatedAt,
  creator: { id: r.creatorId, name: r.cName, email: r.cEmail },
  assignee: r.assigneeId ? { id: r.assigneeId, name: r.aName, email: r.aEmail } : null,
});
export const getTicket = (id: string) => {
  const r = get(`${TICKET_SELECT} WHERE t.id = ?`, id);
  return r ? toTicket(r) : null;
};
export const listTickets = (where: string, params: SQLInputValue[]) =>
  all(`${TICKET_SELECT} ${where} ORDER BY t.createdAt DESC, t.rowid DESC`, ...params).map(toTicket);
