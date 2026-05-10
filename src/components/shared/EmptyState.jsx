import { FolderOpen, FileSearch, Inbox, FileX, ClipboardList, MessageSquare, Search } from "lucide-react";

const iconMap = {
  default: FolderOpen,
  search: Search,
  data: FileSearch,
  inbox: Inbox,
  file: FileX,
  list: ClipboardList,
  message: MessageSquare,
};

export const EmptyState = ({ 
  icon = "default", 
  title = "No data found", 
  description = "There are no items to display at the moment.",
  action = null,
  actionLabel = "Create New",
  onAction = () => {}
}) => {
  const IconComponent = iconMap[icon] || FolderOpen;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] flex items-center justify-center mb-4">
        <IconComponent size={32} className="text-[#9CA3AF]" />
      </div>
      
      <h3 className="text-[18px] font-semibold text-[#374151] mb-2" style={{ fontFamily: 'Times New Roman, serif' }}>
        {title}
      </h3>
      
      <p className="text-[14px] text-[#6B7280] max-w-md leading-relaxed mb-6">
        {description}
      </p>
      
      {action && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-[10px] text-[14px] font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export const EmptyStateCompact = ({ 
  icon = "default", 
  title,
  description 
}) => {
  const IconComponent = iconMap[icon] || FolderOpen;

  return (
    <div className="flex items-center gap-4 p-4 rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB]">
      <div className="w-12 h-12 rounded-[10px] bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
        <IconComponent size={20} className="text-[#2563EB]" />
      </div>
      <div className="text-left">
        <p className="text-[14px] font-medium text-[#374151]">{title}</p>
        <p className="text-[13px] text-[#6B7280]">{description}</p>
      </div>
    </div>
  );
};

export default EmptyState;
