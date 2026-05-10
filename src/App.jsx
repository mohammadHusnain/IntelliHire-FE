import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/public/LandingPage";
import LoginPage from "./pages/public/LoginPage";
import RegisterPage from "./pages/public/RegisterPage";
import CandidateDashboard from "./pages/candidate/CandidateDashboard";
import CandidateProfile from "./pages/candidate/CandidateProfile";
import CandidateReports from "./pages/candidate/CandidateReports";
import InterviewSetup from "./pages/candidate/InterviewSetup";
import InterviewRoom from "./pages/candidate/InterviewRoom";
import InterviewReport from "./pages/candidate/InterviewReport";
import CompanyPending from "./pages/company/CompanyPending";
import CompanyOnboarding from "./pages/company/CompanyOnboarding";
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CompanyTeam from "./pages/company/CompanyTeam";
import CompanyJobs from "./pages/company/CompanyJobs";
import CompanyJobCreate from "./pages/company/CompanyJobCreate";
import CompanyJobPreview from "./pages/company/CompanyJobPreview";
import CompanyCandidates from "./pages/company/CompanyCandidates";
import CompanyCandidateProfile from "./pages/company/CompanyCandidateProfile";
import CompanyAnalytics from "./pages/company/CompanyAnalytics";
import CompanyCommunity from "./pages/company/CompanyCommunity";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/candidate/dashboard" element={<CandidateDashboard />} />
        <Route path="/candidate/profile" element={<CandidateProfile />} />
        <Route path="/candidate/reports" element={<CandidateReports />} />
        <Route path="/candidate/interview/setup" element={<InterviewSetup />} />
        <Route path="/candidate/interview/room" element={<InterviewRoom />} />
        <Route path="/candidate/report/:id" element={<InterviewReport />} />
        <Route path="/company/pending" element={<CompanyPending />} />
        <Route path="/company/onboarding" element={<CompanyOnboarding />} />
        <Route path="/company/dashboard" element={<CompanyDashboard />} />
        <Route path="/company/team" element={<CompanyTeam />} />
        <Route path="/company/jobs" element={<CompanyJobs />} />
        <Route path="/company/jobs/create" element={<CompanyJobCreate />} />
        <Route path="/company/jobs/:id/edit" element={<CompanyJobCreate />} />
        <Route path="/company/jobs/:id/preview" element={<CompanyJobPreview />} />
        <Route path="/company/jobs/:id/candidates" element={<CompanyCandidates />} />
        <Route path="/company/candidates/:id" element={<CompanyCandidateProfile />} />
        <Route path="/company/analytics" element={<CompanyAnalytics />} />
        <Route path="/company/community" element={<CompanyCommunity />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
