import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  CalendarDays,
  Crown,
  Download,
  ImagePlus,
  MapPin,
  MessageSquare,
  MoreVertical,
  Pencil,
  Share2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PhotoUploader } from "@/components/PhotoUploader";
import {
  PROJECT_STATUSES,
  projectStatusMeta,
  type ProjectStatus,
} from "@/lib/projectStatus";
import { cn } from "@/lib/utils";
import type { Area, Project, ProjectView } from "@/lib/projectDetailTypes";

// ---- ShareButton --------------------------------------------------------

function ShareButton({
  canUseShareLink,
}: {
  canUseShareLink: boolean;
}) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (canUseShareLink) {
    return (
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("open-share-settings"))
        }
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-sm text-foreground font-medium hover:bg-muted/40 transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share link
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowUpgrade((v) => !v)}
        title="Upgrade to Pro to share live event links"
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-sm text-muted-foreground font-medium hover:bg-muted/40 transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share link
        <Crown className="w-3.5 h-3.5 text-[#D94F2A]" />
      </button>
      {showUpgrade && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-border bg-card shadow-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-[#D94F2A]" />
            <span className="text-sm font-semibold text-foreground">Pro feature</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Share live event links with clients. Available on Pro and Studio plans.
          </p>
          <Link
            to="/billing"
            className="block w-full text-center px-3 py-1.5 rounded-lg bg-[#D94F2A] text-white text-xs font-medium hover:bg-[#D94F2A]/90"
          >
            Upgrade to Pro →
          </Link>
          <button
            onClick={() => setShowUpgrade(false)}
            className="block w-full text-center text-xs text-muted-foreground mt-2 hover:text-foreground"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

// ---- TabBar -------------------------------------------------------------

function TabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: string[];
  activeTab: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex items-center gap-0 -mb-px">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "px-4 pb-3 pt-2 text-sm transition-colors",
            activeTab === tab
              ? "border-b-2 border-[#D94F2A] text-[#D94F2A] font-semibold"
              : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ---- ProjectHeader ------------------------------------------------------

export interface ProjectHeaderProps {
  project: Project;
  canEdit: boolean;
  isOwner: boolean;
  canUseShareLink: boolean;
  photoCount: number;
  areas: Area[];
  uploadAlbumId: string | null;
  uploadAreaId: string | null;
  activeTab: "photos" | "activity" | "details";
  viewOverride: ProjectView | null;
  onSetActiveTab: (t: "photos" | "activity" | "details") => void;
  onSetViewOverride: (v: ProjectView | null) => void;
  onSaveProjectStatus: (s: ProjectStatus) => void;
  onArchive: () => void;
  onRestore: () => void;
  onOpenExport: () => void;
  onOpenFeedback: () => void;
  onOpenSettings: () => void;
  onOpenShareSettings: () => void;
  onUploaded: () => void;
}

/**
 * Sticky project page header: title, status pill, metadata row, action
 * buttons (feedback / share / export / upload / kebab menu), tab bar,
 * and the archived-event banner.
 *
 * Owns no data of its own — all state and mutations come from props.
 * Pure refactor: markup is byte-for-byte the same as the inline block
 * previously living in src/pages/ProjectDetail.tsx.
 */
export function ProjectHeader({
  project,
  canEdit,
  isOwner,
  canUseShareLink,
  photoCount,
  areas,
  uploadAlbumId,
  uploadAreaId,
  activeTab,
  viewOverride,
  onSetActiveTab,
  onSetViewOverride,
  onSaveProjectStatus,
  onArchive,
  onRestore,
  onOpenExport,
  onOpenFeedback,
  onOpenSettings,
  onOpenShareSettings,
  onUploaded,
}: ProjectHeaderProps) {
  return (
    <>
      {/* ── Sticky page header ── */}
      <div className="sticky top-10 z-30 bg-card border-b border-border -mx-4 sm:-mx-6 lg:-mx-8 px-6 pt-5 pb-0">
        {/* Breadcrumb moved into AppShell for consistency across pages */}

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            {project.event_type && (
              <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1 my-[5px]">
                {project.event_type}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap my-[5px]">
              <h1 className="text-2xl font-bold text-foreground leading-tight my-[5px]">{project.name}</h1>
              {canEdit ? (
                <Select
                  value={project.overall_status ?? "no_status"}
                  onValueChange={(v) => onSaveProjectStatus(v as ProjectStatus)}
                >
                  <SelectTrigger className={cn(
                    "h-6 px-2.5 rounded-full text-xs font-semibold border w-auto gap-1.5",
                    projectStatusMeta(project.overall_status).pillClass
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className={cn("inline-block size-2 rounded-full", s.dotClass)} />
                          <span>{s.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-semibold", projectStatusMeta(project.overall_status).pillClass)}>
                  {projectStatusMeta(project.overall_status).label}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground gap-[10px] hidden sm:flex items-center justify-start my-[5px] w-full">
              {project.event_location && (
                <>
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{project.event_location}</span>
                </>
              )}
              {project.event_date && (
                <>
                  {project.event_location && <span className="text-[#D4D1CA]">·</span>}
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(project.event_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                </>
              )}
              {project.client_name && (
                <>
                  <span className="text-[#D4D1CA]">·</span>
                  <span>{project.client_name}</span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={onOpenFeedback}
              aria-label="Feedback"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-sm text-foreground font-medium hover:bg-muted/40 transition-colors"
            >
              <MessageSquare width={16} height={16} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <span className="hidden sm:inline">Feedback</span>
            </button>
            <div className="hidden sm:block">
              <ShareButton canUseShareLink={canUseShareLink} />
            </div>
            <button
              onClick={onOpenExport}
              disabled={photoCount === 0}
              className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-sm text-foreground font-medium hover:bg-muted/40 transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
            {canEdit && (
              <ErrorBoundary label="uploader-header">
                <PhotoUploader
                  projectId={project.id}
                  albumId={uploadAlbumId}
                  areaId={uploadAreaId}
                  areas={areas}
                  onUploaded={onUploaded}
                  trigger={
                    <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#D94F2A] text-white text-sm font-medium hover:bg-[#D94F2A]/90 transition-colors">
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Upload photos</span>
                      <span className="sm:hidden">Upload</span>
                    </button>
                  }
                />
              </ErrorBoundary>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/40">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Mobile-only quick actions (hidden ≥sm where buttons are visible) */}
                <DropdownMenuItem className="sm:hidden" onSelect={onOpenFeedback}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Feedback
                </DropdownMenuItem>
                <DropdownMenuItem className="sm:hidden" onSelect={() => {
                  if (canUseShareLink) window.dispatchEvent(new CustomEvent("open-share-settings"));
                  else toast.message("Share links are a Pro feature");
                }}>
                  <Share2 className="mr-2 h-4 w-4" /> Share link
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="sm:hidden"
                  disabled={photoCount === 0}
                  onSelect={onOpenExport}
                >
                  <Download className="mr-2 h-4 w-4" /> Export PDF
                </DropdownMenuItem>
                {canEdit && <DropdownMenuSeparator className="sm:hidden" />}
                {canEdit && (
                  <>
                    <DropdownMenuItem onSelect={onOpenSettings}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit event details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onOpenShareSettings}>
                      <Share2 className="mr-2 h-4 w-4" /> Share links
                    </DropdownMenuItem>
                  </>
                )}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={onArchive}
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive event
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Horizontal tab bar */}
        <TabBar
          tabs={["Updates", "Gallery", "Activity", "Settings"]}
          activeTab={
            activeTab === "activity" ? "Activity"
            : activeTab === "details" ? "Settings"
            : viewOverride === "gallery" ? "Gallery"
            : "Updates"
          }
          onChange={(t) => {
            if (t === "Updates") { onSetActiveTab("photos"); onSetViewOverride("report"); }
            else if (t === "Activity") onSetActiveTab("activity");
            else if (t === "Gallery") { onSetActiveTab("photos"); onSetViewOverride("gallery"); }
            else if (t === "Settings") onSetActiveTab("details");
          }}
        />
      </div>

      {project.archived_at && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              This event was archived on{" "}
              <span className="font-medium">
                {new Date(project.archived_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              .
            </span>
          </div>
          {isOwner && (
            <Button size="sm" variant="outline" onClick={onRestore}>
              Restore
            </Button>
          )}
        </div>
      )}
    </>
  );
}
