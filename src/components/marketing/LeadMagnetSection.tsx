import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { event as gaEvent } from "@/lib/analytics";
import { BRAND, body, display } from "@/components/marketing/brand-tokens";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(254),
});

export function LeadMagnetSection() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("lead-magnet-signup", {
        body: { email: parsed.data.email, source: "homepage-section", pdfSlug: "default" },
      });
      if (fnError) throw fnError;
      gaEvent("lead_magnet_submit", { source: "homepage-section" });
      setSuccess(true);
      setEmail("");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="lead-magnet"
      className="py-[34px] sm:py-[41px] md:py-[82px] bg-black"
      style={{ ...body }}
    >
      <div className="mx-auto max-w-[1000px] px-5 sm:px-8">
        <div
          className="relative overflow-hidden rounded-3xl p-8 sm:p-12 md:p-16 bg-black"
          style={{
            border: `1px solid ${BRAND.ink}14`,
            boxShadow: "0 24px 60px rgba(15,20,23,0.08)",
          }}
        >
          <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <span
                className="mb-3 inline-block text-[11px] font-extrabold uppercase tracking-[0.14em]"
                style={{ color: "#D94F2A" }}
              >
                Free guide
              </span>
              <h2
                className="text-2xl font-extrabold sm:text-3xl md:text-4xl text-white"
                style={{ ...display, lineHeight: 1.15 }}
              >
                Get the BuildFolder Benefits guide
              </h2>
              <p
                className="mt-3 max-w-xl text-sm sm:text-base"
                style={{ color: `${BRAND.ink}B3` }}
              >
                A free PDF on how site teams cut hours off weekly reporting — delivered to your inbox.
              </p>
            </div>

            <div className="w-full md:w-[360px]">
              {success ? (
                <div
                  className="rounded-2xl p-5 text-center"
                  style={{ background: "#1a1a1a", border: `1px solid ${BRAND.ink}33` }}
                >
                  <h3 className="text-base font-bold text-white">
                    Check your inbox
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: `${BRAND.ink}99` }}>
                    Your guide is on its way. If it doesn't arrive in a minute, check spam.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-12 w-full rounded-full border px-5 text-sm outline-none"
                    style={{
                      background: "#FFFFFF",
                      borderColor: `${BRAND.ink}26`,
                      color: BRAND.ink,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 rounded-full px-6 text-sm font-semibold text-white transition-colors disabled:opacity-60"
                    style={{ background: BRAND.sky }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = BRAND.deepSky)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = BRAND.sky)}
                  >
                    {loading ? "Sending…" : "Send me the PDF"}
                  </button>
                  {error && (
                    <p className="text-xs" style={{ color: "#D94F2A" }}>
                      {error}
                    </p>
                  )}
                  <p className="text-[11px]" style={{ color: `${BRAND.ink}80` }}>
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LeadMagnetSection;
