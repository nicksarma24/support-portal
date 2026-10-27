import { useState } from "react";
import { api, errorMessage } from "../api/client";
import { Alert, Badge, EmptyState, PageHeader, Spinner } from "../components/ui";
import UserFormModal from "../components/UserFormModal";
import { useAuth } from "../context/AuthContext";
import { User } from "../types";
import { formatDate, useDebounce, useFetch } from "../utils";

export default function Users() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const q = useDebounce(search.trim(), 300);
  const params: Record<string, string> = q ? { search: q } : {};
  const { data, loading, error, reload } = useFetch<{ users: User[] }>("/users", params);
  const users = data?.users ?? [];
  const [modal, setModal] = useState<{ user: User | null } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function toggleActive(u: User) {
    if (togglingId) return;
    setTogglingId(u.id);
    setNotice(null);
    try {
      await api.patch(`/users/${u.id}/status`, { isActive: !u.isActive });
      await reload();
      setNotice({ kind: "success", text: `${u.name} ${u.isActive ? "deactivated" : "activated"}` });
    } catch (e) {
      setNotice({ kind: "error", text: errorMessage(e) });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Manage accounts, roles and access" actions={<button className="btn btn-primary" onClick={() => setModal({ user: null })}>Create user</button>} />
      <input className="input mb-4 sm:max-w-xs" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
      <div className="space-y-4">
        {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
        {error && <Alert>{error}</Alert>}
        <div className="card overflow-x-auto">
          {loading && !data ? (
            <Spinner />
          ) : users.length === 0 ? (
            <EmptyState title={q ? "No users match your search" : "No users"} />
          ) : (
            <table className={`min-w-full divide-y divide-slate-200 ${loading ? "opacity-60" : ""}`}>
              <thead className="bg-slate-50">
                <tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Status</th><th className="th">Created</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="td font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                    <td className="td">{u.email}</td>
                    <td className="td"><Badge value={u.role} /></td>
                    <td className="td"><Badge value={u.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                    <td className="td whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-secondary" onClick={() => setModal({ user: u })}>Edit</button>
                        <button className="btn btn-secondary" disabled={togglingId === u.id || u.id === me?.id} onClick={() => toggleActive(u)} title={u.id === me?.id ? "You cannot deactivate yourself" : undefined}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modal && (
        <UserFormModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={async (text) => {
            setModal(null);
            await reload();
            setNotice({ kind: "success", text });
          }}
        />
      )}
    </>
  );
}
