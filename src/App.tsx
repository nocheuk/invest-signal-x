import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { WatchlistProvider } from "@/lib/watchlist";
import { StrategyProvider } from "@/lib/strategy";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AllDeals from "./pages/AllDeals";
import DealDetail from "./pages/DealDetail";
import Watchlist from "./pages/Watchlist";
import Alerts from "./pages/Alerts";
import SourcesScans from "./pages/SourcesScans";
import Pricing from "./pages/Pricing";
import Settings from "./pages/Settings";
import AdminImport from "./pages/AdminImport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="dealsignal-theme" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <WatchlistProvider>
            <StrategyProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <FeedbackWidget />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/deals" element={<ProtectedRoute><AllDeals /></ProtectedRoute>} />
                  <Route path="/deal/:id" element={<ProtectedRoute><DealDetail /></ProtectedRoute>} />
                  <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
                  <Route path="/pipeline" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
                  <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                  <Route path="/sources" element={<ProtectedRoute><SourcesScans /></ProtectedRoute>} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/admin/import" element={<ProtectedRoute><AdminRoute><AdminImport /></AdminRoute></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </StrategyProvider>
          </WatchlistProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
