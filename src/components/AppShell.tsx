import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "./AppSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Camera, ChevronRight, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import React from "react";

export type Crumb = { label: string; to?: string };

interface Props {
  crumbs?: Crumb[];
  children: React.ReactNode;
  /** When true, content uses fluid full-width with side padding instead of the narrow .container */
  fluid?: boolean;
}

export const AppShell = ({ crumbs, children, fluid = true }: Props) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppSidebar />

      {/* Mobile top bar (sidebar hidden on mobile) */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/projects" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
              <Camera className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Site Story</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary text-sm">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Signed in as</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="md:pl-16 lg:pl-56">
        {/* Breadcrumbs */}
        {crumbs && crumbs.length > 0 && (
          <div className="border-b bg-background/60 backdrop-blur">
            <div className={cn(fluid ? "px-4 sm:px-6 lg:px-8" : "container", "py-3")}>
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
