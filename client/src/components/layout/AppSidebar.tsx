import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  HardHat,
  FileText,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/projects", icon: FolderKanban, label: "Projects" },
    { href: "/templates", icon: FileText, label: "Templates" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen text-sidebar-foreground fixed left-0 top-0 bottom-0 z-10">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
        <div className="bg-primary text-primary-foreground p-2 rounded-md">
          <HardHat className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight">BidForge AI</h1>
          <p className="text-xs text-sidebar-foreground/60">Construction Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <div className="px-2 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/50 cursor-pointer transition-colors">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">John Doe</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">john@bidforge.com</p>
          </div>
          <LogOut className="h-4 w-4 text-sidebar-foreground/50" />
        </div>
      </div>
    </aside>
  );
}