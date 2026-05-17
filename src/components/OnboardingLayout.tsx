import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BuildSlidesLockup } from "@/components/brand/BuildSlidesMark";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  children: ReactNode;
  step?: 1 | 2 | 3;
  totalSteps?: number;
}

export function OnboardingLayout({ children, step, totalSteps = 3 }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen flex bg-card">
      {/* Left panel — dark brand */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 60% 80%, #0D2A6E 0%, #0A0F1E 65%)" }}
      >
        <div className="relative z-10">
          <Link to="/" aria-label="Go to home">
            <BuildSlidesLockup variant="dark" markClassName="h-8 w-8" textClassName="text-lg text-white" />
          </Link>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white leading-snug mb-4">
            Professional event reports,
            <br />
            made in <span className="text-[#D94F2A]">10 minutes.</span>
          </h1>
          <p className="text-white/60 leading-relaxed max-w-sm text-base">
            Capture progress, keep clients informed, and deliver polished reports — all in one place.
          </p>
        </div>

        <div className="relative z-10 bg-[#D94F2A]/10 border border-[#D94F2A]/25 rounded-2xl p-5 backdrop-blur-sm">
          <p className="text-white/80 text-sm italic leading-relaxed mb-3">
            "BuildSlides cut our post-event reporting time by 60%. Our clients love the live progress links."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D94F2A]/30 flex items-center justify-center text-white text-xs font-bold">
              SL
            </div>
            <div>
              <p className="text-white text-xs font-medium">Sarah Lennon</p>
              <p className="text-white/50 text-xs">Event Director, Apex Events Group</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — white form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 bg-card">
        <div className="w-full max-w-md">
          {step && (
            <div className="flex items-center gap-2 mb-8">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i + 1 === step ? "bg-[#D94F2A] w-8" : i + 1 < step ? "bg-[#D94F2A]/40 w-4" : "bg-[#D4D1CA] w-4"
                  )}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-2">
                Step {step} of {totalSteps}
              </span>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
