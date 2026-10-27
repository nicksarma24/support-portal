import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { Alert, Badge, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { User } from "../types";
import { formatDate, useFetch } from "../utils";

export default function Profile() {
  const { setUser } = useAuth();
  const { data, loading, error, reload } = useFetch<{ user: User }>("/profile");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const profile = data?.user;

  useEffect(() => { if (profile) setName(profile.name); }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await api.patch<{ user: User }>("/profile", { name });
      setUser(res.data.user);
      await reload();
      setNotice({ kind: "success", text: "Profile updated" });
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) return <Spinner />;
  return (
    <>
      <PageHeader title="Profile" subtitle="Your account details" />
      {error && <Alert>{error}</Alert>}
      {profile && (
        <form onSubmit={handleSubmit} className="card max-w-xl space-y-4 p-6">
          {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
          <div>
            <label className="label" htmlFor="p-name">Name</label>
            <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div><span className="label">Email</span><div className="text-sm">{profile.email}</div></div>
          <div><span className="label">Role</span><Badge value={profile.role} /></div>
          <div><span className="label">Member since</span><div className="text-sm">{formatDate(profile.createdAt)}</div></div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving || name.trim() === profile.name}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      )}
    </>
  );
}
