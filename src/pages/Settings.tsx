import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Settings" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-[#0F1724]">Settings</h1>
        <p className="mt-2 text-sm text-[#7A7974]">
          Account and workspace settings are coming soon. Customise your experience here.
        </p>
      </div>
    </AppShell>
  );
}
