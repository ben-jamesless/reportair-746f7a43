import { AppShell } from "@/components/AppShell";

export default function ReportsPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Reports" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-[#0F1724]">Reports</h1>
        <p className="mt-2 text-sm text-[#7A7974]">
          Reports are coming soon. You'll be able to generate and download comprehensive event summaries here.
        </p>
      </div>
    </AppShell>
  );
}
