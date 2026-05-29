import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Moon,
  Sun,
  Download,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSetting, setSetting } from "@/lib/queries";
import {
  checkForUpdate,
  downloadUpdate,
  installAndRelaunch,
} from "@/lib/updater";
import type { UpdateStatus } from "@/lib/updater";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/students", icon: Users, label: "Students" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const { logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
  });
  const updateRef =
    useRef<Awaited<ReturnType<typeof checkForUpdate>>["update"]>(undefined);

  useEffect(() => {
    getSetting("dark_mode").then((dm) => {
      const isDark = dm === "true";
      setDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    });
  }, []);

  useEffect(() => {
    checkForUpdate().then(async (result) => {
      if (result.available && result.update) {
        updateRef.current = result.update;
        setUpdateStatus({ state: "downloading", progress: 0 });
        try {
          await downloadUpdate(result.update, (progress) => {
            setUpdateStatus({ state: "downloading", progress });
          });
          setUpdateStatus({ state: "ready" });
        } catch (err) {
          setUpdateStatus({ state: "error", message: String(err) });
        }
      }
    });
  }, []);

  const handleRestart = async () => {
    if (updateRef.current) {
      await installAndRelaunch(updateRef.current);
    }
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    setSetting("dark_mode", String(next));
  };

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h1 className="text-lg font-semibold">PTC Manager</h1>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={toggleDarkMode}
          >
            {darkMode ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
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
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {updateStatus.state === "ready" && (
          <div className="p-2">
            <Button
              onClick={handleRestart}
              className="w-full justify-start gap-3"
            >
              <Download className="size-4" />
              Restart to Update
            </Button>
          </div>
        )}
        {updateStatus.state === "downloading" && updateStatus.progress > 0 && (
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" />
              Updating... {updateStatus.progress}%
            </div>
          </div>
        )}
        <div className="border-t p-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full justify-start gap-3"
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to logout? You will need to sign in
                  again to access your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={logout}>Logout</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
