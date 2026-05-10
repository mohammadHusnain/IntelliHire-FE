import { useState } from "react";
import { AlertTriangle, X, Check } from "lucide-react";

export const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action", 
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning"
}) => {
  if (!isOpen) return null;

  const typeStyles = {
    warning: {
      icon: <AlertTriangle size={24} className="text-[#F59E0B]" />,
      iconBg: "bg-[#FFFBEB]",
      confirmBtn: "bg-[#DC2626] hover:bg-[#B91C1C] text-white",
    },
    danger: {
      icon: <AlertTriangle size={24} className="text-[#DC2626]" />,
      iconBg: "bg-[#FEF2F2]",
      confirmBtn: "bg-[#DC2626] hover:bg-[#B91C1C] text-white",
    },
    info: {
      icon: <Check size={24} className="text-[#2563EB]" />,
      iconBg: "bg-[#EFF6FF]",
      confirmBtn: "bg-[#2563EB] hover:bg-[#1D4ED8] text-white",
    }
  };

  const style = typeStyles[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-[16px] shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full ${style.iconBg} flex items-center justify-center flex-shrink-0`}>
              {style.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-[18px] font-semibold text-[#111827]" style={{ fontFamily: 'Times New Roman, serif' }}>
                {title}
              </h3>
              <p className="text-[14px] text-[#6B7280] mt-1 leading-relaxed">
                {message}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E5E7EB] text-[#374151] rounded-[10px] text-[14px] font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 px-4 py-2.5 rounded-[10px] text-[14px] font-medium transition-all ${style.confirmBtn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const useConfirmDialog = () => {
  const [dialog, setDialog] = useState(null);

  const showDialog = (config) => {
    setDialog({ ...config, isOpen: true });
  };

  const hideDialog = () => {
    setDialog(null);
  };

  const ConfirmDialogComponent = dialog ? (
    <ConfirmDialog {...dialog} onClose={hideDialog} />
  ) : null;

  return { showDialog, hideDialog, ConfirmDialogComponent };
};

export default ConfirmDialog;
