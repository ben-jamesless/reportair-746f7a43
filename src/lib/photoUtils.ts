import exifr from "exifr";

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

export async function parseExif(file: File): Promise<ExifData> {
  try {
    const data: any = await exifr.parse(file, { gps: true, tiff: true, exif: true });
    if (!data) return EMPTY_EXIF;
    const captured = data.DateTimeOriginal || data.CreateDate || data.ModifyDate || null;
    return {
      captured_at: captured ? new Date(captured).toISOString() : null,
      camera_make: data.Make ?? null,
      camera_model: data.Model ?? null,
      lens: data.LensModel ?? data.Lens ?? null,
      iso: data.ISO ? Number(data.ISO) : null,
      aperture: data.FNumber ? Number(data.FNumber) : null,
      shutter_speed: formatShutter(data.ExposureTime),
      focal_length: data.FocalLength ? Number(data.FocalLength) : null,
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
