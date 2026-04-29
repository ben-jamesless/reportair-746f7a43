import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, MessageSquarePlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Annotation = {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
};

interface Props {
  photoId: string;
  projectId: string;
}

export const AnnotationsPanel = ({ photoId, projectId }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Annotation[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    supabase
      .from("annotations")
      .select("id, body, author_id, created_at")
      .eq("photo_id", photoId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancel) return;
        setItems((data ?? []) as Annotation[]);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [photoId]);

  const add = async () => {
    if (!body.trim() || !user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("annotations")
      .insert({ photo_id: photoId, project_id: projectId, author_id: user.id, body: body.trim() })
      .select("id, body, author_id, created_at")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Could not add note", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => [...prev, data as Annotation]);
    setBody("");
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((p) => p.filter((a) => a.id !== id));
    const { error } = await supabase.from("annotations").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-2">
        {items.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
        {items.map((a) => (
          <div key={a.id} className="group rounded-md border bg-background p-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap break-words text-foreground">{a.body}</p>
              {user?.id === a.author_id && (
                <button
                  onClick={() => remove(a.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note about this photo…"
          rows={2}
          className="resize-none text-sm"
        />
        <Button size="sm" onClick={add} disabled={!body.trim() || saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <MessageSquarePlus className="mr-2 h-3 w-3" />}
          Add note
        </Button>
      </div>
    </div>
  );
};
