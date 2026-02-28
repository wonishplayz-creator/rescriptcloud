import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Cloud, Globe, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Spaces" },
    { to: "/library", icon: Globe, label: "Library" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border/50 flex items-center px-4 gap-4 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-brand">
            <Cloud className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-gradient">ReScript</span>
        </Link>

        <nav className="flex items-center gap-1 ml-6">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
