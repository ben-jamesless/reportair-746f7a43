import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { V2 } from "../tokens";

export const MAX_COMMENT_LENGTH = 1000;

/** Anchor a new comment to an area / day / photo. */
export type CommentAnchor = {
  area_id?: string | null;
  photo_id?: string | null;
  day?: string | null;
  /** Human label shown in the composer, e.g. "Car Park · 13 Aug". */
  label?: string | null;
};

type CommentRow = {
  id: string;
  parent_id: string | null;
  area_id: string | null;
  area_name: string | null;
  photo_id: string | null;
  day: string | null;
  guest_name: string;
  body: string;
  is_ops: boolean;
  resolved_at: string | null;
  /** Only ever true for ops viewers — guests never receive hidden rows. */
  hidden?: boolean;
  created_at: string;

};

type Thread = { root: CommentRow; replies: CommentRow[] };

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

function dayLabel(day: string | null) {
  if (!day) return null;
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "on Car Park · 13 Aug" — omitted entirely when the comment has no anchor. */
function anchorText(c: Pick<CommentRow, "area_name" | "day" | "photo_id">) {
  const parts: string[] = [];
  if (c.area_name) parts.push(c.area_name);
  const d = dayLabel(c.day);
  if (d) parts.push(d);
  if (c.photo_id && parts.length === 0) parts.push("a photo");
  else if (c.photo_id) parts.push("photo");
  return parts.length ? `on ${parts.join(" · ")}` : null;
}

const chipStyle: React.CSSProperties = {
  fontFamily: V2.mono,
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "3px 6px",
};

const inputStyle: React.CSSProperties = {
  border: `1px solid ${V2.rule}`,
  fontSize: 13,
  backgroundColor: V2.paper,
  color: V2.ink,
};

function actionStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: V2.mono,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: V2.bandFg,
    backgroundColor: disabled ? V2.muted : V2.band,
    padding: "9px 14px",
  };
}

/**
 * Guest + ops comment composer. Hidden behind a "Leave a comment" button so the
 * page never presents an always-open input to drive-by bots.
 */
function Composer({
  anchorLabel,
  submitting,
  onCancel,
  onSubmit,
  compact = false,
  requireIdentity = true,
  placeholder = "Leave a comment on this report…",
}: {
  anchorLabel?: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (v: { name: string; email: string; body: string; honeypot: string }) => void;
  compact?: boolean;
  /** Ops replies are already authenticated, so no name/email is asked for. */
  requireIdentity?: boolean;
  placeholder?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  const identityOk = !requireIdentity || (name.trim().length > 0 && email.trim().length > 0);
  const canSend = identityOk && body.trim().length > 0 && body.length <= MAX_COMMENT_LENGTH && !submitting;

  return (
    <div className="flex flex-col gap-2" style={{ padding: compact ? "10px 0 2px" : "12px 16px" }}>
      {anchorLabel && (
        <span style={{ ...chipStyle, color: V2.soft, backgroundColor: V2.paperDim, alignSelf: "flex-start" }}>
          on {anchorLabel}
        </span>
      )}

      {requireIdentity && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            autoComplete="name"
            className="min-w-0 flex-1 px-2.5 py-2 outline-none"
            style={inputStyle}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            type="email"
            maxLength={160}
            autoComplete="email"
            className="min-w-0 flex-1 px-2.5 py-2 outline-none"
            style={inputStyle}
          />
        </div>
      )}

      {/* Honeypot — visually and programmatically hidden from real users. */}
      <input
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        maxLength={MAX_COMMENT_LENGTH}
        className="w-full resize-none px-2.5 py-2 outline-none"
        style={inputStyle}
      />

      <div className="flex items-center justify-between gap-3">
        <span style={{ fontFamily: V2.mono, fontSize: 10.5, color: V2.muted }}>
          {body.length} / {MAX_COMMENT_LENGTH}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            style={{ fontSize: 11.5, color: V2.muted, textDecoration: "underline" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => onSubmit({ name: name.trim(), email: email.trim(), body: body.trim(), honeypot })}
            style={actionStyle(!canSend)}
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Threaded client feedback for the v2 share page.
 *
 * Roots are newest-first with replies chronological underneath; nesting is one
 * level only. Ops (owner/editor) see resolve/reopen per thread and can reply
 * with a badge; owners additionally get a hide action that also hides replies.
 * Once the event is filed the whole panel becomes a read-only archive.
 */
export function ReportFeedback({
  token,
  readOnly = false,
  pendingAnchor = null,
  onPendingAnchorHandled,
}: {
  token: string;
  /** Filed events: structure preserved, no inputs, no resolve toggles. */
  readOnly?: boolean;
  /** Set by the area card / lightbox "Leave a comment" entry points. */
  pendingAnchor?: CommentAnchor | null;
  onPendingAnchorHandled?: () => void;
}) {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isOps = role === "owner" || role === "editor";
  const isOwner = role === "owner";

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("list_report_comments_public" as never, { _token: token } as never);
    setRows((data ?? []) as unknown as CommentRow[]);
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("share_viewer_role" as never, { _token: token } as never);
      if (alive) setRole((data as string | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  // An entry point elsewhere on the page asked to start an anchored comment.
  useEffect(() => {
    if (!pendingAnchor || readOnly) return;
    setAnchor(pendingAnchor);
    setReplyTo(null);
    setComposerOpen(true);
    onPendingAnchorHandled?.();
    window.requestAnimationFrame(() =>
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }, [pendingAnchor, readOnly, onPendingAnchorHandled]);

  const threads: Thread[] = useMemo(() => {
    const roots = rows.filter((r) => r.parent_id === null);
    const byParent = new Map<string, CommentRow[]>();
    for (const r of rows) {
      if (!r.parent_id) continue;
      const list = byParent.get(r.parent_id) ?? [];
      list.push(r);
      byParent.set(r.parent_id, list);
    }
    return roots
      .slice()
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .map((root) => ({
        root,
        replies: (byParent.get(root.id) ?? [])
          .slice()
          .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
      }));
  }, [rows]);

  const openCount = threads.filter((t) => !t.root.resolved_at).length;

  const postGuest = async (v: { name: string; email: string; body: string; honeypot: string }, parentId: string | null) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: v.name,
          email: v.email,
          body: v.body,
          website: v.honeypot,
          parent_id: parentId,
          area_id: parentId ? null : anchor?.area_id ?? null,
          photo_id: parentId ? null : anchor?.photo_id ?? null,
          day: parentId ? null : anchor?.day ?? null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j?.error ?? "Could not send your comment.");
        return;
      }
      setComposerOpen(false);
      setReplyTo(null);
      setAnchor(null);
      await load();
      toast.success("Comment sent");
    } catch {
      toast.error("Could not send your comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const postOpsReply = async (parentId: string, body: string) => {
    setSubmitting(true);
    const { error } = await supabase.rpc("add_report_comment_ops" as never, {
      _token: token,
      _parent_id: parentId,
      _body: body,
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReplyTo(null);
    await load();
    toast.success("Reply sent");
  };

  const toggleResolved = async (id: string, resolved: boolean) => {
    const { error } = await supabase.rpc("set_report_comment_resolved" as never, {
      _id: id,
      _resolved: resolved,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  const hide = async (id: string) => {
    const { error } = await supabase.rpc("set_report_comment_hidden" as never, {
      _id: id,
      _hidden: true,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Comment hidden");
    load();
  };

  const headerTitle = readOnly ? "Feedback archive" : "Feedback";
  const headerCount = readOnly ? threads.length : openCount;

  return (
    <div
      ref={rootRef}
      className="mb-7 overflow-hidden"
      style={{ border: `1px solid ${V2.rule}`, borderRadius: V2.radiusReport }}
    >
      <div className="flex items-center justify-between" style={{ backgroundColor: V2.band, padding: "12px 16px" }}>
        <span
          className="uppercase"
          style={{ fontFamily: V2.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: V2.bandFgSoft }}
        >
          {headerTitle}
        </span>
        <span
          style={{ fontFamily: V2.mono, fontSize: 12, fontWeight: 700, color: V2.bandFg }}
          title={readOnly ? "Archived threads" : "Open threads"}
        >
          {headerCount}
          {!readOnly && <span style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7 }}> OPEN</span>}
        </span>
      </div>

      <div style={{ backgroundColor: V2.white }}>
        {threads.length === 0 && (
          <p className="px-4 py-4" style={{ fontSize: 12.5, color: V2.muted }}>
            {readOnly ? "No feedback was left on this report." : "No comments yet."}
          </p>
        )}

        <div className="max-h-[520px] overflow-y-auto">
          {threads.map(({ root, replies }) => {
            const anchorLine = anchorText(root);
            return (
              <div
                key={root.id}
                id={`comment-${root.id}`}
                className="px-4 py-3"
                style={{ borderTop: `1px solid ${V2.rule}`, opacity: root.resolved_at ? 0.72 : 1 }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: V2.ink }}>
                    {root.guest_name}
                    {root.is_ops && (
                      <span style={{ ...chipStyle, color: V2.bandFg, backgroundColor: V2.band }}>Site team</span>
                    )}
                    {root.resolved_at && (
                      <span style={{ ...chipStyle, color: V2.soft, backgroundColor: V2.paperDim }}>Resolved</span>
                    )}
                  </span>
                  <span style={{ fontFamily: V2.mono, fontSize: 10.5, color: V2.muted }}>{stamp(root.created_at)}</span>
                </div>

                {anchorLine && (
                  <span
                    className="mt-1.5 inline-block"
                    style={{ ...chipStyle, color: V2.soft, backgroundColor: V2.paperDim }}
                  >
                    {anchorLine}
                  </span>
                )}

                <p className="mt-1.5 whitespace-pre-wrap" style={{ fontSize: 13, color: V2.soft, lineHeight: 1.55 }}>
                  {root.body}
                </p>

                {replies.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-2.5" style={{ paddingLeft: 12, borderLeft: `2px solid ${V2.rule}` }}>
                    {replies.map((r) => (
                      <div key={r.id} id={`comment-${r.id}`}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex items-center gap-2" style={{ fontSize: 12.5, fontWeight: 700, color: V2.ink }}>
                            {r.guest_name}
                            {r.is_ops && (
                              <span style={{ ...chipStyle, color: V2.bandFg, backgroundColor: V2.band }}>Site team</span>
                            )}
                          </span>
                          <span style={{ fontFamily: V2.mono, fontSize: 10, color: V2.muted }}>{stamp(r.created_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap" style={{ fontSize: 12.5, color: V2.soft, lineHeight: 1.55 }}>
                          {r.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {!readOnly && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo((cur) => (cur === root.id ? null : root.id));
                        setComposerOpen(false);
                      }}
                      style={{ fontSize: 11.5, color: V2.ink, textDecoration: "underline" }}
                    >
                      {replyTo === root.id ? "Cancel reply" : "Reply"}
                    </button>
                    {isOps && (
                      <button
                        type="button"
                        onClick={() => toggleResolved(root.id, !root.resolved_at)}
                        style={{ fontSize: 11.5, color: V2.ink, textDecoration: "underline" }}
                      >
                        {root.resolved_at ? "Reopen" : "Resolve"}
                      </button>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => hide(root.id)}
                        style={{ fontSize: 11.5, color: V2.muted, textDecoration: "underline" }}
                        title="Hides this comment and its replies from the client report"
                      >
                        Hide
                      </button>
                    )}
                  </div>
                )}

                {!readOnly && replyTo === root.id && (
                  <Composer
                    compact
                    submitting={submitting}
                    requireIdentity={!isOps}
                    placeholder={isOps ? "Reply as the site team…" : "Write a reply…"}
                    onCancel={() => setReplyTo(null)}
                    onSubmit={(v) => (isOps ? postOpsReply(root.id, v.body) : postGuest(v, root.id))}
                  />
                )}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <div style={{ borderTop: `1px solid ${V2.rule}` }}>
            {composerOpen ? (
              <Composer
                anchorLabel={anchor?.label ?? null}
                submitting={submitting}
                requireIdentity
                onCancel={() => {
                  setComposerOpen(false);
                  setAnchor(null);
                }}
                onSubmit={(v) => postGuest(v, null)}
              />
            ) : (
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setAnchor(null);
                    setReplyTo(null);
                    setComposerOpen(true);
                  }}
                  style={actionStyle(false)}
                >
                  Leave a comment
                </button>
              </div>
            )}
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
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: V2.bandFgSoft,
          padding: "12px 16px",
          backgroundColor: V2.band,
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
      </div>
    </div>
  );
}
