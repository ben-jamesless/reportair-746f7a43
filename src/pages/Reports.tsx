import { AppShell } from "@/components/AppShell";

export default function ReportsPage() {
  return (
    <AppShell crumbs={[{ label: "Projects", to: "/projects" }, { label: "Templates" }]}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Templates</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Templates are coming soon. You'll be able to generate company-wide templates to be used on different projects. It will require a Studio License.
        </p>
      </div>
    </AppShell>
  );
}
