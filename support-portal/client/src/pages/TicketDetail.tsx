import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { Alert, Badge, EmptyState, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { STATUSES, Ticket, TicketComment, TicketStatus, User } from "../types";
import { formatDate, useFetch } from "../utils";

function AssigneeSelect({ ticket, disabled, onChange }: { ticket: Ticket; disabled: boolean; onChange: (id: string | null) => void }) {
  const { data, loading } = useFetch<{ users: User[] }>("/users");
  const users = (data?.users ?? []).filter((u) => u.isActive || u.id === ticket.assigneeId);
  return (
    <select
      className="input"
      value={ticket.assigneeId ?? ""}
      disabled={disabled || loading}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Assignee"
    >
      <option value="">Unassigned</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
    </select>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const ticketReq = useFetch<{ ticket: Ticket }>(`/tickets/${id}`);
  const commentsReq = useFetch<{ comments: TicketComment[] }>(`/tickets/${id}/comments`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const ticket = ticketReq.data?.ticket;
  const comments = commentsReq.data?.comments ?? [];

  async function mutate(fn: () => Promise<unknown>, okText: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await ticketReq.reload();
      setNotice({ kind: "success", text: okText });
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (posting || !content.trim()) return;
    setPosting(true);
    setNotice(null);
    try {
      await api.post(`/tickets/${id}/comments`, { content });
      setContent("");
      await commentsReq.reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setPosting(false);
    }
  }

  if (ticketReq.loading && !ticket) return <Spinner />;
  if (ticketReq.error || !ticket) {
    return (
      <div className="space-y-4">
        <Alert>{ticketReq.error ?? "Ticket not found"}</Alert>
        <Link to="/tickets" className="btn btn-secondary">Back to tickets</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="text-sm text-indigo-600 hover:underline">← Back to tickets</Link>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{ticket.title}</h1>
          <Badge value={ticket.status} />
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>

        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-slate-500">Created by</dt><dd className="font-medium">{ticket.creator.name}</dd></div>
          <div><dt className="text-slate-500">Created</dt><dd className="font-medium">{formatDate(ticket.createdAt)}</dd></div>
          <div><dt className="text-slate-500">Updated</dt><dd className="font-medium">{formatDate(ticket.updatedAt)}</dd></div>
          {!isAdmin && <div><dt className="text-slate-500">Assignee</dt><dd className="font-medium">{ticket.assignee?.name ?? "Unassigned"}</dd></div>}
        </dl>

        {isAdmin ? (
          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={ticket.status}
                disabled={busy}
                onChange={(e) => mutate(() => api.patch(`/tickets/${id}/status`, { status: e.target.value as TicketStatus }), "Status updated")}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Assignee</label>
              <AssigneeSelect ticket={ticket} disabled={busy} onChange={(assigneeId) => mutate(() => api.patch(`/tickets/${id}/assign`, { assigneeId }), "Assignee updated")} />
            </div>
          </div>
        ) : (
          ticket.status !== "CLOSED" && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <button className="btn btn-danger" disabled={busy} onClick={() => mutate(() => api.patch(`/tickets/${id}/status`, { status: "CLOSED" }), "Ticket closed")}>
                {busy ? "Closing…" : "Close ticket"}
              </button>
            </div>
          )
        )}
      </div>

      <div className="card">
        <div className="border-b border-slate-200 px-4 py-3 font-semibold">Comments ({comments.length})</div>
        {commentsReq.error && <div className="p-4"><Alert>{commentsReq.error}</Alert></div>}
        {commentsReq.loading && !commentsReq.data ? (
          <Spinner />
        ) : comments.length === 0 ? (
          <EmptyState title="No comments yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {comments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{c.author.name}</span>
                  {c.author.role === "ADMIN" && <Badge value="ADMIN" />}
                  <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.content}</p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addComment} className="space-y-3 border-t border-slate-200 p-4">
          <label className="label" htmlFor="comment">Add a comment</label>
          <textarea id="comment" className="input min-h-[5rem]" value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} />
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={posting || !content.trim()}>{posting ? "Posting…" : "Post comment"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
