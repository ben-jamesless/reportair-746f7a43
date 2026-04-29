import { useSignedUrl } from "@/hooks/useSignedUrl";
import { ImageIcon } from "lucide-react";

interface Props {
  path: string;
  alt: string;
  onClick?: () => void;
}

export const PhotoThumb = ({ path, alt, onClick }: Props) => {
  const url = useSignedUrl(path);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square w-full overflow-hidden rounded-md bg-muted ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
    </button>
  );
};
