import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PlanGuard } from "@/components/PlanGuard";
import { BetaCommercialGuard } from "@/components/BetaCommercialGuard";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChunkLoadBoundary } from "@/components/ChunkLoadBoundary";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { RouteAnalytics } from "@/components/RouteAnalytics";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
const PreviewHomeV2 = lazy(() => import("./pages/PreviewHomeV2.tsx"));
const PreviewPricingV2 = lazy(() => import("./pages/PreviewPricingV2.tsx"));
const About = lazy(() => import("./pages/About.tsx"));

// Heavy / less-frequently-visited routes are loaded on demand to keep the
// initial JS bundle small for landing & auth flows.
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Plan = lazy(() => import("./pages/Plan.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetailRouter.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const SharePage = lazy(() => import("./pages/SharePage.tsx"));
const SharePageV2 = lazy(() => import("./features/sharePageV2/SharePageV2.tsx"));
const CompanyInviteAccept = lazy(() => import("./pages/CompanyInviteAccept.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const InviteAccept = lazy(() => import("./pages/InviteAccept.tsx"));
const Billing = lazy(() => import("./pages/Billing.tsx"));

const ShareLinks = lazy(() => import("./pages/ShareLinks.tsx"));
const Team = lazy(() => import("./pages/Team.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.tsx"));
const AdminRequests = lazy(() => import("./pages/admin/AdminRequests.tsx"));
const AdminCompanies = lazy(() => import("./pages/admin/AdminCompanies.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.tsx"));



const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Loading…
  </div>
);

const App = () => (
  <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RouteAnalytics />
          <ChunkLoadBoundary>
          <Suspense fallback={<RouteFallback />}>
            <ErrorBoundary label="page">
              <Routes>
                <Route path="/" element={<ErrorBoundary label="page"><PreviewHomeV2 /></ErrorBoundary>} />
                <Route path="/preview/home-v2" element={<ErrorBoundary label="page"><PreviewHomeV2 /></ErrorBoundary>} />
                <Route path="/home-v1" element={<ErrorBoundary label="page"><Index /></ErrorBoundary>} />
                <Route path="/early-access" element={<ErrorBoundary label="page"><PreviewPricingV2 /></ErrorBoundary>} />
                <Route path="/pricing" element={<ErrorBoundary label="page"><PreviewPricingV2 /></ErrorBoundary>} />
                <Route path="/preview/pricing-v2" element={<ErrorBoundary label="page"><PreviewPricingV2 /></ErrorBoundary>} />
                <Route path="/auth" element={<ErrorBoundary label="page"><Auth /></ErrorBoundary>} />
                <Route path="/about" element={<ErrorBoundary label="page"><About /></ErrorBoundary>} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/forgot-password" element={<ErrorBoundary label="page"><ForgotPassword /></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary label="page"><ResetPassword /></ErrorBoundary>} />
                <Route path="/onboarding" element={<ErrorBoundary label="page"><ProtectedRoute><Onboarding /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/onboarding/plan" element={<ErrorBoundary label="page"><ProtectedRoute><BetaCommercialGuard><Plan /></BetaCommercialGuard></ProtectedRoute></ErrorBoundary>} />
                <Route path="/projects" element={<ErrorBoundary label="page"><ProtectedRoute><Projects /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/projects/:id" element={<ErrorBoundary label="page"><ProtectedRoute><ProjectDetail /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/profile" element={<ErrorBoundary label="page"><ProtectedRoute><Profile /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/company-invite/:token" element={<ErrorBoundary label="page"><CompanyInviteAccept /></ErrorBoundary>} />
                <Route path="/invite/:token" element={<ErrorBoundary label="page"><InviteAccept /></ErrorBoundary>} />
                <Route path="/billing" element={<ErrorBoundary label="page"><ProtectedRoute><BetaCommercialGuard><Billing /></BetaCommercialGuard></ProtectedRoute></ErrorBoundary>} />
                
                <Route path="/share-links" element={<ErrorBoundary label="page"><ProtectedRoute><PlanGuard allow={["crew", "studio", "beta"]}><ShareLinks /></PlanGuard></ProtectedRoute></ErrorBoundary>} />
                <Route path="/team" element={<ErrorBoundary label="page"><ProtectedRoute><PlanGuard allow={["crew", "studio", "beta"]}><Team /></PlanGuard></ProtectedRoute></ErrorBoundary>} />

                <Route path="/settings" element={<ErrorBoundary label="page"><ProtectedRoute><Settings /></ProtectedRoute></ErrorBoundary>} />
                <Route path="/s/:token" element={<ErrorBoundary label="page"><SharePageV2 /></ErrorBoundary>} />
                <Route path="/s2/:token" element={<ErrorBoundary label="page"><SharePageV2 /></ErrorBoundary>} />
                <Route path="/s1/:token" element={<ErrorBoundary label="page"><SharePage /></ErrorBoundary>} />
                <Route path="/admin" element={<ErrorBoundary label="page"><ProtectedRoute><AdminRoute><AdminLayout /></AdminRoute></ProtectedRoute></ErrorBoundary>}>
                  <Route index element={<Navigate to="requests" replace />} />
                  <Route path="requests" element={<AdminRequests />} />
                  <Route path="companies" element={<AdminCompanies />} />
                  <Route path="people" element={<AdminUsers />} />
                  <Route path="early-access" element={<Navigate to="/admin/requests" replace />} />
                  <Route path="signups" element={<Navigate to="/admin/requests" replace />} />
                  <Route path="beta" element={<Navigate to="/admin/companies" replace />} />
                  <Route path="summary" element={<Navigate to="/admin/companies" replace />} />
                  <Route path="projects" element={<Navigate to="/admin/companies" replace />} />
                  <Route path="users" element={<Navigate to="/admin/people" replace />} />
                  <Route path="accounts" element={<Navigate to="/admin/people" replace />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
          </ChunkLoadBoundary>
          <CookieConsentBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
