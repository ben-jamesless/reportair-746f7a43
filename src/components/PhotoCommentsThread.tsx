import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Member = { user_id: string; full_name: string | null; avatar_url: string | null };

type CommentRow = {
  id: string;
  project_id: string;
  photo_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
};

type EnrichedComment = CommentRow & {
  author_name: string;
  author_avatar: string | null;
};

interface Props {
  projectId: string;
  photoId: string;
  /** Whether the current user owns this project (for delete-any). */
  isOwner: boolean;
}

const MAX_LEN = 4000;
const bodySchema = z.string().trim().min(1, "Comment cannot be empty").max(MAX_LEN, `Comment must be under ${MAX_LEN} characters`);
// Mention token in raw body: @[Display Name](uuid)
const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g;

const renderBody = (body: string) => {
  const parts: Array<{ kind: "text" | "mention"; value: string }> = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    if (m.index! > last) parts.push({ kind: "text", value: body.slice(last, m.index!) });
    parts.push({ kind: "mention", value: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < body.length) parts.push({ kind: "text", value: body.slice(last) });
  return parts;
};

const initialsOf = (name: string | null | undefined) =>
  (name ?? "?").split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export const PhotoCommentsThread = ({ projectId, photoId, isOwner }: Props) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Mention picker state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState<number>(0); // index of '@' in body
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load project members + their profiles
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: pm } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);
      const ids = (pm ?? []).map((r) => r.user_id);
      if (ids.length === 0) { if (alive) setMembers([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      const list: Member[] = ids.map((uid) => ({
        user_id: uid,
        full_name: byId.get(uid)?.full_name ?? null,
        avatar_url: byId.get(uid)?.avatar_url ?? null,
      }));
      if (alive) setMembers(list);
    })();
    return () => { alive = false; };
  }, [projectId]);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  const enrich = useCallback((rows: CommentRow[]): EnrichedComment[] =>
    rows.map((r) => {
      const m = memberById.get(r.author_id);
      return {
        ...r,
        author_name: m?.full_name ?? "Teammate",
        author_avatar: m?.avatar_url ?? null,
      };
    }), [memberById]);

  // Load comments
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, project_id, photo_id, author_id, body, mentions, created_at")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: true });
      if (error) { if (alive) setComments([]); return; }
      if (alive) setComments(enrich((data ?? []) as CommentRow[]));
    })();
    return () => { alive = false; };
  }, [photoId, enrich]);

  // Realtime updates for this photo's comments
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${photoId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `photo_id=eq.${photoId}` },
        (payload) => {
          const row = payload.new as CommentRow;
          setComments((cur) => (cur.some((c) => c.id === row.id) ? cur : [...cur, ...enrich([row])]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `photo_id=eq.${photoId}` },
        (payload) => {
          const row = payload.old as CommentRow;
          setComments((cur) => cur.filter((c) => c.id !== row.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [photoId, enrich]);

  // Mention autocomplete: detect '@' word being typed at the caret
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    // Walk back from caret to find '@' that's at a word boundary
    const upto = value.slice(0, caret);
    const match = upto.match(/(^|\s)@(\w*)$/);
    if (match) {
      setMentionAnchor(caret - (match[2]?.length ?? 0) - 1);
      setMentionQuery((match[2] ?? "").toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!mentionOpen) return [];
    return members
      .filter((m) => m.user_id !== user?.id)
      .filter((m) => (m.full_name ?? "").toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [members, mentionOpen, mentionQuery, user?.id]);

  const insertMention = (m: Member) => {
    const before = body.slice(0, mentionAnchor);
    const afterIdx = mentionAnchor + 1 + mentionQuery.length;
    const after = body.slice(afterIdx);
    const token = `@[${m.full_name ?? "Teammate"}](${m.user_id}) `;
    const next = `${before}${token}${after}`;
    setBody(next);
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = (before + token).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    if (!user) return;
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid comment");
      return;
    }
    const cleanBody = parsed.data;
    const mentions = Array.from(new Set(Array.from(cleanBody.matchAll(MENTION_RE), (m) => m[2])));
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      project_id: projectId,
      photo_id: photoId,
      author_id: user.id,
      body: cleanBody,
      mentions,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    setMentionOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredMembers.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      insertMention(filteredMembers[0]);
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && mentionOpen) {
      setMentionOpen(false);
    }
  };

  const remove = async (c: EnrichedComment) => {
    if (!user) return;
    const canDelete = c.author_id === user.id || isOwner;
    if (!canDelete) return;
    const { error } = await supabase.from("comments").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    setComments((cur) => cur.filter((x) => x.id !== c.id));
  };

  if (!user) return null;

  return (
    <div className="border-t pt-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Comments <span className="ml-1 text-foreground/60">{comments.length}</span>
      </p>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No team comments yet. Mention a teammate with @.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const canDelete = c.author_id === user.id || isOwner;
            return (
              <li key={c.id} className="flex gap-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  {c.author_avatar
                    ? <img src={c.author_avatar} alt={c.author_name} className="h-full w-full object-cover" />
                    : <AvatarFallback className="bg-secondary text-[10px]">{initialsOf(c.author_name)}</AvatarFallback>}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-xs font-medium">{c.author_name}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(c)}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {renderBody(c.body).map((p, i) => (
                      p.kind === "mention"
                        ? <span key={i} className="rounded bg-primary/15 px-1 py-0.5 font-medium text-primary">@{p.value}</span>
                        : <span key={i}>{p.value}</span>
                    ))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative mt-3">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment… use @ to mention a teammate"
          maxLength={MAX_LEN}
          rows={2}
          className="min-h-[60px] resize-none text-sm"
        />
        {mentionOpen && filteredMembers.length > 0 && (
          <ul
            role="listbox"
            className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
          >
            {filteredMembers.map((m) => (
              <li key={m.user_id}>
                <button
                  type="button"
                  onClick={() => insertMention(m)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                  )}
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="bg-secondary text-[9px]">{initialsOf(m.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.full_name ?? "Teammate"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</span>
          <Button size="sm" onClick={submit} disabled={submitting || body.trim().length === 0}>
            {submitting ? "Sending…" : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
};
