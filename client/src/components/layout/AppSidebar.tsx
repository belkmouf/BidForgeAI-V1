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
  Shield,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileSearch
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, apiRequest } from "@/lib/auth";
import bidForgeLogo from "@assets/Gemini_Generated_Image_mb26x1mb26x1mb26_1765805920806.png";
import { create } from 'zustand';

interface SidebarStore {
  isCollapsed: boolean;
  isAutoHide: boolean;
  isPinned: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleAutoHide: () => void;
  togglePinned: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: true,
  isAutoHide: true,
  isPinned: false,
  toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  toggleAutoHide: () => set((state) => ({ isAutoHide: !state.isAutoHide, isCollapsed: !state.isAutoHide })),
  togglePinned: () => set((state) => ({ isPinned: !state.isPinned, isCollapsed: state.isPinned })),
}));

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
  const { isCollapsed, isAutoHide, isPinned, toggle, setCollapsed, togglePinned } = useSidebarStore();

  const handleMouseEnter = () => {
    if (isAutoHide && !isPinned) {
      setCollapsed(false);
    }
  };

  const handleMouseLeave = () => {
    if (isAutoHide && !isPinned) {
      setCollapsed(true);
    }
  };

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
  const displayLogo = branding?.logoUrl || bidForgeLogo;
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

  // Extract project ID from URL if on a project page
  const projectMatch = location.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectMatch ? projectMatch[1] : null;
  const isProjectPage = currentProjectId && currentProjectId !== 'new';

  // Project-specific navigation items
  const projectNavItems = currentProjectId ? [
    { href: `/projects/${currentProjectId}/documents`, icon: Upload, label: "Upload Files" },
    { href: `/projects/${currentProjectId}/summary`, icon: FileSearch, label: "Summary Review" },
    { href: `/projects/${currentProjectId}/analysis`, icon: ShieldCheck, label: "Risk Assessment" },
    { href: `/projects/${currentProjectId}/conflicts`, icon: AlertTriangle, label: "Review Issues" },
    { href: `/projects/${currentProjectId}`, icon: Sparkles, label: "Bid Generation", exact: true },
  ] : [];

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen text-white fixed left-0 top-0 bottom-0 z-10 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      style={{ backgroundColor: primaryColor }}
      data-testid="app-sidebar"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={cn(
        "flex items-center border-b border-white/20 relative",
        isCollapsed ? "p-3 justify-center" : "p-6 gap-3"
      )}>
        <img 
          src={displayLogo} 
          alt={`${displayName} Logo`} 
          className="h-10 w-10 object-cover bg-white rounded"
        />
        {!isCollapsed && (
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight text-white">{displayName}</h1>
            <p className="text-[10px] tracking-[0.15em] uppercase text-white/70">{displayTagline}</p>
          </div>
        )}
        <button
          onClick={togglePinned}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors"
          data-testid="button-toggle-sidebar"
          title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
        >
          {isPinned ? (
            <PinOff className="h-4 w-4 text-gray-600" />
          ) : (
            <Pin className="h-4 w-4 text-gray-600" />
          )}
        </button>
      </div>
      <nav className={cn("flex-1 space-y-1 overflow-y-auto", isCollapsed ? "p-2" : "p-4")}>
        {!isCollapsed && (
          <div className="px-3 mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0f1f2]">
            Navigation
          </div>
        )}
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              data-testid={`link-${item.label.toLowerCase()}`}
              className={cn(
                "flex items-center transition-all duration-300 group rounded-md",
                isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-3",
                !isActive && "text-white/80 hover:bg-white/10 hover:text-white"
              )}
              style={isActive ? { 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                borderLeft: isCollapsed ? 'none' : '2px solid white',
                marginLeft: isCollapsed ? '0' : '-1px'
              } : undefined}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon 
                className="h-5 w-5 transition-colors"
                style={isActive ? { color: 'white' } : undefined}
              />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}

        {/* Project-specific navigation */}
        {isProjectPage && (
          <>
            {!isCollapsed && (
              <div className="px-3 mt-6 mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0f1f2]">
                Project Steps
              </div>
            )}
            {isCollapsed && <div className="border-t border-white/20 my-2" />}
            {projectNavItems.map((item) => {
              const isExact = 'exact' in item && item.exact;
              const isActive = isExact 
                ? location === item.href 
                : location === item.href || location.startsWith(item.href + '/');
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  data-testid={`link-project-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cn(
                    "flex items-center transition-all duration-300 group rounded-md",
                    isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                    !isActive && "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                  style={isActive ? { 
                    backgroundColor: 'rgba(255,255,255,0.2)', 
                    color: 'white',
                    borderLeft: isCollapsed ? 'none' : '2px solid white',
                    marginLeft: isCollapsed ? '0' : '-1px'
                  } : undefined}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon 
                    className="h-4 w-4 transition-colors"
                    style={isActive ? { color: 'white' } : undefined}
                  />
                  {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>
      <div className={cn("p-2", isCollapsed ? "p-2" : "p-4")}>
        <Link 
          href="/"
          className={cn(
            "flex items-center text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300 mb-4 rounded-md",
            isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-3"
          )}
          data-testid="link-landing"
          title={isCollapsed ? "Back to Home" : undefined}
        >
          <Home className="h-5 w-5 text-white/70" />
          {!isCollapsed && <span className="text-sm font-medium">Back to Home</span>}
        </Link>
        
        <div className="border-t border-white/20 pt-4">
          <div 
            className={cn(
              "flex items-center hover:bg-white/10 cursor-pointer transition-colors group rounded-md",
              isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2"
            )}
            onClick={() => { clearAuth(); window.location.href = '/login'; }}
            data-testid="button-logout"
            title={isCollapsed ? "Logout" : undefined}
          >
            <div 
              className="h-9 w-9 flex items-center justify-center text-white font-display font-bold text-sm bg-white/20 rounded flex-shrink-0"
            >
              {userInitials}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                  <p className="text-xs truncate text-[#f0f1f2]">{userEmail}</p>
                </div>
                <LogOut className="h-4 w-4 text-white/70 group-hover:text-gold-500 transition-colors" />
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}