import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import { hasStoredSession } from "@/lib/landing";
import { isAppPath } from "@/lib/app-routes";

const queryClient = new QueryClient();

// The app for signed-in users. Signed out: the public landing page at "/"
// (including for search engines), and a sign-in that comes straight back for
// any other app address (/learn, /library/bible/John/3 …).
const HomeRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  // Subscribes to route changes; the address itself is read from the window,
  // since the app moves between screens with history.pushState directly.
  useLocation();
  const { pathname, search } = window.location;
  const atHome = pathname === "/";
  if (loading) {
    return hasStoredSession() || !atHome
      ? <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>
      : <Landing />;
  }
  if (!user) {
    if (atHome) return <Landing />;
    const next = encodeURIComponent(pathname + search);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }
  return <>{children}</>;
};

/**
 * Every app address renders this one element, so moving between screens
 * never remounts the app (a review in progress survives Back and Forward).
 * Anything that is not an app address is a 404.
 */
const AppShell = () => {
  useLocation();
  const { pathname } = window.location;
  if (pathname === "/" || isAppPath(pathname)) {
    return <HomeRoute><Index /></HomeRoute>;
  }
  return <NotFound />;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (user) {
    const next = new URLSearchParams(location.search).get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return <Navigate to={safeNext} replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
