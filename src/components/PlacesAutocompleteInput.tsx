/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, Loader2, MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { cn } from "@/lib/utils";

export type PlacePick = {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
};

interface Props {
  id?: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (place: PlacePick) => void;
  verified?: boolean;
  placeholder?: string;
}

// Places API (New) autocomplete input. Free-text is still allowed — if the
// user doesn't pick a suggestion, only `onChange` fires and geo data stays
// unset. On pick, `onPick` fires with lat/lng/placeId.
export function PlacesAutocompleteInput({ id, value, onChange, onPick, verified, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(async (g) => {
        const lib = (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        if (cancelled) return;
        placesLibRef.current = lib;
        sessionRef.current = new lib.AutocompleteSessionToken();
        setReady(true);
      })
      .catch((e) => console.warn("Places autocomplete unavailable:", e));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchSuggestions = (input: string) => {
    const lib = placesLibRef.current;
    const token = sessionRef.current;
    if (!lib || !token || !input.trim()) { setSuggestions([]); return; }
    setLoading(true);
    lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: token })
      .then((res) => {
        setSuggestions(res.suggestions ?? []);
        setOpen(true);
      })
      .catch((e) => { console.warn("autocomplete err", e); setSuggestions([]); })
      .finally(() => setLoading(false));
  };

  const handleChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(v), 200);
  };

  const handlePick = async (s: google.maps.places.AutocompleteSuggestion) => {
    const lib = placesLibRef.current;
    const token = sessionRef.current;
    if (!lib || !s.placePrediction) return;
    setOpen(false);
    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location", "id", "displayName"] });
      const loc = place.location;
      if (!loc) return;
      const formatted =
        place.formattedAddress ||
        s.placePrediction.text?.toString() ||
        place.displayName ||
        "";
      onChange(formatted);
      onPick({
        formattedAddress: formatted,
        lat: loc.lat(),
        lng: loc.lng(),
        placeId: place.id ?? "",
      });
      // Rotate session token after selection (billing best practice).
      sessionRef.current = new lib.AutocompleteSessionToken();
    } catch (e) {
      console.warn("place details err", e);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(verified && "pr-8")}
        />
        {verified && (
          <span
            className="absolute inset-y-0 right-2 flex items-center text-emerald-600"
            title="Location verified"
          >
            <Check className="h-4 w-4" />
          </span>
        )}
        {loading && !verified && (
          <span className="absolute inset-y-0 right-2 flex items-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((s, i) => {
            const p = s.placePrediction;
            if (!p) return null;
            const main = p.mainText?.toString() || p.text?.toString() || "";
            const secondary = p.secondaryText?.toString() || "";
            return (
              <li key={`${main}-${i}`}>
                <button
                  type="button"
                  onClick={() => handlePick(s)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{main}</span>
                    {secondary && (
                      <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!ready && value && (
        <p className="mt-1 text-xs text-muted-foreground">
          Location search unavailable — free text will be saved as-is.
        </p>
      )}
    </div>
  );
}
