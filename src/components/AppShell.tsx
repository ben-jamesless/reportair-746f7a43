import { ReportAirLockup } from "@/components/brand/ReportAirMark";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ChevronRight, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import React, { useState } from "react";

export type Crumb = { label: string; to?: string };

interface Props {
  crumbs?: Crumb[];
  children: React.ReactNode;
  /** When true, content uses fluid full-width with side padding instead of the narrow .container */
  fluid?: boolean;
}

export const AppShell = ({ crumbs, children, fluid = true }: Props) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ra:sidebar-collapsed") === "1";
  });
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem("ra:sidebar-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      {/* Mobile top bar (sidebar hidden on mobile) */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <AppSidebar mobile onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/projects" className="flex items-center">
            <ReportAirLockup variant="light" />
          </Link>
          <div className="w-9" />
        </div>
      </header>

      <div className="md:pl-16 lg:pl-56">
        {/* Breadcrumbs — height matches the sidebar logo bar (h-14) so the two top edges align. */}
        {crumbs && crumbs.length > 0 && (
          <div className="border-b bg-background/60 backdrop-blur">
            <div className={cn(fluid ? "px-4 sm:px-6 lg:px-8" : "container", "flex h-14 items-center")}>
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                      <li key={i} className="flex items-center gap-1.5">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                        {c.to && !last ? (
                          <Link to={c.to} className="transition-colors hover:text-foreground">
                            {c.label}
                          </Link>
                        ) : (
                          <span className={cn(last && "font-medium text-foreground")}>{c.label}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>
          </div>
        )}

        <main className={cn(fluid ? "px-4 sm:px-6 lg:px-8" : "container", "py-6 sm:py-8")}>{children}</main>
      </div>
    </div>
  );
};
