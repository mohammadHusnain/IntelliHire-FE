import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import AdminLayout from "./AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import useCounter from "@/hooks/useCounter";
import useInView from "@/hooks/useInView";
import { useToast } from "@/components/shared/Toast";

const monthlyChart = {
  labels: [
    "Apr 9", "Apr 10", "Apr 11", "Apr 12", "Apr 13", "Apr 14", "Apr 15", "Apr 16", "Apr 17", "Apr 18",
    "Apr 19", "Apr 20", "Apr 21", "Apr 22", "Apr 23", "Apr 24", "Apr 25", "Apr 26", "Apr 27", "Apr 28",
    "Apr 29", "Apr 30", "May 1", "May 2", "May 3", "May 4", "May 5", "May 6", "May 7", "May 8",
  ],
  individuals: [42, 48, 50, 55, 58, 62, 49, 46, 53, 59, 65, 70, 68, 66, 61, 57, 60, 64, 71, 74, 76, 79, 81, 85, 84, 87, 89, 78, 73, 69],
  companies: [2, 3, 3, 4, 5, 4, 2, 3, 4, 5, 6, 4, 5, 6, 4, 3, 4, 4, 5, 6, 6, 5, 4, 5, 4, 5, 4, 4, 3, 3],
};

const weeklyChart = {
  labels: ["May 2", "May 3", "May 4", "May 5", "May 6", "May 7", "May 8"],
  individuals: [78, 84, 87, 89, 78, 73, 69],
  companies: [4, 5, 4, 4, 3, 3, 3],
};

const initialApprovals = [
  {
    id: "cmp_1",
    name: "NexusTech Ltd",
    ownerEmail: "ceo@nexustech.com",
    industry: "Technology",
    registered: "May 06, 2025",
    companySize: "120-250",
    hiringIntent: "Hiring 6 roles",
    status: "pending",
    teamSize: "8 recruiters",
    trustSignals: ["Verified domain", "LinkedIn match"],
    verification: "Docs under review",
  },
  {
    id: "cmp_2",
    name: "BuildCo Staffing",
    ownerEmail: "hr@buildco.com",
    industry: "Recruitment",
    registered: "May 07, 2025",
    companySize: "60-120",
    hiringIntent: "Scaling hiring ops",
    status: "pending",
    teamSize: "4 recruiters",
    trustSignals: ["ATS connected", "Contractor verified"],
    verification: "Background checks pending",
  },
  {
    id: "cmp_3",
    name: "AlphaMedia Group",
    ownerEmail: "talent@alphamedia.com",
    industry: "Media",
    registered: "May 07, 2025",
    companySize: "200-350",
    hiringIntent: "Launching new teams",
    status: "pending",
    teamSize: "10 recruiters",
    trustSignals: ["Domain verified", "Phone confirmed"],
    verification: "Verification scheduled",
  },
];

const activityItems = [
  { id: 1, type: "company", text: "New company registered: GlobalTech", time: "2h ago" },
  { id: 2, type: "user", text: "45 new candidates registered today", time: "3h ago" },
  { id: 3, type: "company", text: "Company approved: Meridian Corp", time: "4h ago" },
  { id: 4, type: "company", text: "Interview milestone: 10,000th session", time: "6h ago" },
  { id: 5, type: "admin", text: "User suspended: spam@example.com", time: "8h ago" },
  { id: 6, type: "user", text: "New candidate report opened", time: "9h ago" },
  { id: 7, type: "company", text: "Recruiter invited 3 teammates", time: "11h ago" },
  { id: 8, type: "admin", text: "Admin action: login from new device", time: "12h ago" },
  { id: 9, type: "user", text: "Candidate feedback submitted", time: "14h ago" },
  { id: 10, type: "company", text: "Company updated subscription", time: "16h ago" },
];

const activityTabs = [
  { label: "All", value: "all" },
  { label: "User Events", value: "user" },
  { label: "Company Events", value: "company" },
  { label: "Admin Actions", value: "admin" },
];

const kpiData = [
  {
    label: "Total Individual Users",
    value: 12847,
    trend: "+45 today",
    trendColor: "text-[#059669]",
    note: "Highest growth from graduate candidates",
  },
  {
    label: "Total Companies",
    value: 854,
    trend: "+1 today",
    trendColor: "text-[#059669]",
    note: "12 awaiting onboarding review this week",
  },
  {
    label: "Active Job Postings",
    value: 2341,
    trend: "Stable",
    trendColor: "text-[#9CA3AF]",
    note: "Frontend roles are currently highest",
  },
  {
    label: "Interview Sessions This Month",
    value: 8924,
    trend: "+18% vs previous month",
    trendColor: "text-[#F04E23]",
    note: "Platform core metric",
  },
  {
    label: "Pending Approvals",
    value: 3,
    trend: "3 Pending",
    trendColor: "text-[#D97706]",
    note: "Requires immediate review",
    isPending: true,
  },
];

const getDotColor = (type) => {
  if (type === "user") return "bg-[#3B82F6]";
  if (type === "company") return "bg-[#059669]";
  return "bg-[#DC2626]";
};

const KPIValue = ({ target, start, delay = 0, highlight }) => {
  const [shouldStart, setShouldStart] = useState(false);

  useEffect(() => {
    if (!start) return;
    const timer = setTimeout(() => setShouldStart(true), delay);
    return () => clearTimeout(timer);
  }, [start, delay]);

  const value = useCounter(target, 1200, shouldStart);
  return (
    <div className={`text-[36px] md:text-[40px] leading-none ${highlight ? "text-[#D97706]" : "text-[#0D0D0D]"}`} style={{ fontFamily: "Times New Roman, serif" }}>
      {Number(value).toLocaleString()}
    </div>
  );
};

export default function AdminDashboard() {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [chartView, setChartView] = useState("monthly");
  const [tooltip, setTooltip] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewCompany, setPreviewCompany] = useState(null);

  const pendingCount = approvals.filter((item) => item.status === "pending").length;
  const approvalsRef = useRef(null);
  const [kpiRef, kpisInView] = useInView({ threshold: 0.2, once: true });
  const [chartRef, chartInView] = useInView({ threshold: 0.2, once: true });
  const { addToast, ToastContainer } = useToast();

  const scrollToApprovals = () => approvalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const chartData = chartView === "monthly" ? monthlyChart : weeklyChart;

  const { width, height, padding } = { width: 520, height: 220, padding: 32 };
  const maxValue = Math.max(...chartData.individuals, ...chartData.companies) + 5;

  const points = useMemo(() => {
    return chartData.labels.map((label, index) => {
      const x = padding + (index / (chartData.labels.length - 1)) * (width - padding * 2);
      const ind = chartData.individuals[index];
      const com = chartData.companies[index];
      const yInd = padding + (1 - ind / maxValue) * (height - padding * 2);
      const yCom = padding + (1 - com / maxValue) * (height - padding * 2);
      return { label, index, x, yInd, yCom, ind, com };
    });
  }, [chartData, maxValue, width, height, padding]);

  const buildPath = (key) =>
    points
      .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${key === "ind" ? point.yInd : point.yCom}`)
      .join(" ");

  const filteredActivity = activeTab === "all" ? activityItems : activityItems.filter((item) => item.type === activeTab);

  const handleApprove = () => {
    if (!approveTarget) return;
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === approveTarget.id ? { ...item, status: "active" } : item,
      ),
    );
    addToast(`✓ ${approveTarget.name} approved.`, "info");
    setApproveTarget(null);
  };

  const handleReject = () => {
    if (!rejectTarget || rejectReason.trim().length < 10) return;
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === rejectTarget.id ? { ...item, status: "rejected" } : item,
      ),
    );
    addToast(`✗ ${rejectTarget.name} rejected.`, "error");
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <AdminLayout title="Admin Dashboard" pendingCount={pendingCount}>
      <AdminPageHeader
        icon="📊"
        title="Admin"
        accent="Dashboard"
        subtitle="Monitor platform-wide KPIs, approvals, and operational health in real time."
        chips={[
          { label: `${pendingCount} approvals require action`, className: "bg-[#FFF4F1] text-[#F04E23]" },
          { label: "Last synced 2 mins ago", className: "text-[#9CA3AF]" },
        ]}
      />
      {pendingCount > 0 && (
        <button
          onClick={scrollToApprovals}
          className="admin-banner w-full text-left mb-6 bg-[#FFFBEB] border border-[#F59E0B]/40 border-l-4 border-l-[#D97706] rounded-xl px-5 py-4 flex items-start gap-3 hover:border-[#F04E23] transition-colors"
        >
          <div className="text-[#D97706] text-lg">🔔</div>
          <div className="flex-1">
            <div className="text-[14px] text-[#92400E] font-medium">
              {pendingCount} companies are awaiting approval. Review and activate their accounts.
            </div>
            <div className="text-[12px] text-[#A16207] mt-1">
              Delayed approvals may block employer hiring access
            </div>
          </div>
          <span className="text-[13px] text-[#F04E23] font-semibold hover:underline">Review Now →</span>
        </button>
      )}

      {/* KPI Cards */}
      <div ref={kpiRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-8">
        {kpiData.map((kpi, idx) => (
          <button
            key={kpi.label}
            onClick={kpi.isPending ? scrollToApprovals : undefined}
            className={`text-left rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm px-4 py-4 ${
              kpi.isPending
                ? "bg-[#FFFBEB] border-[#F59E0B]/40 hover:border-[#F04E23]"
                : "bg-white border-[#E5E7EB] hover:border-[#D1D5DB]"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">{kpi.label}</div>
            <KPIValue target={kpi.isPending ? pendingCount : kpi.value} start={kpisInView} delay={idx * 100} highlight={kpi.isPending} />
            <div className={`text-[12px] mt-1 ${kpi.trendColor}`}>{kpi.trend}</div>
            <div className="text-[12px] text-[#6B7280] mt-2">{kpi.note}</div>
          </button>
        ))}
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 mb-8">
        <div ref={chartRef} className="border border-[#E5E7EB] rounded-xl bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>User Registrations</div>
              <div className="text-[12px] text-[#9CA3AF]">Last 30 Days</div>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <button
                onClick={() => setChartView("monthly")}
                className={`px-3 py-1 rounded-full border ${chartView === "monthly" ? "border-[#F04E23] text-[#F04E23]" : "border-[#E5E7EB] text-[#6B7280]"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartView("weekly")}
                className={`px-3 py-1 rounded-full border ${chartView === "weekly" ? "border-[#F04E23] text-[#F04E23]" : "border-[#E5E7EB] text-[#6B7280]"}`}
              >
                Weekly
              </button>
            </div>
          </div>

          <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[240px]">
              {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
                <line
                  key={ratio}
                  x1={padding}
                  x2={width - padding}
                  y1={padding + ratio * (height - padding * 2)}
                  y2={padding + ratio * (height - padding * 2)}
                  stroke="#F3F4F6"
                  strokeWidth="1"
                />
              ))}
              <path
                d={buildPath("ind")}
                fill="none"
                stroke="#F04E23"
                strokeWidth="2"
                className={chartInView ? "admin-chart-line" : ""}
              />
              <path
                d={buildPath("com")}
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                className={chartInView ? "admin-chart-line" : ""}
              />
              {points.map((point, idx) => (
                <g
                  key={point.label}
                  onMouseEnter={() =>
                    setTooltip({
                      x: point.x,
                      y: Math.min(point.yInd, point.yCom),
                      label: point.label,
                      ind: point.ind,
                      com: point.com,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle cx={point.x} cy={point.yInd} r={3.5} fill="#F04E23" />
                  <circle cx={point.x} cy={point.yCom} r={3.5} fill="#059669" />
                  {idx % 5 === 0 && (
                    <text x={point.x} y={height - 10} textAnchor="middle" fontSize="11" fill="#9CA3AF">
                      {point.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            {tooltip && (
              <div
                className="absolute bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[12px] text-[#374151] shadow-sm"
                style={{ left: tooltip.x + 10, top: tooltip.y - 40 }}
              >
                <div className="font-semibold">{tooltip.label}</div>
                <div>{tooltip.ind} individuals</div>
                <div>{tooltip.com} companies</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-4 text-[12px] text-[#6B7280]">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#F04E23]" /> Individuals</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#059669]" /> Companies</span>
          </div>

          <div className="mt-4 text-[12px] text-[#92400E] bg-[#FFF4F1] border border-[#FCA68A] rounded-lg px-3 py-2">
            Registrations peaked on May 5 — +23% above average
          </div>
        </div>

        <div className="border border-[#E5E7EB] rounded-xl bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Platform Activity</div>
            <ChevronDown size={16} className="text-[#9CA3AF]" />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {activityTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1 rounded-full text-[12px] border ${
                  activeTab === tab.value ? "border-[#F04E23] text-[#F04E23]" : "border-[#E5E7EB] text-[#6B7280]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-[320px] overflow-y-auto admin-scrollbar">
            {filteredActivity.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 py-3 border-b border-[#F3F4F6] text-[13px] text-[#374151] ${index < 8 ? "admin-fade" : ""}`}
                style={index < 8 ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${getDotColor(item.type)}`} />
                <span className="flex-1">{item.text}</span>
                <span className="text-[12px] text-[#9CA3AF]">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div ref={approvalsRef} className="border border-[#E5E7EB] rounded-xl bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Pending Company Approvals</div>
            {pendingCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] admin-pulse" />}
          </div>
          <button className="text-[12px] text-[#F04E23] flex items-center gap-1 hover:underline">
            View full queue <ExternalLink size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF] border-b border-[#E5E7EB]">
              <tr>
                <th className="py-3 pr-4">Company Name</th>
                <th className="py-3 pr-4">Owner Email</th>
                <th className="py-3 pr-4">Industry</th>
                <th className="py-3 pr-4">Registered</th>
                <th className="py-3 pr-4">Company Size</th>
                <th className="py-3 pr-4">Hiring Intent</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((company) => (
                <tr key={company.id} className="border-b border-[#F3F4F6]">
                  <td className="py-4 pr-4 font-medium text-[#0D0D0D]">{company.name}</td>
                  <td className="py-4 pr-4 text-[#6B7280]">{company.ownerEmail}</td>
                  <td className="py-4 pr-4 text-[#6B7280]">{company.industry}</td>
                  <td className="py-4 pr-4 text-[#6B7280]">{company.registered}</td>
                  <td className="py-4 pr-4 text-[#6B7280]">{company.companySize}</td>
                  <td className="py-4 pr-4 text-[#6B7280]">{company.hiringIntent}</td>
                  <td className="py-4 pr-4">
                    {company.status === "pending" && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium bg-[#FFFBEB] text-[#D97706]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] admin-pulse" /> Pending
                      </span>
                    )}
                    {company.status === "active" && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium bg-[#F0FDF4] text-[#059669]">
                        Active
                      </span>
                    )}
                    {company.status === "rejected" && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium bg-[#FEF2F2] text-[#DC2626]">
                        Rejected
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {company.status === "pending" ? (
                        <>
                          <button
                            onClick={() => setApproveTarget(company)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#059669] text-white hover:bg-[#047857]"
                          >
                            Approve ✓
                          </button>
                          <button
                            onClick={() => setRejectTarget(company)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[#DC2626] text-[#DC2626] hover:bg-[#FEF2F2]"
                          >
                            Reject ✗
                          </button>
                          <button
                            onClick={() => setPreviewCompany(company)}
                            className="text-[12px] text-[#F04E23] hover:underline"
                          >
                            Preview
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setPreviewCompany(company)}
                          className="text-[12px] text-[#F04E23] hover:underline"
                        >
                          View Summary
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {approveTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApproveTarget(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 border border-[#E5E7EB] admin-modal">
            <h3 className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
              Approve {approveTarget.name}?
            </h3>
            <p className="text-[14px] text-[#6B7280] mt-2">
              This will activate their account and notify the owner.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setApproveTarget(null)}
                className="flex-1 h-[40px] rounded-lg border border-[#E5E7EB] text-[14px] font-medium text-[#374151]"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 h-[40px] rounded-lg bg-[#F04E23] text-white text-[14px] font-semibold hover:bg-[#D43D14]"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectTarget(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 border border-[#E5E7EB] admin-modal">
            <h3 className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
              Reject {rejectTarget.name}?
            </h3>
            <p className="text-[14px] text-[#6B7280] mt-2">Reason for rejection (min 10 chars)</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-lg border border-[#E5E7EB] p-3 text-[13px] focus:border-[#F04E23]"
              placeholder="Explain the rejection reason to notify the owner"
            />
            <div className="text-[11px] text-[#9CA3AF] mt-1">{rejectReason.length} / 10</div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 h-[40px] rounded-lg border border-[#E5E7EB] text-[14px] font-medium text-[#374151]"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectReason.trim().length < 10}
                className="flex-1 h-[40px] rounded-lg bg-[#DC2626] text-white text-[14px] font-semibold hover:bg-[#B91C1C] disabled:opacity-50"
              >
                Reject Company
              </button>
            </div>
          </div>
        </div>
      )}

      {previewCompany && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPreviewCompany(null)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[360px] bg-white border-l border-[#E5E7EB] p-6 admin-drawer">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
                {previewCompany.name}
              </h3>
              <button onClick={() => setPreviewCompany(null)} className="text-[#9CA3AF] hover:text-[#374151]">✕</button>
            </div>
            <div className="mt-4 space-y-4 text-[13px] text-[#6B7280]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Hiring Intent</div>
                <div className="text-[#374151] font-medium">{previewCompany.hiringIntent}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Recruiter Team Size</div>
                <div className="text-[#374151] font-medium">{previewCompany.teamSize}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Trust Indicators</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {previewCompany.trustSignals.map((signal) => (
                    <span key={signal} className="px-2 py-1 rounded-full text-[11px] bg-[#FFF4F1] text-[#F04E23]">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">Verification Status</div>
                <div className="text-[#374151] font-medium">{previewCompany.verification}</div>
              </div>
            </div>
            <button
              onClick={() => setPreviewCompany(null)}
              className="mt-6 w-full h-[40px] rounded-lg border border-[#E5E7EB] text-[13px] font-semibold text-[#374151]"
            >
              Close Drawer
            </button>
          </aside>
        </div>
      )}

      <ToastContainer />
    </AdminLayout>
  );
}
