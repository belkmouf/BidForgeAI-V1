import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  FileText,
  LogOut,
  Home,
  MessageSquare,
  BarChart3,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import bidForgeLogo from "@assets/generated_images/bidforge_ai_premium_logo.png";

import _1764979718 from "@assets/1764979718.png";

export function AppSidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/projects", icon: FolderKanban, label: "Projects" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/templates", icon: FileText, label: "Templates" },
    { href: "/whatsapp", icon: MessageSquare, label: "WhatsApp" },
    { href: "/admin", icon: Shield, label: "Admin" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="w-64 bg-charcoal-900 flex flex-col h-screen text-white fixed left-0 top-0 bottom-0 z-10" data-testid="app-sidebar">
      <div className="p-6 flex items-center gap-3 border-b border-charcoal-700">
        <img 
          src={_1764979718} 
          alt="BidForge AI Logo" 
          className="h-10 w-10 object-contain bg-white rounded p-1"
        />
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight text-white">BidForge AI</h1>
          <p className="text-[10px] text-gold-500 tracking-[0.15em] uppercase">Intelligent Bidding</p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <div className="px-3 mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0f1f2]">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              data-testid={`link-${item.label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-3 px-3 py-3 transition-all duration-300 group",
                isActive 
                  ? "bg-teal-700/20 text-teal-400 border-l-2 border-teal-500 -ml-px" 
                  : "text-white/80 hover:bg-charcoal-800 hover:text-white"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-colors", 
                isActive ? "text-teal-400" : "text-white/70 group-hover:text-teal-500"
              )} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4">
        <Link 
          href="/"
          className="flex items-center gap-3 px-3 py-3 text-white/80 hover:text-gold-400 hover:bg-charcoal-800 transition-all duration-300 mb-4"
          data-testid="link-landing"
        >
          <Home className="h-5 w-5 text-white/70" />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
        
        <div className="border-t border-charcoal-700 pt-4">
          <div className="flex items-center gap-3 px-3 py-2 hover:bg-charcoal-800 cursor-pointer transition-colors group">
            <div className="h-9 w-9 bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-white font-display font-bold text-sm">BM</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Belkacem Mouffok</p>
              <p className="text-xs truncate text-[#f0f1f2]">Belkacem@bidforge.com</p>
            </div>
            <LogOut className="h-4 w-4 text-white/70 group-hover:text-gold-500 transition-colors" />
          </div>
        </div>
      </div>
    </aside>
  );
}