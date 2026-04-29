import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Camera, FolderKanban, LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const NAV: NavItem[] = [
  { label: "Projects", to: "/projects", icon: FolderKanban },
];

export const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-16 lg:w-56 md:border-r md:bg-background">
        {/* Logo */}
        <Link to="/projects" className="flex h-14 items-center gap-2 border-b px-3 lg:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <Camera className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="hidden font-semibold tracking-tight lg:inline">Site Story</span>
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
        <div className="border-t p-2 lg:p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2 lg:px-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 flex-1 truncate text-left text-xs text-muted-foreground lg:inline">
                  {user?.email}
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
