// exifr is heavy (~50KB gz). Loaded on demand the first time a user picks a file.
let exifrModulePromise: Promise<typeof import("exifr").default> | null = null;
const loadExifr = () => {
  if (!exifrModulePromise) {
    exifrModulePromise = import("exifr").then((m) => m.default);
  }
  return exifrModulePromise;
};

export type ExifData = {
  captured_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  iso: number | null;
  aperture: number | null;
  shutter_speed: string | null;
  focal_length: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  width: number | null;
  height: number | null;
};

export const EMPTY_EXIF: ExifData = {
  captured_at: null,
  camera_make: null,
  camera_model: null,
  lens: null,
  iso: null,
  aperture: null,
  shutter_speed: null,
  focal_length: null,
  gps_lat: null,
  gps_lng: null,
  width: null,
  height: null,
};

const formatShutter = (v: unknown): string | null => {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n) || n <= 0) return null;
  if (n >= 1) return `${n}s`;
  return `1/${Math.round(1 / n)}`;
};

type ExifRaw = {
  DateTimeOriginal?: string | Date;
  CreateDate?: string | Date;
  ModifyDate?: string | Date;
  Make?: string;
  Model?: string;
  LensModel?: string;
  Lens?: string;
  ISO?: number | string;
  FNumber?: number | string;
  ExposureTime?: number | string;
  FocalLength?: number | string;
  latitude?: number;
  longitude?: number;
  ExifImageWidth?: number;
  ImageWidth?: number;
  ExifImageHeight?: number;
  ImageHeight?: number;
};

export async function parseExif(file: File): Promise<ExifData> {
  try {
    const exifr = await loadExifr();
    const data = (await exifr.parse(file, { gps: true, tiff: true, exif: true })) as ExifRaw | null;
    if (!data) return EMPTY_EXIF;
    const captured = data.DateTimeOriginal || data.CreateDate || data.ModifyDate || null;
    return {
      captured_at: captured ? new Date(captured).toISOString() : null,
      camera_make: data.Make ?? null,
      camera_model: data.Model ?? null,
      lens: data.LensModel ?? data.Lens ?? null,
      iso: data.ISO != null ? Number(data.ISO) : null,
      aperture: data.FNumber != null ? Number(data.FNumber) : null,
      shutter_speed: formatShutter(data.ExposureTime),
      focal_length: data.FocalLength != null ? Number(data.FocalLength) : null,
      gps_lat: typeof data.latitude === "number" ? data.latitude : null,
      gps_lng: typeof data.longitude === "number" ? data.longitude : null,
      width: data.ExifImageWidth ?? data.ImageWidth ?? null,
      height: data.ExifImageHeight ?? data.ImageHeight ?? null,
    };
  } catch {
    return EMPTY_EXIF;
  }
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

type DateGroupablePhoto = {
  id: string;
  captured_at?: string | null;
  created_at?: string | null;
};

export type PhotoDateGroup<T> = {
  key: string;
  label: string;
  date: Date;
  photos: T[];
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function groupPhotosByDate<T extends DateGroupablePhoto>(photos: T[]): PhotoDateGroup<T>[] {
  const groups = new Map<string, PhotoDateGroup<T>>();
  for (const p of photos) {
    const raw = p.captured_at || p.created_at;
    const d = raw ? new Date(raw) : new Date(0);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, label: raw ? DATE_FMT.format(d) : "Unknown date", date: d, photos: [] };
      groups.set(key, g);
    }
    g.photos.push(p);
  }
  return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}
