import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, GuestRoute, RoleProtectedRoute } from "@/components/auth";
import { ROLES } from "@/config/routes";
import { Loader2 } from "lucide-react";

// ─── Lazy-loaded Pages ──────────────────────────────────────────────────────
// Public
const LandingPage = lazy(() => import("@/pages/public/LandingPage"));
const LoginPage = lazy(() => import("@/pages/public/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/public/RegisterPage"));
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
const CompanyDashboard = lazy(() => import("@/pages/company/CompanyDashboard"));
const CompanyTeam = lazy(() => import("@/pages/company/CompanyTeam"));
const CompanyJobs = lazy(() => import("@/pages/company/CompanyJobs"));
const CompanyJobCreate = lazy(() => import("@/pages/company/CompanyJobCreate"));
const CompanyJobPreview = lazy(() => import("@/pages/company/CompanyJobPreview"));
const CompanyCandidates = lazy(() => import("@/pages/company/CompanyCandidates"));
const CompanyAllCandidates = lazy(() => import("@/pages/company/CompanyAllCandidates"));
const CompanyCandidateProfile = lazy(() => import("@/pages/company/CompanyCandidateProfile"));
const CompanyAnalytics = lazy(() => import("@/pages/company/CompanyAnalytics"));
const CompanyCommunity = lazy(() => import("@/pages/company/CompanyCommunity"));
const CompanySettings = lazy(() => import("@/pages/company/CompanySettings"));

// Admin
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminCompanies = lazy(() => import("@/pages/admin/AdminCompanies"));
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
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* ── Candidate Routes (role-guarded) ── */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.CANDIDATE]} />}>
              <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
              <Route path="/candidate/profile" element={<CandidateProfile />} />
              <Route path="/candidate/reports" element={<CandidateReports />} />
              <Route path="/candidate/interview/setup" element={<InterviewSetup />} />
              <Route path="/candidate/interview/room" element={<InterviewRoom />} />
              <Route path="/candidate/report/:id" element={<InterviewReport />} />
              <Route path="/candidate/communities" element={<CandidateCommunities />} />
              <Route path="/candidate/settings" element={<CandidateSettings />} />
            </Route>

            {/* ── Company Routes (role-guarded) ── */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.COMPANY]} />}>
              <Route path="/company/pending" element={<CompanyPending />} />
              <Route path="/company/dashboard" element={<CompanyDashboard />} />
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
            </Route>

            {/* ── Admin Routes (role-guarded) ── */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/companies" element={<AdminCompanies />} />
              <Route path="/admin/communities" element={<AdminCommunities />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/management" element={<AdminManagement />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            {/* ── Catch-all 404 ── */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
