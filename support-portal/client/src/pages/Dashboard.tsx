import { Link } from "react-router-dom";
import { Alert, Badge, EmptyState, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { STATUSES, Ticket } from "../types";
import { formatDate, useFetch } from "../utils";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch<{ tickets: Ticket[] }>("/tickets");
  const tickets = data?.tickets ?? [];
  const count = (s: string) => tickets.filter((t) => t.status === s).length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name}`}
        subtitle={user?.role === "ADMIN" ? "Overview of all tickets" : "Overview of your tickets"}
        actions={<Link to="/tickets/new" className="btn btn-primary">New ticket</Link>}
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="card p-4"><div className="text-sm text-slate-500">Total</div><div className="mt-1 text-2xl font-semibold">{tickets.length}</div></div>
            {STATUSES.map((s) => (
              <div key={s} className="card p-4">
                <div className="text-sm text-slate-500">{s.replace("_", " ")}</div>
                <div className="mt-1 text-2xl font-semibold">{count(s)}</div>
              </div>
            ))}
          </div>

          <div className="card mt-6">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold">Recent tickets</h2>
              <Link to="/tickets" className="text-sm text-indigo-600 hover:underline">View all</Link>
            </div>
            {tickets.length === 0 ? (
              <EmptyState title="No tickets yet" hint="Create your first ticket to get started." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {tickets.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <Link to={`/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                      <span className="font-medium">{t.title}</span>
                      <span className="flex items-center gap-3 text-xs text-slate-500">
                        {formatDate(t.createdAt)} <Badge value={t.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
