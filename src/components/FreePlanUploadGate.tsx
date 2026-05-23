import { Link } from "react-router-dom";
import { Camera, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  /** If available, shows a "View your live report" link. */
  shareToken?: string | null;
}

/**
 * Soft barrier shown in place of the photo uploader once a Free-plan user has
 * exhausted their 3 update days. Viewing, editing notes, and the share link
 * all remain available — only new uploads are gated.
 */
export function FreePlanUploadGate({ projectId: _projectId, shareToken }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border p-8 text-center"
      style={{
        background: "#FBFBF9",
        borderColor: "#D4D1CA",
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "#EBF0FF" }}
      >
        <Camera className="h-7 w-7" style={{ color: "#1A6EFF" }} />
      </div>

      <h3
        className="mb-2 text-xl font-bold"
        style={{ color: "#0F1724", letterSpacing: "-0.02em" }}
      >
        You've reported 3 build days.
      </h3>

      <p className="mb-1 text-sm" style={{ color: "#7A7974", lineHeight: 1.6 }}>
        Your report is live and your client can view everything.
      </p>
      <p className="mb-7 text-sm" style={{ color: "#7A7974", lineHeight: 1.6 }}>
        Upgrade to Solo to keep adding updates — or keep sharing what you've built.
      </p>

      <div className="flex w-full flex-col gap-3">
        <Link to="/plan" className="w-full">
          <Button
            className="w-full gap-2 rounded-full font-semibold"
            style={{ background: "#1A6EFF", color: "#fff", height: 44 }}
          >
            Upgrade to Solo — HK$128/mo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>

        {shareToken && (
          <a
            href={`/s/${shareToken}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-sm font-medium"
            style={{ color: "#1A6EFF" }}
          >
            View your live report
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <p className="mt-5 text-xs" style={{ color: "#BAB9B4" }}>
        Existing photos, status, and daily notes are always editable.
        Your share link stays live forever.
      </p>
    </div>
  );
}
