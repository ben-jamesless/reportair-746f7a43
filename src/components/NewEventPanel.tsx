import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, X, Check } from "lucide-react";
import { event as gaEvent } from "@/lib/analytics";
import { PlacesAutocompleteInput, type PlacePick } from "./PlacesAutocompleteInput";
import { LocationMapPreview } from "./LocationMapPreview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  onCreated?: () => void;
}

/**
 * Single-modal "Create new event" flow (Phase 4 pt 1).
 * Fields: name (required), location (Places autocomplete + map preview), areas (name-only rows).
 * No templates, no invites, no boundary drawing here — boundaries happen on the Map tab.
 */
export function NewEventPanel({ open, onOpenChange, teamId, onCreated }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [place, setPlace] = useState<PlacePick | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [areaDraft, setAreaDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setLocationText("");
    setPlace(null);
    setAreas([]);
    setAreaDraft("");
    setBusy(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const addArea = () => {
    const v = areaDraft.trim();
    if (!v) return;
    if (areas.some((a) => a.toLowerCase() === v.toLowerCase())) {
      setAreaDraft("");
      return;
    }
    setAreas((s) => [...s, v]);
    setAreaDraft("");
  };

  const removeArea = (idx: number) => setAreas((s) => s.filter((_, i) => i !== idx));

  const handleLocationText = (text: string) => {
    setLocationText(text);
    // Free text edit after a pick invalidates the resolved pin
    if (place && text !== place.formattedAddress) setPlace(null);
  };

  const create = async () => {
    if (!user || !teamId) return toast.error("No team available");
    if (!name.trim()) return toast.error("Event name is required");

    setBusy(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        team_id: teamId,
        name: name.trim(),
        event_location: place?.formattedAddress ?? locationText.trim() ?? null,
        geo_lat: place?.lat ?? null,
        geo_lng: place?.lng ?? null,
        geo_place_id: place?.placeId ?? null,
        geo_location_query: place?.formattedAddress ?? null,
        created_by: user.id,
        template: "blank",
      })
      .select("id")
      .single();

    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Failed to create event");
    }

    if (areas.length > 0) {
      const rows = areas.map((a, idx) => ({
        project_id: data.id,
        name: a,
        sort_order: idx,
        created_by: user.id,
      }));
      const { error: aErr } = await supabase.from("areas").insert(rows);
      if (aErr) console.warn("Area seeding failed (non-fatal):", aErr.message);
    }

    setBusy(false);
    gaEvent("create_event", { has_location: !!place, area_count: areas.length });
    toast.success("Event created");
    onCreated?.();
    handleOpenChange(false);
    navigate(`/projects/${data.id}?tab=overview`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create new event</DialogTitle>
          <DialogDescription>
            Name your event, set the location, and optionally add areas. You can draw area boundaries on the Map tab after creating.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="ev-name">Event name</Label>
            <Input
              id="ev-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring Gala 2026"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-loc">Event location</Label>
            <PlacesAutocompleteInput
              id="ev-loc"
              value={locationText}
              onChange={handleLocationText}
              onPick={(p) => {
                setPlace(p);
                setLocationText(p.formattedAddress);
              }}
              verified={!!place}
              placeholder="Search an address or venue"
            />
            {place ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Address applied
                </div>
                <LocationMapPreview lat={place.lat} lng={place.lng} className="h-40 w-full overflow-hidden border" />
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Pick a suggestion to drop a pin. Free text is saved as-is.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Areas <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex gap-2">
              <Input
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                placeholder="e.g. Media & Officials"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addArea(); }
                }}
              />
              <Button type="button" variant="outline" onClick={addArea} disabled={!areaDraft.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {areas.length > 0 && (
              <ul className="divide-y border">
                {areas.map((a, i) => (
                  <li key={`${a}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">{a}</span>
                    <button
                      type="button"
                      onClick={() => removeArea(i)}
                      className="rounded p-1 hover:bg-muted/40"
                      aria-label={`Remove ${a}`}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Name-only here. Draw boundaries on the Map tab after creating.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={busy || !name.trim()}
            className="bg-[#D94F2A] hover:bg-[#D94F2A]/90 text-white"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
