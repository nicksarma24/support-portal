import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, EmptyState, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { STATUSES, Ticket } from "../types";
import { formatDate, useDebounce, useFetch } from "../utils";

export default function Tickets() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const q = useDebounce(search.trim(), 300);
  const params: Record<string, string> = {};
  if (q) params.search = q;
  if (status) params.status = status;
  const { data, loading, error } = useFetch<{ tickets: Ticket[] }>("/tickets", params);
  const tickets = data?.tickets ?? [];
  const filtered = !!(q || status);

  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle={isAdmin ? "All tickets" : "Your tickets"}
        actions={<Link to="/tickets/new" className="btn btn-primary">New ticket</Link>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder="Search title or description…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search tickets" />
        <select className="input sm:max-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="card overflow-x-auto">
        {loading && !data ? (
          <Spinner />
        ) : tickets.length === 0 ? (
          <EmptyState title={filtered ? "No tickets match your filters" : "No tickets yet"} hint={filtered ? "Try a different search or status." : "Create a ticket to get started."} />
        ) : (
          <table className={`min-w-full divide-y divide-slate-200 ${loading ? "opacity-60" : ""}`}>
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Title</th>
                <th className="th">Status</th>
                {isAdmin && <th className="th">Created by</th>}
                <th className="th">Assignee</th>
                <th className="th">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="td font-medium"><Link to={`/tickets/${t.id}`} className="text-indigo-600 hover:underline">{t.title}</Link></td>
                  <td className="td"><Badge value={t.status} /></td>
                  {isAdmin && <td className="td">{t.creator.name}</td>}
                  <td className="td">{t.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="td whitespace-nowrap">{formatDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
