import { NavLink, useLocation } from "react-router-dom";
import { Bell, ShieldAlert, ScrollText, LogOut } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { label: "📊 Dashboard", to: ROUTES.ADMIN.DASHBOARD },
  { label: "👤 User Management", to: ROUTES.ADMIN.USERS },
  { label: "🏢 Company Management", to: ROUTES.ADMIN.COMPANIES },
  { label: "🌐 Community Management", to: ROUTES.ADMIN.COMMUNITIES },
  { label: "📈 Reports & Analytics", to: ROUTES.ADMIN.REPORTS },
  { label: "⚙️ Settings", to: ROUTES.ADMIN.SETTINGS },
];

export default function AdminLayout({ title, children, pendingCount = 0 }) {
  const location = useLocation();
  const isReviewRequired = pendingCount > 0;
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-white text-[#374151]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-[240px] border-r border-[#E5E7EB] bg-white flex flex-col">
        <div className="h-[64px] px-6 flex items-center border-b border-[#E5E7EB]">
          <div className="text-[18px] font-semibold text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
            Intelli-Hire <span className="text-[#F04E23] italic">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const [path, query] = item.to.split("?");
            const isActive = location.pathname === path && (!query || location.search === `?${query}`);
            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={`block px-3 py-2 rounded-lg text-[14px] font-medium transition-colors ${
                  isActive
                    ? "bg-[#FFF4F1] text-[#F04E23] border-l-2 border-[#F04E23]"
                    : "text-[#9CA3AF] hover:text-[#F04E23] hover:bg-[#FFF4F1]"
                }`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
            aria-label="Logout"
          >
            <LogOut size={16} />
            <span className="text-[14px] font-medium">Logout</span>
          </button>
        </div>

        <div className="px-4 pb-6">
          <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#0D0D0D] text-white text-[11px] font-semibold tracking-wide">
            Super Admin
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[#6B7280]">
            <span className={`w-2.5 h-2.5 rounded-full ${isReviewRequired ? "bg-[#D97706]" : "bg-[#059669]"}`} />
            {isReviewRequired ? "Review Required" : "Platform Healthy"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="pl-[240px]">
        <header className="sticky top-0 z-30 flex items-center justify-between h-[64px] px-8 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
              <span className="text-[#F04E23] italic">{title}</span>
            </h1>
            <span className="text-[12px] text-[#9CA3AF]">Last updated 2 mins ago</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#F04E23] hover:border-[#F04E23] transition-colors" aria-label="Notifications">
                <Bell size={16} />
              </button>
              <button className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#F04E23] hover:border-[#F04E23] transition-colors" aria-label="Audit Logs">
                <ScrollText size={16} />
              </button>
              <button className="w-9 h-9 rounded-full border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#F04E23] hover:border-[#F04E23] transition-colors" aria-label="Emergency Admin Actions">
                <ShieldAlert size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[13px] font-semibold text-[#0D0D0D]">Super Admin</div>
                <div className="text-[11px] text-[#9CA3AF]">Admin Console</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0D0D0D] text-white flex items-center justify-center text-[12px] font-semibold">SA</div>
            </div>
          </div>
        </header>

        <main className="px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
