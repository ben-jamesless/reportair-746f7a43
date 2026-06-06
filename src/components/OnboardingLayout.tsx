import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  children: ReactNode;
  step?: 1 | 2 | 3;
  totalSteps?: number;
}

export function OnboardingLayout({ children, step, totalSteps = 3 }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen flex bg-card">
      {/* Left panel — solid ink ground */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "#0F1417" }}
      >
        <div className="relative z-10">
          <Link to="/" aria-label="BuildFolder home" className="flex items-center gap-2">
            <img src="/brand-mark.svg" alt="" className="h-8 w-8" />
            <span className="font-display font-black tracking-tight text-base text-white">BuildFolder</span>
          </Link>
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight text-[#D94F2A]">
            Built for the build.
          </h1>
          <p className="mt-4 text-base text-[color:var(--bs-rule)]">
            Site to report. 10 minutes.
          </p>
          <p className="mt-6 text-sm text-[color:var(--bs-rule)] max-w-md">
            The daily reporting tool for event-build crews — activations, exhibitions, conferences.
          </p>
        </div>

        <div className="relative z-10 bg-[#D94F2A]/10 border border-[#D94F2A]/25 rounded-2xl p-5 backdrop-blur-sm">
          <p className="text-white/80 text-sm italic leading-relaxed mb-3">
            "BuildFolder cut our post-event reporting time by 60%. Our clients love the live progress links."
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
