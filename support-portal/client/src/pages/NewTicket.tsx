import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { Alert, PageHeader } from "../components/ui";
import { Ticket } from "../types";

export default function NewTicket() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ ticket: Ticket }>("/tickets", { title, description });
      navigate(`/tickets/${res.data.ticket.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="New ticket" subtitle="Describe your issue and we'll get back to you." />
      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4 p-6">
        {error && <Alert>{error}</Alert>}
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" className="input min-h-[8rem]" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={5000} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Creating…" : "Create ticket"}</button>
        </div>
      </form>
    </>
  );
}
