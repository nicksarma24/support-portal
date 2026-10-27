// End-to-end API checks. Requires a running server + seeded DB.
//   npm run test:e2e            (defaults: http://localhost:4000, seed credentials)
// Env: API_URL, ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL, USER_PASSWORD
const API = process.env.API_URL ?? "http://localhost:4000/api";
const ADMIN = { email: process.env.ADMIN_EMAIL ?? "admin@example.com", password: process.env.ADMIN_PASSWORD ?? "Admin@12345" };
const USER = { email: process.env.USER_EMAIL ?? "user@example.com", password: process.env.USER_PASSWORD ?? "User@12345" };

class Client {
  cookie = "";
  async req(method, path, body, raw) {
    const res = await fetch(API + path, {
      method,
      headers: { ...(body !== undefined || raw ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      this.cookie = v ? `${k}=${v}` : "";
    }
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, body: json };
  }
}

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const is = (name, r, status) => check(`${name} -> ${status}`, r.status === status, `(got ${r.status} ${JSON.stringify(r.body)})`);

const run = Date.now();
const anon = new Client(), admin = new Client(), user = new Client(), other = new Client();

console.log("Authentication");
is("no cookie on protected route", await anon.req("GET", "/tickets"), 401);
is("wrong password", await anon.req("POST", "/auth/login", { email: ADMIN.email, password: "nope-nope" }), 401);
is("unknown email", await anon.req("POST", "/auth/login", { email: "ghost@example.com", password: "whatever1" }), 401);
is("invalid email format", await anon.req("POST", "/auth/login", { email: "not-an-email", password: "x" }), 400);
is("malformed JSON", await anon.req("POST", "/auth/login", undefined, "{bad"), 400);
let r = await admin.req("POST", "/auth/login", ADMIN);
is("admin login", r, 200);
check("login response has no passwordHash", r.body?.user && !("passwordHash" in r.body.user));
is("user login", await user.req("POST", "/auth/login", USER), 200);
r = await admin.req("GET", "/auth/me");
check("me returns admin", r.status === 200 && r.body.user.role === "ADMIN");
const userId = (await user.req("GET", "/auth/me")).body.user.id;
const adminId = r.body.user.id;

console.log("User management");
is("user cannot list users", await user.req("GET", "/users"), 403);
is("user cannot create users", await user.req("POST", "/users", { name: "x", email: "x@e.com", password: "password1" }), 403);
is("user cannot edit users", await user.req("PATCH", `/users/${adminId}`, { role: "USER" }), 403);
is("user cannot read other user", await user.req("GET", `/users/${adminId}`), 403);
is("user can read self", await user.req("GET", `/users/${userId}`), 200);
is("user profile", await user.req("GET", "/profile"), 200);
is("profile rejects role field", await user.req("PATCH", "/profile", { name: "Demo User", role: "ADMIN" }), 400);
const otherEmail = `other${run}@example.com`;
r = await admin.req("POST", "/users", { name: "Other Person", email: otherEmail, password: "password123", role: "USER" });
is("admin creates user", r, 201);
const otherId = r.body?.user?.id;
is("duplicate email", await admin.req("POST", "/users", { name: "Dup", email: otherEmail, password: "password123" }), 409);
is("invalid email on create", await admin.req("POST", "/users", { name: "Bad", email: "nope", password: "password123" }), 400);
is("short password on create", await admin.req("POST", "/users", { name: "Bad", email: `b${run}@e.com`, password: "short" }), 400);
is("create rejects passwordHash field", await admin.req("POST", "/users", { name: "Bad", email: `c${run}@e.com`, password: "password123", passwordHash: "x" }), 400);
is("invalid role", await admin.req("PATCH", `/users/${otherId}`, { role: "SUPERUSER" }), 400);
r = await admin.req("GET", "/users?search=OTHER%20pers");
check("search is case-insensitive", r.status === 200 && r.body.users.some((u) => u.id === otherId));
is("admin edits user", await admin.req("PATCH", `/users/${otherId}`, { name: "Other Edited" }), 200);
is("admin cannot change own role", await admin.req("PATCH", `/users/${adminId}`, { role: "USER" }), 400);
is("admin cannot deactivate self", await admin.req("PATCH", `/users/${adminId}/status`, { isActive: false }), 400);
is("missing user", await admin.req("GET", "/users/does-not-exist"), 404);
is("other user login", await other.req("POST", "/auth/login", { email: otherEmail, password: "password123" }), 200);

console.log("Tickets");
is("create rejects creatorId", await user.req("POST", "/tickets", { title: "t", description: "d", creatorId: adminId }), 400);
is("create requires title", await user.req("POST", "/tickets", { title: " ", description: "d" }), 400);
r = await user.req("POST", "/tickets", { title: `Printer broken ${run}`, description: "It jams constantly" });
is("user creates ticket", r, 201);
const tid = r.body?.ticket?.id;
check("creator comes from token", r.body?.ticket?.creatorId === userId && r.body.ticket.status === "OPEN");
r = await user.req("GET", "/tickets");
check("user list contains own ticket", r.body.tickets.some((t) => t.id === tid));
r = await other.req("GET", "/tickets");
check("other user sees none of it", r.status === 200 && !r.body.tickets.some((t) => t.id === tid));
is("other user ticket detail hidden", await other.req("GET", `/tickets/${tid}`), 404);
is("other user cannot close it", await other.req("PATCH", `/tickets/${tid}/status`, { status: "CLOSED" }), 404);
is("other user cannot read comments", await other.req("GET", `/tickets/${tid}/comments`), 404);
is("other user cannot comment", await other.req("POST", `/tickets/${tid}/comments`, { content: "hi" }), 404);
is("user cannot set IN_PROGRESS", await user.req("PATCH", `/tickets/${tid}/status`, { status: "IN_PROGRESS" }), 403);
is("user cannot assign", await user.req("PATCH", `/tickets/${tid}/assign`, { assigneeId: userId }), 403);
check("admin sees all tickets", (await admin.req("GET", "/tickets")).body.tickets.some((t) => t.id === tid));
is("admin assigns ticket", await admin.req("PATCH", `/tickets/${tid}/assign`, { assigneeId: adminId }), 200);
is("assign unknown user", await admin.req("PATCH", `/tickets/${tid}/assign`, { assigneeId: "nope" }), 404);
is("admin sets IN_PROGRESS", await admin.req("PATCH", `/tickets/${tid}/status`, { status: "IN_PROGRESS" }), 200);
is("invalid status", await admin.req("PATCH", `/tickets/${tid}/status`, { status: "DONE" }), 400);
r = await admin.req("GET", `/tickets?status=IN_PROGRESS&search=PRINTER%20broken%20${run}`);
check("admin search + status filter", r.status === 200 && r.body.tickets.length === 1 && r.body.tickets[0].assignee?.id === adminId);
is("invalid status filter", await admin.req("GET", "/tickets?status=BOGUS"), 400);
is("missing ticket (admin)", await admin.req("GET", "/tickets/does-not-exist"), 404);

console.log("Comments");
is("user comments on own ticket", await user.req("POST", `/tickets/${tid}/comments`, { content: "Any update?" }), 201);
is("admin comments", await admin.req("POST", `/tickets/${tid}/comments`, { content: "Looking into it" }), 201);
is("empty comment rejected", await user.req("POST", `/tickets/${tid}/comments`, { content: "  " }), 400);
r = await user.req("GET", `/tickets/${tid}/comments`);
check("comments chronological with authors", r.status === 200 && r.body.comments.length === 2 && r.body.comments[0].author.id === userId && r.body.comments[1].author.id === adminId);

console.log("Closing");
is("user closes own ticket", await user.req("PATCH", `/tickets/${tid}/status`, { status: "CLOSED" }), 200);
is("user cannot reopen", await user.req("PATCH", `/tickets/${tid}/status`, { status: "OPEN" }), 403);

console.log("Deactivation");
is("admin deactivates other user", await admin.req("PATCH", `/users/${otherId}/status`, { isActive: false }), 200);
is("existing session of deactivated user rejected", await other.req("GET", "/tickets"), 401);
is("deactivated user cannot log in", await new Client().req("POST", "/auth/login", { email: otherEmail, password: "password123" }), 403);
is("admin reactivates", await admin.req("PATCH", `/users/${otherId}/status`, { isActive: true }), 200);

console.log("Role changes take effect immediately");
const promoted = new Client();
await promoted.req("POST", "/auth/login", { email: otherEmail, password: "password123" });
is("before promotion: forbidden", await promoted.req("GET", "/users"), 403);
await admin.req("PATCH", `/users/${otherId}`, { role: "ADMIN" });
is("after promotion: allowed", await promoted.req("GET", "/users"), 200);
await admin.req("PATCH", `/users/${otherId}`, { role: "USER" });
is("after demotion: forbidden again", await promoted.req("GET", "/users"), 403);

console.log("Logout");
is("logout", await user.req("POST", "/auth/logout"), 200);
is("after logout /me", await user.req("GET", "/auth/me"), 401);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
