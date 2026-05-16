/**
 * Single source of truth for HEIC/HEIF → JPEG conversion.
 * Uses `heic-to` (libheif-js) which handles modern iPhone HEVC reliably.
 * Dynamically imported to keep the decoder out of the initial JS bundle.
 */

export const isHeicFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
};

const renameToJpg = (fileName: string) =>
  fileName.replace(/\.(heic|heif)$/i, "") + ".jpg";

export type ConvertResult = { jpegBlob: Blob; newName: string };

/**
 * Convert a HEIC/HEIF blob or File into a JPEG blob.
 * Accepts either a Blob (e.g. fetched from storage) or a File (upload path).
 */
export const convertHeicToJpeg = async (
  input: File | Blob,
  opts?: { quality?: number; fileName?: string },
): Promise<ConvertResult> => {
  const quality = opts?.quality ?? 0.9;
  const fileName =
    opts?.fileName ?? (input instanceof File ? input.name : "image.heic");
  const file =
    input instanceof File
      ? input
      : new File([input], fileName, { type: input.type || "image/heic" });

  const { heicTo } = await import("heic-to");
  const jpegBlob = (await heicTo({
    blob: file,
    type: "image/jpeg",
    quality,
  })) as Blob;

  return { jpegBlob, newName: renameToJpg(fileName) };
};

/** Convenience wrapper that returns a File ready to re-upload. */
export const convertHeicFileToJpegFile = async (
  file: File,
  quality = 0.9,
): Promise<File> => {
  const { jpegBlob, newName } = await convertHeicToJpeg(file, { quality });
  return new File([jpegBlob], newName, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
};
