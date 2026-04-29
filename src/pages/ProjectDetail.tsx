import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ImagePlus, Loader2, MapPinned } from "lucide-react";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PhotoThumb } from "@/components/PhotoThumb";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
};

type Album = { id: string; name: string; slug: string; position: number };
type Area = { id: string; name: string; sort_order: number };

const ALL = "__all__";
const ALL_AREAS = "__all_areas__";
const NO_AREA = "__no_area__";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAlbum, setActiveAlbum] = useState<string>(ALL);
  const [activeArea, setActiveArea] = useState<string>(ALL_AREAS);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: a }, { data: ar }, { data: ph }] = await Promise.all([
      supabase.from("projects").select("id, name, description, template").eq("id", id).maybeSingle(),
      supabase.from("albums").select("id, name, slug, position").eq("project_id", id).order("position"),
      supabase.from("areas").select("id, name, sort_order").eq("project_id", id).order("sort_order"),
      supabase
        .from("photos")
        .select(
          "id, project_id, album_id, area_id, storage_path, file_name, caption, captured_at, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height"
        )
        .eq("project_id", id)
        .order("captured_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);
    setProject(p ?? null);
    setAlbums(a ?? []);
    setAreas((ar ?? []) as Area[]);
    setPhotos((ph ?? []) as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const photosByAlbum = useMemo(() => {
    const map = new Map<string, LightboxPhoto[]>();
    for (const p of photos) {
      const k = (p as any).album_id ?? "unsorted";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [photos]);

  // Photos filtered by album first
  const albumFilteredPhotos = useMemo(() => {
    if (activeAlbum === ALL) return photos;
    return photosByAlbum.get(activeAlbum) ?? [];
  }, [activeAlbum, photos, photosByAlbum]);

  // Then by area
  const visiblePhotos = useMemo(() => {
    if (activeArea === ALL_AREAS) return albumFilteredPhotos;
    if (activeArea === NO_AREA) return albumFilteredPhotos.filter((p) => !p.area_id);
    return albumFilteredPhotos.filter((p) => p.area_id === activeArea);
  }, [albumFilteredPhotos, activeArea]);

  const groupedPhotos = useMemo(() => groupPhotosByDate(visiblePhotos), [visiblePhotos]);

  const photoIndexById = useMemo(() => {
    const m = new Map<string, number>();
    visiblePhotos.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [visiblePhotos]);

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const p of albumFilteredPhotos) {
      if (!p.area_id) unassigned++;
      else counts.set(p.area_id, (counts.get(p.area_id) ?? 0) + 1);
    }
    return { counts, unassigned };
  }, [albumFilteredPhotos]);

  const activeAlbumId = activeAlbum === ALL ? null : activeAlbum;

  const handleAreaChanged = (photoId: string, areaId: string | null) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, area_id: areaId } : p)));
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="container py-10">
          <p className="text-muted-foreground">Project not found.</p>
          <Link to="/projects" className="mt-4 inline-block text-sm text-primary underline">Back to projects</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppHeader />
      <main className="container py-10">
        <Link to="/projects" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All projects
        </Link>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-2">
              {project.template === "event_production" ? "Event production" : "Blank"}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <ProjectSettingsDialog projectId={project.id} onChanged={loadAll} />
              <PhotoUploader projectId={project.id} albumId={activeAlbumId} onUploaded={loadAll} />
            </div>
            {activeAlbumId === null && albums.length > 0 && (
              <p className="text-xs text-muted-foreground">Uploading to: <span className="font-medium">All photos</span> (unsorted)</p>
            )}
          </div>
        </div>

        <Tabs defaultValue="photos" className="w-full">
          <TabsList>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="mt-6">
            <Tabs value={activeAlbum} onValueChange={setActiveAlbum} className="w-full">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value={ALL} className="data-[state=active]:bg-secondary">
                  All photos <span className="ml-2 text-xs text-muted-foreground">{photos.length}</span>
                </TabsTrigger>
                {albums.map((a) => (
                  <TabsTrigger key={a.id} value={a.id} className="data-[state=active]:bg-secondary">
                    {a.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {(photosByAlbum.get(a.id) ?? []).length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeAlbum} className="mt-6">
                {/* Area filter chips */}
                {areas.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                      <MapPinned className="h-3 w-3" /> Area
                    </span>
                    <AreaChip
                      active={activeArea === ALL_AREAS}
                      onClick={() => setActiveArea(ALL_AREAS)}
                      label="All"
                      count={albumFilteredPhotos.length}
                    />
                    {areas.map((ar) => (
                      <AreaChip
                        key={ar.id}
                        active={activeArea === ar.id}
                        onClick={() => setActiveArea(ar.id)}
                        label={ar.name}
                        count={areaCounts.counts.get(ar.id) ?? 0}
                      />
                    ))}
                    {areaCounts.unassigned > 0 && (
                      <AreaChip
                        active={activeArea === NO_AREA}
                        onClick={() => setActiveArea(NO_AREA)}
                        label="Unassigned"
                        count={areaCounts.unassigned}
                      />
                    )}
                  </div>
                )}

                {visiblePhotos.length === 0 ? (
                  <Card className="border-dashed shadow-none">
                    <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                      <h2 className="text-lg font-semibold">No photos yet</h2>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Upload images to extract EXIF (capture time, camera, GPS) and start telling the story.
                      </p>
                      <PhotoUploader projectId={project.id} albumId={activeAlbumId} onUploaded={loadAll} />
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {visiblePhotos.map((p, i) => (
                      <PhotoThumb
                        key={p.id}
                        path={p.storage_path}
                        alt={p.caption || p.file_name}
                        onClick={() => setLightboxIndex(i)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ActivityFeed projectId={project.id} />
          </TabsContent>
        </Tabs>

        <PhotoLightbox
          photos={visiblePhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          areas={areas}
          onAreaChanged={handleAreaChanged}
        />
      </main>
    </div>
  );
};

const AreaChip = ({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-foreground hover:bg-secondary"
    )}
  >
    {label}
    <span className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
  </button>
);

export default ProjectDetail;
