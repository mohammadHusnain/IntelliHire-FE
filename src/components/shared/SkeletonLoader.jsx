export const SkeletonPulse = ({ className = "" }) => (
  <div className={`animate-pulse bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] bg-[length:200%_100%] ${className}`} 
    style={{ animation: "shimmer 1.5s infinite" }} />
);

export const SkeletonCard = () => (
  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-4">
    <div className="flex items-center gap-3">
      <SkeletonPulse className="w-10 h-10 rounded-[10px]" />
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-4 w-32 rounded" />
        <SkeletonPulse className="h-3 w-20 rounded" />
      </div>
    </div>
    <SkeletonPulse className="h-16 rounded-lg" />
    <div className="flex gap-2">
      <SkeletonPulse className="h-10 flex-1 rounded-[10px]" />
      <SkeletonPulse className="h-10 w-20 rounded-[10px]" />
    </div>
  </div>
);

export const SkeletonStatCard = () => (
  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 space-y-3">
    <div className="flex items-start justify-between">
      <SkeletonPulse className="h-10 w-20 rounded" />
      <SkeletonPulse className="w-10 h-10 rounded-[10px]" />
    </div>
    <SkeletonPulse className="h-4 w-28 rounded" />
    <SkeletonPulse className="h-8 rounded-lg" />
  </div>
);

export const SkeletonSessionCard = () => (
  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 space-y-3">
    <div className="flex items-start justify-between">
      <div className="flex-1 space-y-2">
        <SkeletonPulse className="h-5 w-40 rounded" />
        <SkeletonPulse className="h-3 w-24 rounded" />
      </div>
      <SkeletonPulse className="w-14 h-14 rounded-full" />
    </div>
    <div className="flex items-center justify-between pt-2 border-t border-[#F0F0F0]">
      <SkeletonPulse className="h-6 w-20 rounded-[6px]" />
      <SkeletonPulse className="h-4 w-24 rounded" />
    </div>
  </div>
);

export const SkeletonProfileCard = () => (
  <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 text-center space-y-4">
    <div className="flex justify-center">
      <SkeletonPulse className="w-28 h-28 rounded-full" />
    </div>
    <div className="space-y-2">
      <SkeletonPulse className="h-6 w-32 mx-auto rounded" />
      <SkeletonPulse className="h-4 w-24 mx-auto rounded" />
    </div>
    <SkeletonPulse className="h-8 w-28 mx-auto rounded-full" />
  </div>
);

export const SkeletonForm = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="space-y-2">
        <SkeletonPulse className="h-4 w-24 rounded" />
        <SkeletonPulse className="h-12 rounded-[10px]" />
      </div>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 3, cols = 4 }) => (
  <div className="space-y-3">
    <div className="flex gap-3">
      {Array(cols).fill(0).map((_, i) => (
        <SkeletonPulse key={i} className="h-10 flex-1 rounded-lg" />
      ))}
    </div>
    {Array(rows).fill(0).map((_, i) => (
      <div key={i} className="flex gap-3">
        {Array(cols).fill(0).map((_, j) => (
          <SkeletonPulse key={j} className="h-14 flex-1 rounded-lg" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonLine = ({ width = "100%", height = "16px" }) => (
  <SkeletonPulse className="rounded" style={{ width, height }} />
);

export const SkeletonCircle = ({ size = "40px" }) => (
  <SkeletonPulse className="rounded-full" style={{ width: size, height: size }} />
);

export default {
  Card: SkeletonCard,
  StatCard: SkeletonStatCard,
  SessionCard: SkeletonSessionCard,
  ProfileCard: SkeletonProfileCard,
  Form: SkeletonForm,
  Table: SkeletonTable,
  Line: SkeletonLine,
  Circle: SkeletonCircle,
  Pulse: SkeletonPulse
};
