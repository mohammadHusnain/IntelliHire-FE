import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, GuestRoute, RoleProtectedRoute } from "@/components/auth";
import { ROLES } from "@/config/routes";
import { Loader2 } from "lucide-react";
import Toaster from "@/components/shared/Toaster";
import CandidateGate from "@/components/candidate/CandidateGate";
import CandidateLayout from "@/components/candidate/CandidateLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import CompanyLayout, { CompanyGate } from "@/components/company/CompanyLayout";

// Module 2 screens have a demo version and a real-backend version. The literal check lets the build drop the other one.
const DEMO = import.meta.env.VITE_USE_MOCK_API === "true";

// ─── Lazy-loaded Pages ──────────────────────────────────────────────────────
// Public
const LandingPage = lazy(() => import("@/pages/public/LandingPage"));
const LoginPage = lazy(() => import("@/pages/public/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/public/RegisterPage"));
const VerifyEmailPage = lazy(() => import("@/pages/public/VerifyEmailPage"));
const ResetPasswordPage = lazy(() => import("@/pages/public/ResetPasswordPage"));
const AcceptInvitePage = lazy(() => import("@/pages/public/AcceptInvitePage"));
const ResubmitCompanyPage = lazy(() => import("@/pages/public/ResubmitCompanyPage"));
const ApplyPage = lazy(() => import("@/pages/public/ApplyPage"));
const NotFoundPage = lazy(() => import("@/pages/public/NotFoundPage"));
const UnauthorizedPage = lazy(() => import("@/pages/public/UnauthorizedPage"));

// Candidate
const CandidateDashboard = lazy(() => import("@/pages/candidate/CandidateDashboard"));
const CandidateProfile = lazy(() => import("@/pages/candidate/CandidateProfile"));
const CandidateReports = lazy(() => import("@/pages/candidate/CandidateReports"));
const InterviewSetup = lazy(() => import("@/pages/candidate/InterviewSetup"));
const InterviewRoom = lazy(() => import("@/pages/candidate/InterviewRoom"));
const InterviewReport = lazy(() => import("@/pages/candidate/InterviewReport"));
const CandidateCommunities = lazy(() => import("@/pages/candidate/CandidateCommunities"));
const CandidateSettings = lazy(() => import("@/pages/candidate/CandidateSettings"));

// Company
const CompanyPending = lazy(() => import("@/pages/company/CompanyPending"));
const CompanyOnboarding = lazy(() => import("@/pages/company/CompanyOnboarding"));
const CompanyDashboard = lazy(() => (DEMO ? import("@/pages/company/CompanyDashboard") : import("@/pages/company/CompanyDashboardLive")));
const CompanyTeam = lazy(() => (DEMO ? import("@/pages/company/CompanyTeam") : import("@/pages/company/CompanyTeamLive")));
const CompanyJobs = lazy(() => (DEMO ? import("@/pages/company/CompanyJobs") : import("@/pages/company/CompanyJobsLive")));
const CompanyJobCreate = lazy(() => (DEMO ? import("@/pages/company/CompanyJobCreate") : import("@/pages/company/CompanyJobFormLive")));
const CompanyJobPreview = lazy(() => (DEMO ? import("@/pages/company/CompanyJobPreview") : import("@/pages/company/CompanyJobPreviewLive")));
const CompanyCandidates = lazy(() => (DEMO ? import("@/pages/company/CompanyCandidates") : import("@/pages/company/CompanyApplicantsLive")));
const CompanyAllCandidates = lazy(() => (DEMO ? import("@/pages/company/CompanyAllCandidates") : import("@/pages/company/CompanyApplicantsLive")));
const CompanyCandidateProfile = lazy(() => (DEMO ? import("@/pages/company/CompanyCandidateProfile") : import("@/pages/company/CompanyApplicantLive")));
const CompanyAnalytics = lazy(() => (DEMO ? import("@/pages/company/CompanyAnalytics") : import("@/pages/company/CompanyAnalyticsLive")));
const CompanyCommunity = lazy(() => import("@/pages/company/CompanyCommunity"));
const CompanySettings = lazy(() => import("@/pages/company/CompanySettings"));

// Admin
const AdminDashboard = lazy(() => (DEMO ? import("@/pages/admin/AdminDashboard") : import("@/pages/admin/AdminDashboardLive")));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminCompanies = lazy(() => (DEMO ? import("@/pages/admin/AdminCompanies") : import("@/pages/admin/AdminCompaniesLive")));
const AdminCommunities = lazy(() => import("@/pages/admin/AdminCommunities"));
const AdminReports = lazy(() => import("@/pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminManagement = lazy(() => import("@/pages/admin/AdminManagement"));

// ─── Suspense Fallback ──────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-[#F04E23]" size={28} />
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public Routes ── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/apply/:slug" element={<ApplyPage />} />
            <Route path="/resubmit-company" element={<GuestRoute><ResubmitCompanyPage /></GuestRoute>} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* ── Candidate Routes (role-guarded) ── */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.CANDIDATE]} />}>
              <Route element={<CandidateGate />}>
                <Route path="/candidate/interview/room" element={<InterviewRoom />} />
                <Route element={<CandidateLayout />}>
                  <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
                  <Route path="/candidate/profile" element={<CandidateProfile />} />
                  <Route path="/candidate/reports" element={<CandidateReports />} />
                  <Route path="/candidate/interview/setup" element={<InterviewSetup />} />
                  <Route path="/candidate/report/:id" element={<InterviewReport />} />
                  <Route path="/candidate/communities" element={<CandidateCommunities />} />
                  <Route path="/candidate/settings" element={<CandidateSettings />} />
                  <Route path="/candidate" element={<Navigate to="/candidate/dashboard" replace />} />
                </Route>
              </Route>
            </Route>

            {/* ── Company Routes (role-guarded) ── */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.COMPANY]} />}>
              <Route element={<CompanyGate />}>
                <Route path="/company/pending" element={<CompanyPending />} />
                <Route element={<CompanyLayout />}>
                  <Route path="/company/dashboard" element={<CompanyDashboard />} />
                  <Route path="/company/onboarding" element={<CompanyOnboarding />} />
                  <Route path="/company/team" element={<CompanyTeam />} />
                  <Route path="/company/jobs" element={<CompanyJobs />} />
                  <Route path="/company/jobs/create" element={<CompanyJobCreate />} />
                  <Route path="/company/jobs/:id/edit" element={<CompanyJobCreate />} />
                  <Route path="/company/jobs/:id/preview" element={<CompanyJobPreview />} />
                  <Route path="/company/candidates" element={<CompanyAllCandidates />} />
                  <Route path="/company/jobs/:id/candidates" element={<CompanyCandidates />} />
                  <Route path="/company/candidates/:id" element={<CompanyCandidateProfile />} />
                  <Route path="/company/analytics" element={<CompanyAnalytics />} />
                  <Route path="/company/community" element={<CompanyCommunity />} />
                  <Route path="/company/settings" element={<CompanySettings />} />
                  <Route path="/company" element={<Navigate to="/company/dashboard" replace />} />
                </Route>
              </Route>
            </Route>

            {/* ── Admin Routes (role-guarded) ── */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/companies" element={<AdminCompanies />} />
                <Route path="/admin/communities" element={<AdminCommunities />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/management" element={<AdminManagement />} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              </Route>
            </Route>

            {/* ── Catch-all 404 ── */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
