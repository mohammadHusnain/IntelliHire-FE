import { Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { usePlatformStore } from "@/store/platformStore";

const TONES = {
  info: { icon: Info, cls: "bg-ink text-white" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500 text-white" },
  success: { icon: CheckCircle2, cls: "bg-emerald-600 text-white" },
};

/** Platform-wide announcement set by admins in Settings. audience: "candidate" | "company". */
export default function AnnouncementBanner({ audience, forcePreview }) {
  const live = usePlatformStore((s) => s.settings.announcement);
  const a = forcePreview || live;
  if (!a?.enabled || !a.text?.trim() || (a.audience !== "all" && a.audience !== audience)) return null;
  const tone = TONES[a.tone] || TONES.info;
  const Icon = tone.icon;
  return (
    <div role="status" className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-medium ${tone.cls}`}>
      <Icon size={15} className="shrink-0" /> <span>{a.text}</span>
    </div>
  );
}
