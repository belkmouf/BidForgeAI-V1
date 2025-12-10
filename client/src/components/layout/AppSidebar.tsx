import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
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
import { useAuthStore, apiRequest } from "@/lib/auth";
import bidForgeLogo from "@assets/generated_images/bidforge_ai_premium_logo.png";

import _1764979718 from "@assets/1764979718.png";

interface CompanyBranding {
  companyName?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const [branding, setBranding] = useState<CompanyBranding | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      if (isAuthenticated) {
        try {
          const response = await apiRequest('/api/branding');
          if (response.ok) {
            const data = await response.json();
            setBranding(data.brandingProfile || null);
          }
        } catch (error) {
          console.error('Failed to fetch branding:', error);
        }
      }
    };
    fetchBranding();
  }, [isAuthenticated]);

  const displayName = branding?.companyName || user?.companyName || 'BidForge AI';
  const displayTagline = branding?.tagline || 'Intelligent Bidding';
  const displayLogo = branding?.logoUrl || _1764979718;
  const primaryColor = branding?.primaryColor || '#0d9488';
  
  const userName = user?.name || 'User';
  const userEmail = user?.email || '';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
          src={displayLogo} 
          alt={`${displayName} Logo`} 
          className="h-10 w-10 object-contain bg-white rounded p-1"
        />
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight text-white">{displayName}</h1>
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: primaryColor }}>{displayTagline}</p>
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
                !isActive && "text-white/80 hover:bg-charcoal-800 hover:text-white"
              )}
              style={isActive ? { 
                backgroundColor: `${primaryColor}20`, 
                color: primaryColor,
                borderLeft: `2px solid ${primaryColor}`,
                marginLeft: '-1px'
              } : undefined}
            >
              <item.icon 
                className="h-5 w-5 transition-colors"
                style={isActive ? { color: primaryColor } : undefined}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = primaryColor; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = ''; }}
              />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4">
        <Link 
          href="/"
          className="flex items-center gap-3 px-3 py-3 text-white/80 hover:bg-charcoal-800 transition-all duration-300 mb-4"
          data-testid="link-landing"
          onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
          onMouseLeave={(e) => e.currentTarget.style.color = ''}
        >
          <Home className="h-5 w-5 text-white/70" />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>
        
        <div className="border-t border-charcoal-700 pt-4">
          <div 
            className="flex items-center gap-3 px-3 py-2 hover:bg-charcoal-800 cursor-pointer transition-colors group"
            onClick={() => { clearAuth(); window.location.href = '/login'; }}
            data-testid="button-logout"
          >
            <div 
              className="h-9 w-9 flex items-center justify-center text-white font-display font-bold text-sm"
              style={{ background: `linear-gradient(to bottom right, ${primaryColor}, ${primaryColor}dd)` }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs truncate text-[#f0f1f2]">{userEmail}</p>
            </div>
            <LogOut className="h-4 w-4 text-white/70 group-hover:text-gold-500 transition-colors" />
          </div>
        </div>
      </div>
    </aside>
  );
}