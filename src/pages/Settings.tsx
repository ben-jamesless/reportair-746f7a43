import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, Upload, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";

const DEFAULT_BRAND = "#D94F2A";

// WCAG relative luminance — returns ratio against white.
function contrastRatioAgainstWhite(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 21;
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(h.slice(0, 2), 16));
  const g = toLin(parseInt(h.slice(2, 4), 16));
  const b = toLin(parseInt(h.slice(4, 6), 16));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (L + 0.05);
}

const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export default function SettingsPage() {
  const { plan, teamId, loading: planLoading } = usePlan();
  const isStudio = plan === "studio";

  const [email, setEmail] = useState<string>("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColour, setBrandColour] = useState<string>(DEFAULT_BRAND);
  const [initialBrand, setInitialBrand] = useState<string>(DEFAULT_BRAND);
  const [whiteLabel, setWhiteLabel] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [togglingWl, setTogglingWl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
    })();
  }, []);

  const loadTeam = useCallback(async () => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("teams")
      .select("logo_path, brand_colour, white_label_pdf")
      .eq("id", teamId)
      .maybeSingle();
    const t = data as { logo_path: string | null; brand_colour: string | null; white_label_pdf: boolean } | null;
    setLogoPath(t?.logo_path ?? null);
    setBrandColour(t?.brand_colour ?? DEFAULT_BRAND);
    setInitialBrand(t?.brand_colour ?? DEFAULT_BRAND);
    setWhiteLabel(!!t?.white_label_pdf);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  // Signed URL for current logo preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!logoPath) { setLogoUrl(null); return; }
      const { data } = await supabase.storage.from("export-assets").createSignedUrl(logoPath, 60 * 60);
      if (!cancelled) setLogoUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [logoPath]);

  const handlePickLogo = () => fileRef.current?.click();

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !teamId) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Only PNG or JPG files are supported.");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `logos/${teamId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("export-assets")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from("teams")
        .update({ logo_path: path })
        .eq("id", teamId);
      if (updErr) throw updErr;
      setLogoPath(path);
      toast.success("Logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!teamId) return;
    if (!isValidHex(brandColour)) {
      toast.error("Please enter a valid hex colour (e.g. #D94F2A).");
      return;
    }
    setSavingBrand(true);
    const { error } = await supabase
      .from("teams")
      .update({ brand_colour: brandColour })
      .eq("id", teamId);
    setSavingBrand(false);
    if (error) { toast.error(error.message); return; }
    setInitialBrand(brandColour);
    toast.success("Brand colour saved");
  };

  const handleToggleWhiteLabel = async (next: boolean) => {
    if (!teamId) return;
    setTogglingWl(true);
    const prev = whiteLabel;
    setWhiteLabel(next);
    const { error } = await supabase
      .from("teams")
      .update({ white_label_pdf: next })
      .eq("id", teamId);
    setTogglingWl(false);
    if (error) {
      setWhiteLabel(prev);
      toast.error(error.message);
      return;
    }
    toast.success(next ? "White-label enabled" : "White-label disabled");
  };

  const contrast = isValidHex(brandColour) ? contrastRatioAgainstWhite(brandColour) : 21;
  const lowContrast = contrast < 3;

  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Settings" }]}>
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account and customise your exported PDFs.
          </p>
        </div>

        {/* Section 1 — Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your sign-in email and current plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="truncate text-sm font-medium">{email || <Skeleton className="h-4 w-40" />}</p>
              </div>
              {planLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <Badge variant={isStudio ? "default" : "secondary"} className="capitalize">
                  {plan}
                </Badge>
              )}
            </div>
            <Separator />
            <Button asChild variant="outline" size="sm">
              <Link to="/billing">Manage subscription</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Section 2 — Branding */}
        {!isStudio ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <CardTitle>Branding</CardTitle>
              </div>
              <CardDescription>
                Upgrade to Studio to customise your PDF exports with your own logo, brand colour, and white-label mode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/billing">Upgrade to Studio</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Customise how your exported PDFs and share pages look.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  {/* 2a. Logo upload */}
                  <section className="space-y-3">
                    <div>
                      <Label>Company logo</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Displayed on exported PDFs.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG or JPG only. SVG is not supported. Recommended size: 800 × 800 px.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <div className="flex h-24 w-24 items-center justify-center rounded-md border bg-card p-2">
                          <img src={logoUrl} alt="Company logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground">
                          No logo
                        </div>
                      )}
                      <div>
                        <Button onClick={handlePickLogo} disabled={uploadingLogo} variant="outline" size="sm">
                          {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {uploadingLogo ? "Uploading…" : logoPath ? "Replace logo" : "Upload logo"}
                        </Button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={handleLogoChange}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* 2b. Brand colour */}
                  <section className="space-y-3">
                    <div>
                      <Label>Brand colour</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Used as the accent colour on all exported PDFs and share pages.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="color"
                        value={isValidHex(brandColour) ? brandColour : DEFAULT_BRAND}
                        onChange={(e) => setBrandColour(e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                        aria-label="Pick brand colour"
                      />
                      <Input
                        value={brandColour}
                        onChange={(e) => setBrandColour(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
                        placeholder="#D94F2A"
                        className="w-32 font-mono"
                        maxLength={7}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Preview</span>
                        <div
                          className="h-8 w-16 rounded-md border"
                          style={{ backgroundColor: isValidHex(brandColour) ? brandColour : "transparent" }}
                        />
                      </div>
                      <Button onClick={handleSaveBrand} disabled={savingBrand || brandColour === initialBrand} size="sm">
                        {savingBrand ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save
                      </Button>
                    </div>
                    {lowContrast && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>This colour may be hard to read on white backgrounds.</span>
                      </div>
                    )}
                  </section>

                  <Separator />

                  {/* 2c. White-label */}
                  <section className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label>Remove BuildSlides branding</Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Your logo replaces the BuildSlides mark on exported PDFs, and the "Built by BuildSlides" footer is hidden on share pages.
                        </p>

                      </div>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={whiteLabel}
                                onCheckedChange={handleToggleWhiteLabel}
                                disabled={!logoPath || togglingWl}
                                aria-label="Toggle white-label PDFs"
                              />
                            </div>
                          </TooltipTrigger>
                          {!logoPath && (
                            <TooltipContent>Upload a logo first</TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
