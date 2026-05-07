import { NavLink, Outlet } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/admin/summary", label: "Summary" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/accounts", label: "Accounts" },
  { to: "/admin/projects", label: "Projects" },
];

const AdminLayout = () => {
  return (
    <AppShell crumbs={[{ label: "Admin" }]}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Platform admin</h1>
          <p className="text-sm text-muted-foreground">
            Internal dashboard. Visible only to platform administrators.
          </p>
        </header>
        <nav className="flex gap-1 border-b">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </AppShell>
  );
};

export default AdminLayout;
