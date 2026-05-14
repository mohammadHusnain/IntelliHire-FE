import { useState } from "react";
import { Settings, ShieldCheck, FileText } from "lucide-react";
import AdminLayout from "./AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useToast } from "@/components/shared/Toast";

const defaults = {
  enforce2fa: true,
  ipAllowlist: false,
  sessionTimeout: "45 min",
  autoApproveCandidates: false,
  autoApproveCompanies: false,
  requireVerification: true,
  riskAlerts: true,
  pendingApprovals: true,
  weeklyDigest: true,
  aiScoring: true,
  communityBeta: false,
  dataRetention: "18 months",
  auditRetention: "24 months",
  gdprExports: true,
  brandingTheme: "AxisFlow Orange",
};

export default function AdminSettings() {
  const { addToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState(defaults);

  const toggleSetting = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <AdminLayout title="Platform Settings" pendingCount={3}>
      <AdminPageHeader
        icon="⚙️"
        title="Platform"
        accent="Settings"
        subtitle="Configure security, approvals, compliance, and operational controls for IntelliHire."
        actions={[
          { label: "Save Changes", icon: Settings, onClick: () => addToast("Settings saved.", "success"), className: "btn-primary" },
          { label: "Compliance Report", icon: FileText },
          { label: "Security Review", icon: ShieldCheck },
        ]}
        chips={[
          { label: "Last synced 2 mins ago", className: "text-[#9CA3AF]" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Security & Access</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Control admin access, sessions, and login policies.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <label className="flex items-center justify-between">
              Enforce admin 2FA
              <input type="checkbox" checked={settings.enforce2fa} onChange={() => toggleSetting("enforce2fa")} />
            </label>
            <label className="flex items-center justify-between">
              IP allowlist required
              <input type="checkbox" checked={settings.ipAllowlist} onChange={() => toggleSetting("ipAllowlist")} />
            </label>
            <div className="flex items-center justify-between">
              <span>Session timeout</span>
              <select className="input-field h-[32px] w-[140px]" value={settings.sessionTimeout} onChange={(e) => setSettings((prev) => ({ ...prev, sessionTimeout: e.target.value }))}>
                <option>30 min</option>
                <option>45 min</option>
                <option>60 min</option>
                <option>90 min</option>
              </select>
            </div>
            <button className="btn-secondary h-[34px] px-4 text-[12px]">Reset all admin sessions</button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Approvals & Verification</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Standardize onboarding rules for users and companies.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <label className="flex items-center justify-between">
              Auto-approve candidates
              <input type="checkbox" checked={settings.autoApproveCandidates} onChange={() => toggleSetting("autoApproveCandidates")} />
            </label>
            <label className="flex items-center justify-between">
              Auto-approve companies
              <input type="checkbox" checked={settings.autoApproveCompanies} onChange={() => toggleSetting("autoApproveCompanies")} />
            </label>
            <label className="flex items-center justify-between">
              Require identity verification
              <input type="checkbox" checked={settings.requireVerification} onChange={() => toggleSetting("requireVerification")} />
            </label>
            <div className="flex items-center justify-between">
              <span>Verification SLA</span>
              <select className="input-field h-[32px] w-[140px]">
                <option>24 hours</option>
                <option>48 hours</option>
                <option>72 hours</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Compliance & Data</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Retention policies for audit and regulatory compliance.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span>Data retention</span>
              <select className="input-field h-[32px] w-[160px]" value={settings.dataRetention} onChange={(e) => setSettings((prev) => ({ ...prev, dataRetention: e.target.value }))}>
                <option>12 months</option>
                <option>18 months</option>
                <option>24 months</option>
                <option>36 months</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>Audit log retention</span>
              <select className="input-field h-[32px] w-[160px]" value={settings.auditRetention} onChange={(e) => setSettings((prev) => ({ ...prev, auditRetention: e.target.value }))}>
                <option>12 months</option>
                <option>24 months</option>
                <option>48 months</option>
              </select>
            </div>
            <label className="flex items-center justify-between">
              GDPR export access
              <input type="checkbox" checked={settings.gdprExports} onChange={() => toggleSetting("gdprExports")} />
            </label>
            <button className="btn-secondary h-[34px] px-4 text-[12px]">Download compliance report</button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Notifications & Alerts</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Critical alerts delivered to the admin team.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <label className="flex items-center justify-between">
              High-risk activity alerts
              <input type="checkbox" checked={settings.riskAlerts} onChange={() => toggleSetting("riskAlerts")} />
            </label>
            <label className="flex items-center justify-between">
              Pending approvals digest
              <input type="checkbox" checked={settings.pendingApprovals} onChange={() => toggleSetting("pendingApprovals")} />
            </label>
            <label className="flex items-center justify-between">
              Weekly ops summary
              <input type="checkbox" checked={settings.weeklyDigest} onChange={() => toggleSetting("weeklyDigest")} />
            </label>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Integrations</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Manage platform integrations and API access.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span>ATS Connector</span>
              <span className="badge badge-success">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Slack Alerts</span>
              <span className="badge badge-warning">Review</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Email Provider</span>
              <span className="badge badge-orange">Configured</span>
            </div>
            <button className="btn-secondary h-[34px] px-4 text-[12px]">Manage API Keys</button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Feature Flags</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Control experiments and staged releases.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <label className="flex items-center justify-between">
              AI interview scoring
              <input type="checkbox" checked={settings.aiScoring} onChange={() => toggleSetting("aiScoring")} />
            </label>
            <label className="flex items-center justify-between">
              Community beta access
              <input type="checkbox" checked={settings.communityBeta} onChange={() => toggleSetting("communityBeta")} />
            </label>
            <button className="btn-secondary h-[34px] px-4 text-[12px]">View rollout plan</button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Branding & UI</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Adjust customer-facing defaults for the platform.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span>Theme preset</span>
              <select className="input-field h-[32px] w-[180px]" value={settings.brandingTheme} onChange={(e) => setSettings((prev) => ({ ...prev, brandingTheme: e.target.value }))}>
                <option>AxisFlow Orange</option>
                <option>Midnight Slate</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>Logo</span>
              <button className="btn-secondary h-[32px] px-4 text-[12px]">Upload Brand Pack</button>
            </div>
            <div className="flex items-center justify-between">
              <span>System banners</span>
              <button className="btn-secondary h-[32px] px-4 text-[12px]">Edit banner</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-[16px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>Audit & Safety</h3>
          <p className="text-[12px] text-[#6B7280] mt-1">Administrative audit trails and safety controls.</p>
          <div className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span>Audit snapshot cadence</span>
              <select className="input-field h-[32px] w-[160px]">
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span>Fraud risk threshold</span>
              <select className="input-field h-[32px] w-[160px]">
                <option>Conservative</option>
                <option>Balanced</option>
                <option>Strict</option>
              </select>
            </div>
            <button className="btn-secondary h-[34px] px-4 text-[12px]">Download audit log</button>
          </div>
        </div>
      </div>

      <ToastContainer />
    </AdminLayout>
  );
}
