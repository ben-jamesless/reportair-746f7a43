import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/hooks/usePlan";

export function PaymentFailedBanner() {
  const { subscriptionStatus, paymentFailedAt } = usePlan();
  const [loading, setLoading] = useState(false);

  const showBanner =
    subscriptionStatus === "past_due" ||
    subscriptionStatus === "unpaid" ||
    !!paymentFailedAt;

  if (!showBanner) return null;

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal", {
        body: { return_url: `${window.location.origin}/billing` },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
      window.location.href = "/billing";
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full sticky top-0 z-50 shrink-0 border-b border-[#0F1417]/10 bg-[#D94F2A] text-white">
      <div className="flex h-10 items-center justify-between px-4">
        <div className="hidden w-40 md:block" />
        <div className="flex flex-1 items-center justify-center gap-2 text-sm">
          <span
            className="uppercase tracking-wider text-[11px]"
            style={{ fontFamily: "'Geist Mono', ui-monospace, monospace" }}
          >
            <span style={{ fontWeight: 500 }}>Payment failed.</span>{" "}
            Update your card to keep access.
          </span>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={openPortal}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-white/70 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? "Opening…" : "Update card →"}
          </button>
        </div>
      </div>
    </div>
  );
}
