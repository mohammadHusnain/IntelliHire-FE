import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, X, AlertCircle, Info } from "lucide-react";

export const Toast = ({ message, type = "success", onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={18} className="text-[#16A34A]" />,
    error: <XCircle size={18} className="text-[#DC2626]" />,
    warning: <AlertCircle size={18} className="text-[#F59E0B]" />,
    info: <Info size={18} className="text-[#F04E23]" />
  };

  const bgColors = {
    success: "bg-[#F0FDF4] border-[#86EFAC]",
    error: "bg-[#FEF2F2] border-[#FCA5A5]",
    warning: "bg-[#FFFBEB] border-[#FCD34D]",
    info: "bg-[#FFF4F1] border-[#FCA68A]"
  };

  const textColors = {
    success: "text-[#166534]",
    error: "text-[#991B1B]",
    warning: "text-[#92400E]",
    info: "text-[#9A3412]"
  };

  return (
    <div className={`fixed top-4 right-4 z-[100] animate-in slide-in-from-right-4 fade-in duration-300`}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-[12px] border shadow-lg min-w-[320px] ${bgColors[type]}`}>
        {icons[type]}
        <span className={`text-[14px] font-medium flex-1 ${textColors[type]}`}>{message}</span>
        <button 
          onClick={onClose}
          className={`p-1 rounded-full hover:bg-black/5 transition-colors ${textColors[type]}`}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
        />
      ))}
    </>
  );
};

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success", duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast, ToastContainer: () => <ToastContainer toasts={toasts} removeToast={removeToast} /> };
};

// Simple hook version for components
export const useToastState = () => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success", duration = 3000) => {
    const id = Date.now();
    setToast({ id, message, type, duration });
    setTimeout(() => setToast(null), duration);
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  return { toast, showToast, hideToast };
};

export default Toast;
