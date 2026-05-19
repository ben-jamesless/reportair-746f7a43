import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Lightweight markdown-ish renderer used in PDF + share + report views.
 *  Supports: # heading, - bullet, **bold**, *italic*. */
const renderInline = (text: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  // Bold first, then italic.
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={`b${key++}`}>{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<em key={`i${key++}`}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

export const RichNotes = ({ value, className }: { value: string | null | undefined; className?: string }) => {
  if (!value || !value.trim()) return null;
  // Promote inline " * x" / " - x" runs onto their own lines so bullets render
  // properly even when the source text was flattened during paste/sync.
  const normalised = value.replace(/([^\n])\s+(?=[*\-]\s+\S)/g, "$1\n");
  const lines = normalised.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-0.5 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      return;
    }
    if (line.startsWith("# ")) {
      flushBullets();
      blocks.push(
        <h4 key={`h-${idx}`} className="text-sm font-semibold">
          {renderInline(line.slice(2))}
        </h4>,
      );
      return;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      bullets.push(line.slice(2));
      return;
    }
    flushBullets();
    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  });
  flushBullets();
  return <div className={cn("space-y-2 text-sm", className)}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
};
