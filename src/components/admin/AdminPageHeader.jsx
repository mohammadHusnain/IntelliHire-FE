export default function AdminPageHeader({ icon, title, accent, subtitle, actions = [], chips = [] }) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 mb-6">
      <div>
        <h2 className="text-[28px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
          <span className="mr-2">{icon}</span>
          {title} {accent && <span className="text-[#F04E23] italic">{accent}</span>}
        </h2>
        {subtitle && <p className="text-[14px] text-[#9CA3AF] mt-2 max-w-2xl">{subtitle}</p>}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
            {chips.map((chip) => (
              <span key={chip.label} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${chip.className}`}>
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={action.className || "px-4 py-2 rounded-lg border border-[#E5E7EB] text-[13px] text-[#374151] hover:border-[#F04E23] hover:text-[#F04E23] transition-colors flex items-center gap-2"}
            >
              {action.icon && <action.icon size={16} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
