export default function AdminModal({ title, description, children, confirmLabel, onConfirm, onClose, confirmDisabled = false, tone = "primary" }) {
  if (!title) return null;

  const toneClasses = tone === "danger" ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#F04E23] hover:bg-[#D43D14]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 border border-[#E5E7EB] admin-modal">
        <h3 className="text-[18px] text-[#0D0D0D]" style={{ fontFamily: "Times New Roman, serif" }}>
          {title}
        </h3>
        {description && <p className="text-[14px] text-[#6B7280] mt-2">{description}</p>}
        <div className="mt-4">{children}</div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-[40px] rounded-lg border border-[#E5E7EB] text-[14px] font-medium text-[#374151]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`flex-1 h-[40px] rounded-lg text-white text-[14px] font-semibold ${toneClasses} disabled:opacity-50`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
