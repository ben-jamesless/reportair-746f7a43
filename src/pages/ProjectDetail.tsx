import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ImagePlus, Loader2 } from "lucide-react";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PhotoThumb } from "@/components/PhotoThumb";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";

type Project = {
  id: string;
  name: string;
  description: string | null;
  template: string;
};

type Album = { id: string; name: string; slug: string; position: number };

const ALL = "__all__";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<LightboxPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAlbum, setActiveAlbum] = useState<string>(ALL);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [{ data: p }, { data: a }, { data: ph }] = await Promise.all([
      supabase.from("projects").select("id, name, description, template").eq("id", id).maybeSingle(),
      supabase.from("albums").select("id, name, slug, position").eq("project_id", id).order("position"),
      supabase
        .from("photos")
        .select(
          "id, album_id, storage_path, file_name, caption, captured_at, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_lat, gps_lng, width, height"
        )
        .eq("project_id", id)
        .order("captured_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);
    setProject(p ?? null);
    setAlbums(a ?? []);
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

  const visiblePhotos = useMemo(() => {
    if (activeAlbum === ALL) return photos;
    return photosByAlbum.get(activeAlbum) ?? [];
  }, [activeAlbum, photos, photosByAlbum]);

  const activeAlbumId = activeAlbum === ALL ? null : activeAlbum;

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
            <PhotoUploader projectId={project.id} albumId={activeAlbumId} onUploaded={loadAll} />
            {activeAlbumId === null && albums.length > 0 && (
              <p className="text-xs text-muted-foreground">Uploading to: <span className="font-medium">All photos</span> (unsorted)</p>
            )}
          </div>
        </div>

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

        <PhotoLightbox
          photos={visiblePhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      </main>
    </div>
  );
};

export default ProjectDetail;
