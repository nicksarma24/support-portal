import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Badge } from "./ui";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const links = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/tickets", label: "Tickets", end: true },
    { to: "/tickets/new", label: "New ticket", end: true },
    ...(user?.role === "ADMIN" ? [{ to: "/users", label: "Users", end: false }] : []),
    { to: "/profile", label: "Profile", end: false },
  ];

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-100 transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-6 py-5 text-lg font-semibold">Support Portal</div>
        <nav className="space-y-1 px-3" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button className="btn btn-secondary lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium leading-tight">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            {user && <Badge value={user.role} />}
            <button className="btn btn-secondary" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
