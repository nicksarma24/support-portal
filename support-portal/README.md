# Support Management Portal

Full-stack portal for managing users and support tickets, with two roles (`ADMIN`, `USER`), server-enforced authorization, ticket assignment, status tracking and comments.

**Stack:** React + Vite + TypeScript, React Router, Tailwind CSS, Axios · Node.js + Express + TypeScript · SQLite (built-in `node:sqlite`) · JWT (HTTP-only cookie) · bcrypt · Zod

## Why SQL (SQLite)

The data is relational: users, tickets (with *two* separate user relations: creator and assignee), and comments. Foreign keys, a unique email constraint, native enums for role/status, and joins (ticket + creator + assignee) map directly onto SQL. SQLite keeps setup to zero: the database is a single file created automatically on first run. A document store would need manual consistency for assignments and ownership.

## Quick start

Requires Node 22.13+ (uses the built-in `node:sqlite`; no database server needed).

```bash
# 1. Backend
cd server
cp .env.example .env           # set JWT_SECRET (32+ chars)
npm install
npm run setup                  # creates the SQLite file + seeds demo accounts (safe to rerun)
npm run dev                    # http://localhost:4000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                    # http://localhost:5173 (proxies /api to :4000)
```

### Local development logins (from `server/.env.example`; never use in production)

| Role  | Email               | Password      |
|-------|---------------------|---------------|
| ADMIN | `admin@example.com` | `Admin@12345` |
| USER  | `user@example.com`  | `User@12345`  |

Override with the `SEED_*` variables. With `NODE_ENV=production` the seed refuses to run unless they are set. Rerunning the seed never duplicates accounts or resets existing passwords.

## Environment variables

**server/.env** (see `server/.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file path (default `./data/portal.db`) |
| `JWT_SECRET` | Signing secret, at least 32 characters |
| `SESSION_HOURS` | Session lifetime (default 8) |
| `PORT`, `CLIENT_ORIGIN`, `NODE_ENV` | Server port, allowed browser origin (CORS), environment |
| `SEED_ADMIN_*`, `SEED_USER_*` | Seed account email/password |

**client/.env** (optional): `VITE_API_URL` (default `/api`), `VITE_PROXY_TARGET` (dev proxy target, default `http://localhost:4000`). The frontend holds no secrets.

`.env` files are git-ignored; only `.env.example` files are committed.

## Architecture and key decisions

- **Structure:** `server/src` has `routes/` (handlers + Zod schemas), `middleware/` (auth, role check, errors), `lib/`. `client/src` has `pages/`, `components/`, `context/AuthContext`, `api/client.ts`.
- **Authentication:** login checks the bcrypt hash and issues a JWT (`sub` = user id) in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). JavaScript never sees the token, so XSS can't read it from storage. The Vite dev proxy keeps the app same-origin.
- **Every protected request** verifies the JWT, then **reloads the user from the database** and rejects if the user is missing or deactivated. Deactivation and role changes therefore apply immediately, even with an otherwise valid token. Identity and role always come from there, never from client-supplied IDs.
- **Authorization:** `requireRole("ADMIN")` guards admin routes. Ticket access goes through a single helper: non-admins get **404** for tickets they don't own, so IDs can't be enumerated. Users may only move their own tickets to `CLOSED`.
- **Mass assignment:** all request bodies use `.strict()` Zod schemas, so extra fields (`role`, `creatorId`, `passwordHash`, ...) are rejected with 400. `creatorId` and `authorId` are set from the token. `PATCH /api/profile` accepts only `name`.
- **Errors:** consistent `{ "error": { "message": "..." } }` for validation (400), auth (401/403), missing (404), unique conflicts (409) and unexpected failures (500, no internals leaked). The frontend surfaces these messages and has loading/empty/error states and double-submit protection.
- **Extra safeguards:** admins can't change their own role or deactivate themselves; tickets can't be assigned to deactivated users; login does a dummy bcrypt compare for unknown emails; `helmet`; CORS limited to `CLIENT_ORIGIN`; 100 kB body limit.

## API

| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | public |
| GET | `/api/auth/me`, `/api/profile` | authenticated |
| PATCH | `/api/profile` (name only) | authenticated |
| GET, POST | `/api/users` (`?search=`) | admin |
| GET | `/api/users/:id` | admin or same user |
| PATCH | `/api/users/:id`, `/api/users/:id/status` | admin |
| GET | `/api/tickets` (`?search=&status=`) | admin: all; user: own |
| POST | `/api/tickets` | authenticated |
| GET | `/api/tickets/:id`, `/:id/comments` | admin or creator |
| POST | `/api/tickets/:id/comments` | admin or creator |
| PATCH | `/api/tickets/:id/status` | admin: any; creator: `CLOSED` only |
| PATCH | `/api/tickets/:id/assign` | admin |

## Testing

With the server running and the DB seeded:

```bash
cd server && npm run test:e2e
```

This runs 63 checks against the live API: login failures, role boundaries, ticket ownership (404s), mass-assignment rejection, validation, search/filter, comments, closing rules, deactivation of live sessions, immediate role changes, logout. Set `API_URL`, `ADMIN_EMAIL`, etc. to point it elsewhere. UI flows to click through manually: log in as each role, create/close a ticket as the user, assign/change status/search/create users as admin.

## Troubleshooting

- `npm run setup` fails with `Cannot find module 'node:sqlite'`: upgrade Node to 22.13 or newer. To reset the database, delete `server/data/portal.db*` and run `npm run setup` again.
- Login works but you're bounced back: set `CLIENT_ORIGIN` to the exact URL you open (default `http://localhost:5173`).

## Assumptions and limitations

- CSRF protection relies on `SameSite=Lax` cookies plus a JSON-only API (no CSRF token). There's no login rate limiting. Both should be added before production.
- Sessions last `SESSION_HOURS` with no refresh tokens; revocation happens via deactivation.
- Users can comment on their own closed tickets; admins can reopen tickets.
- Admins can assign tickets to any active user (including other admins).

## AI tools used

Claude (Anthropic) was used to generate the initial implementation from the brief. The author is expected to review, run and be able to explain all code before submission.
