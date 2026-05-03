import { ReportAirMark } from "@/components/brand/ReportAirMark";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Camera, FolderKanban, LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { NotificationsBell } from "@/components/NotificationsBell";

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const NAV: NavItem[] = [
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "Profile", to: "/profile", icon: UserIcon },
];

export const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  // Load + realtime-subscribe to the current user's profile so avatar
  // changes propagate without a reload.
  useEffect(() => {
    if (!user?.id) { setAvatarUrl(null); setFullName(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setAvatarUrl(data?.avatar_url ?? null);
      setFullName(data?.full_name ?? null);
    })();
    const channel = supabase
      .channel(`sidebar-profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { full_name?: string | null; avatar_url?: string | null };
          if (typeof row.avatar_url !== "undefined") setAvatarUrl(row.avatar_url ?? null);
          if (typeof row.full_name !== "undefined") setFullName(row.full_name ?? null);
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  const initials = (() => {
    if (fullName && fullName.trim()) {
      const parts = fullName.trim().split(/\s+/);
      return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
    }
    return (user?.email ?? "?").slice(0, 2).toUpperCase();
  })();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-16 lg:w-56 md:border-r md:bg-background">
        {/* Logo */}
        <Link to="/projects" className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3 lg:px-4">
          <ReportAirMark variant="dark" className="h-7 w-7 shrink-0" />
          <span className="wordmark hidden text-sm text-white lg:inline">REPORTAIR</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-2 lg:p-3">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            const link = (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors lg:px-3",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User */}
        <div className="space-y-1 border-t p-2 lg:p-3">
          <NotificationsBell />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="h-auto w-full justify-start gap-3 px-2 py-2 text-muted-foreground hover:text-foreground lg:px-3"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
                <span className="hidden text-sm lg:inline">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="lg:hidden">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 lg:px-3">
                <Avatar className="h-7 w-7">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 flex-1 truncate text-left text-xs text-muted-foreground lg:inline">
                  {fullName || user?.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Signed in as</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
};
