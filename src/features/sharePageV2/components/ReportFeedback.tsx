import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { V2 } from "../tokens";

type Note = { id: string; guest_name: string; body: string; created_at: string; photo_id: string | null };

function stamp(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (yest) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

/**
 * Client-facing feedback thread + ops contact for the v2 share page.
 * Notes are project-level (photo_id null) so a client can respond to the
 * report as a whole, not just an individual photo.
 */
export function ReportFeedback({
  token,
  areaNameByPhoto,
  readOnly = false,
}: {
  token: string;
  /** Optional label for photo-scoped notes, so replies keep their context. */
  areaNameByPhoto?: Map<string, string>;
  readOnly?: boolean;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("list_guest_notes_project_public", { _token: token });
    setNotes((data ?? []) as Note[]);
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const send = async () => {
    if (!body.trim() || !name.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("add_guest_note_project_public" as never, {
      _token: token,
      _name: name.trim(),
      _email: "",
      _body: body.trim(),
    } as never);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    load();
    toast.success("Comment sent");
  };

  return (
    <div className="mb-7 overflow-hidden" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}>
      <div
        className="flex items-center justify-between"
        style={{ backgroundColor: V2.ink, padding: "12px 16px" }}
      >
        <span
          className="uppercase"
          style={{ fontFamily: V2.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,.65)" }}
        >
          Feedback
        </span>
        <span style={{ fontFamily: V2.mono, fontSize: 12, fontWeight: 700, color: "#fff" }}>{notes.length}</span>
      </div>

      <div style={{ backgroundColor: V2.white }}>
        {notes.length === 0 && (
          <p className="px-4 py-4" style={{ fontSize: 12.5, color: V2.muted }}>
            No comments yet.
          </p>
        )}
        <div className="max-h-[360px] overflow-y-auto">
          {notes.map((n) => {
            const areaName = n.photo_id ? areaNameByPhoto?.get(n.photo_id) : null;
            return (
              <div key={n.id} className="px-4 py-3" style={{ borderTop: `1px solid ${V2.rule}` }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span style={{ fontSize: 13, fontWeight: 700, color: V2.ink }}>{n.guest_name}</span>
                  <span style={{ fontFamily: V2.mono, fontSize: 10.5, color: V2.muted }}>{stamp(n.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap" style={{ fontSize: 13, color: V2.soft, lineHeight: 1.55 }}>
                  {n.body}
                </p>
                {areaName && (
                  <span
                    className="mt-2 inline-block uppercase"
                    style={{
                      fontFamily: V2.mono,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.09em",
                      color: V2.soft,
                      backgroundColor: V2.paperDim,
                      padding: "3px 6px",
                    }}
                  >
                    {areaName}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <div className="flex flex-col gap-2 px-4 py-3" style={{ borderTop: `1px solid ${V2.rule}` }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="w-full px-2.5 py-2 outline-none"
              style={{ border: `1px solid ${V2.rule}`, fontSize: 13, backgroundColor: V2.paper, color: V2.ink }}
            />
            <div className="flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Leave a comment on this report…"
                maxLength={2000}
                className="min-w-0 flex-1 px-2.5 py-2 outline-none"
                style={{ border: `1px solid ${V2.rule}`, fontSize: 13, backgroundColor: V2.paper, color: V2.ink }}
              />
              <button
                type="button"
                onClick={send}
                disabled={!body.trim() || !name.trim() || sending}
                className="uppercase"
                style={{
                  fontFamily: V2.mono,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  color: "#fff",
                  backgroundColor: !body.trim() || !name.trim() ? V2.muted : V2.ink,
                  padding: "0 14px",
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function OpsContact({ contact }: { contact: { name: string; role?: string | null } | null }) {
  if (!contact?.name) return null;
  return (
    <div className="mb-7" style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport, backgroundColor: V2.white }}>
      <div
        className="uppercase"
        style={{
          fontFamily: V2.mono,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: V2.muted,
          padding: "10px 14px",
          backgroundColor: V2.paperDim,
          borderBottom: `1px solid ${V2.rule}`,
        }}
      >
        Ops contact
      </div>
      <div className="px-3.5 py-3.5">
        <p style={{ fontSize: 14, fontWeight: 700, color: V2.ink }}>{contact.name}</p>
        {contact.role && (
          <p className="capitalize" style={{ fontSize: 12.5, color: V2.muted }}>
            {contact.role}
          </p>
        )}
        <p className="mt-2.5" style={{ fontSize: 12.5, color: V2.soft }}>
          Questions about this report → reply to the link sender
        </p>
      </div>
    </div>
  );
}
