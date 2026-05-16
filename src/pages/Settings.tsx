import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Settings" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Account and workspace settings are coming soon. Customise your experience here.
        </p>
      </div>
    </AppShell>
  );
}
