import { Link } from "react-router-dom";

interface Props {
  /** Team's display name for the non-owner copy. */
  teamName?: string | null;
  /** Billing owner's display name (used in the non-owner variant). */
  ownerName?: string | null;
  /** True when the current viewer is the team's billing owner. */
  isBillingOwner: boolean;
}

/**
 * Thin, full-width system banner shown when a project's team has hit its
 * plan's build-day cap. Sits directly under the project title row, above
 * the tab bar. Single line, Paper background with hairline top/bottom
 * borders. No boxed card, no icon, no button — CTA is inline text-link
 * styling in Accent orange for the billing owner only.
 */
export function FreePlanUploadGate({
  teamName,
  ownerName,
  isBillingOwner,
}: Props) {
  const teamLabel = teamName?.trim() || "Your team";
  const ownerLabel = ownerName?.trim() || "your team owner";

  return (
    <div
      role="status"
      className="w-full border-y border-[#E3DFD4] bg-[#FAF8F2] px-4 py-2 text-sm text-[#0F1417]"
    >
      {isBillingOwner ? (
        <span>
          Your team's plan is at its build-day limit.{" "}
          <Link
            to="/plan"
            className="font-medium text-[#D94F2A] underline underline-offset-4 hover:text-[#B53D1F]"
          >
            Upgrade →
          </Link>
        </span>
      ) : (
        <span className="text-muted-foreground">
          {teamLabel}'s plan is at its build-day limit. Contact {ownerLabel} to upgrade.
        </span>
      )}
    </div>
  );
}
