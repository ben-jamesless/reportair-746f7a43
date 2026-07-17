import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  shareToken?: string | null;
  /** Team's display name for the plan-owner copy. */
  teamName?: string | null;
  /** Billing owner's display name (used in the non-owner variant). */
  ownerName?: string | null;
  /** True when the current viewer is the team's billing owner. */
  isBillingOwner: boolean;
}

/**
 * Shown in place of the uploader once a project's team has hit its
 * Free-plan build-day cap. Two variants:
 *  - Billing owner: full upgrade CTA.
 *  - Anyone else:   informational notice, no CTA they can't act on.
 *
 * Styled to the Ink / Paper / one-accent-orange system: square card,
 * hairline border, no shadow, no icon, Accent orange CTA only.
 */
export function FreePlanUploadGate({
  projectId: _projectId,
  shareToken,
  teamName,
  ownerName,
  isBillingOwner,
}: Props) {
  const teamLabel = teamName?.trim() || "Your team";
  const ownerLabel = ownerName?.trim() || "your team owner";

  return (
    <div
      className="mx-auto max-w-[440px] border border-[#E3DFD4] bg-[#FAF8F2] p-8 text-center"
    >
      <p
        className="mb-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
        style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
      >
        Build-day limit reached
      </p>

      {isBillingOwner ? (
        <>
          <h3 className="mb-3 text-xl font-semibold tracking-tight text-[#0F1417]">
            You've reported 3 build days.
          </h3>
          <p className="mb-1 text-sm text-muted-foreground leading-relaxed">
            Your report is live and your client can view everything.
          </p>
          <p className="mb-7 text-sm text-muted-foreground leading-relaxed">
            Upgrade to Solo to keep adding updates — or keep sharing what you've built.
          </p>

          <div className="flex w-full flex-col gap-3">
            <Link to="/plan" className="w-full">
              <Button
                className="w-full gap-2 rounded-none bg-[#D94F2A] font-semibold text-white hover:bg-[#B53D1F]"
                style={{ height: 44 }}
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
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#0F1417] underline underline-offset-4 hover:text-[#D94F2A]"
              >
                View your live report
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Existing photos, status, and daily notes are always editable.
            Your share link stays live forever.
          </p>
        </>
      ) : (
        <>
          <h3 className="mb-3 text-xl font-semibold tracking-tight text-[#0F1417]">
            {teamLabel}'s plan is at its build-day limit.
          </h3>
          <p className="mb-1 text-sm text-muted-foreground leading-relaxed">
            New build days can't be started until {ownerLabel} upgrades the plan.
          </p>
          <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
            Everything already in the project stays fully editable — photos, notes, and status can still be updated.
          </p>

          {shareToken && (
            <a
              href={`/s/${shareToken}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#0F1417] underline underline-offset-4 hover:text-[#D94F2A]"
            >
              View the live report
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
