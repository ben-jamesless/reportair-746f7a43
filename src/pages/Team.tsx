import { AppShell } from "@/components/AppShell";

export default function TeamPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Team" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Team management is coming soon. Invite members, assign roles, and track activity.
        </p>
      </div>
    </AppShell>
  );
}
