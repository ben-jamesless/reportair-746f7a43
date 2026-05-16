import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";

// Heavy / less-frequently-visited routes are loaded on demand to keep the
// initial JS bundle small for landing & auth flows.
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Plan = lazy(() => import("./pages/Plan.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const SharePage = lazy(() => import("./pages/SharePage.tsx"));
const InviteAccept = lazy(() => import("./pages/InviteAccept.tsx"));
const Billing = lazy(() => import("./pages/Billing.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const ShareLinks = lazy(() => import("./pages/ShareLinks.tsx"));
const Team = lazy(() => import("./pages/Team.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.tsx"));
const AdminSummary = lazy(() => import("./pages/admin/AdminSummary.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.tsx"));
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects.tsx"));



const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <ErrorBoundary label="page">
                <Routes>
                  <Route path="/" element={<ErrorBoundary label="page"><Index /></ErrorBoundary>} />
                  <Route path="/auth" element={<ErrorBoundary label="page"><Auth /></ErrorBoundary>} />
                  <Route path="/forgot-password" element={<ErrorBoundary label="page"><ForgotPassword /></ErrorBoundary>} />
                  <Route path="/reset-password" element={<ErrorBoundary label="page"><ResetPassword /></ErrorBoundary>} />
                  <Route path="/onboarding" element={<ErrorBoundary label="page"><ProtectedRoute><Onboarding /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/onboarding/plan" element={<ErrorBoundary label="page"><ProtectedRoute><Plan /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/projects" element={<ErrorBoundary label="page"><ProtectedRoute><Projects /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/projects/:id" element={<ErrorBoundary label="page"><ProtectedRoute><ProjectDetail /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/profile" element={<ErrorBoundary label="page"><ProtectedRoute><Profile /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/invite/:token" element={<ErrorBoundary label="page"><InviteAccept /></ErrorBoundary>} />
                  <Route path="/billing" element={<ErrorBoundary label="page"><ProtectedRoute><Billing /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/reports" element={<ErrorBoundary label="page"><ProtectedRoute><Reports /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/share-links" element={<ErrorBoundary label="page"><ProtectedRoute><ShareLinks /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/team" element={<ErrorBoundary label="page"><ProtectedRoute><Team /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/settings" element={<ErrorBoundary label="page"><ProtectedRoute><Settings /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/s/:token" element={<ErrorBoundary label="page"><SharePage /></ErrorBoundary>} />
                  <Route path="/admin" element={<ErrorBoundary label="page"><ProtectedRoute><AdminRoute><AdminLayout /></AdminRoute></ProtectedRoute></ErrorBoundary>}>
                    <Route index element={<AdminSummary />} />
                    <Route path="summary" element={<AdminSummary />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="accounts" element={<AdminUsers />} />
                    <Route path="projects" element={<AdminProjects />} />
                  </Route>
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
