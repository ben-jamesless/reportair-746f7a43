import { AppShell } from "@/components/AppShell";

export default function TeamPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Team" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-[#0F1724]">Team</h1>
        <p className="mt-2 text-sm text-[#7A7974]">
          Team management is coming soon. Invite members, assign roles, and track activity.
        </p>
      </div>
    </AppShell>
  );
}
