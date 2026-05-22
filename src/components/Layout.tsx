import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/students", icon: Users, label: "Students" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center border-b px-4">
          <h1 className="text-lg font-semibold">PTC Manager</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={logout}
          >
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
