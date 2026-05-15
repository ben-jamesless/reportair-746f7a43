import { AppShell } from "@/components/AppShell";

export default function ShareLinksPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Share Links" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-[#0F1724]">Share Links</h1>
        <p className="mt-2 text-sm text-[#7A7974]">
          A centralised list of all your share links is coming soon. Manage client access in one place.
        </p>
      </div>
    </AppShell>
  );
}
