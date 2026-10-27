import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Role, User } from "../types";
import { Alert } from "./ui";

interface Props {
  user: User | null; // null = create
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function UserFormModal({ user, onClose, onSaved }: Props) {
  const { user: me } = useAuth();
  const editing = !!user;
  const isSelf = user?.id === me?.id;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "USER");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await api.patch(`/users/${user!.id}`, {
          name,
          email,
          ...(isSelf ? {} : { role }),
          ...(password ? { password } : {}),
        });
        onSaved("User updated");
      } else {
        await api.post("/users", { name, email, password, role, isActive });
        onSaved("User created");
      }
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? "Edit user" : "Create user"}>
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4 p-6">
        <h2 className="text-lg font-semibold">{editing ? "Edit user" : "Create user"}</h2>
        {error && <Alert>{error}</Alert>}
        <div>
          <label className="label" htmlFor="u-name">Name</label>
          <input id="u-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </div>
        <div>
          <label className="label" htmlFor="u-email">Email</label>
          <input id="u-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="u-pass">{editing ? "New password (leave blank to keep)" : "Password"}</label>
          <input id="u-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required={!editing} minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="u-role">Role</label>
          <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          {isSelf && <p className="mt-1 text-xs text-slate-500">You cannot change your own role.</p>}
        </div>
        {!editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Account active
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
