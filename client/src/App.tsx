import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import ProjectWorkspace from "@/pages/ProjectWorkspace";
import ProjectAnalysis from "@/pages/ProjectAnalysis";
import ProjectsList from "@/pages/ProjectsList";
import NewProject from "@/pages/NewProject";
import Settings from "@/pages/Settings";
import Templates from "@/pages/Templates";
import WhatsAppPage from "@/pages/WhatsApp";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProjectConflicts from "@/pages/ProjectConflicts";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import Admin from "@/pages/Admin";
import AcceptInvite from "@/pages/AcceptInvite";
import OnboardingWizard from "@/pages/OnboardingWizard";
import PublicBidView from "@/pages/PublicBidView";
import DocumentSummary from "@/pages/DocumentSummary";

function ProtectedRoute({ component: Component, requireOnboarding = true }: { component: React.ComponentType; requireOnboarding?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    } else if (!isLoading && isAuthenticated && requireOnboarding && user?.onboardingStatus === 'pending') {
      setLocation("/setup/branding");
    }
  }, [isAuthenticated, isLoading, setLocation, user?.onboardingStatus, requireOnboarding]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-deep-teal"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireOnboarding && user?.onboardingStatus === 'pending') {
    return null;
  }

  return <Component />;
}

function OnboardingRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    } else if (!isLoading && isAuthenticated && user?.onboardingStatus === 'complete') {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation, user?.onboardingStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-deep-teal"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.onboardingStatus === 'complete') {
    return null;
  }

  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-deep-teal"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <Component />;
}

function AppInit() {
  const initialize = useAuthStore((state) => state.initialize);
  
  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login">
        {() => <AuthRoute component={Login} />}
      </Route>
      <Route path="/register">
        {() => <AuthRoute component={Register} />}
      </Route>
      <Route path="/invite/:code" component={AcceptInvite} />
      <Route path="/share/:token" component={PublicBidView} />
      <Route path="/setup/branding">
        {() => <OnboardingRoute component={OnboardingWizard} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/projects">
        {() => <ProtectedRoute component={ProjectsList} />}
      </Route>
      <Route path="/projects/new">
        {() => <ProtectedRoute component={NewProject} />}
      </Route>
      <Route path="/projects/:id">
        {() => <ProtectedRoute component={ProjectWorkspace} />}
      </Route>
      <Route path="/projects/:id/documents">
        {() => <ProtectedRoute component={DocumentSummary} />}
      </Route>
      <Route path="/projects/:id/analysis">
        {() => <ProtectedRoute component={ProjectAnalysis} />}
      </Route>
      <Route path="/projects/:id/conflicts">
        {() => <ProtectedRoute component={ProjectConflicts} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/templates">
        {() => <ProtectedRoute component={Templates} />}
      </Route>
      <Route path="/whatsapp">
        {() => <ProtectedRoute component={WhatsAppPage} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppInit />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;