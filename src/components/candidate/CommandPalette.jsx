import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Mic, Sparkles } from "lucide-react";
import Palette from "@/components/app/CommandPalette";
import { CANDIDATE_NAV } from "./nav";
import { useCandidateRecord } from "@/store/candidateStore";
import { formatDate } from "@/lib/candidateStats";

export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const record = useCandidateRecord();

  const items = useMemo(() => {
    const role = record?.profile.targetRole || "your target role";
    return [
      ...CANDIDATE_NAV.flatMap((g) => g.items.map((i) => ({ id: i.to, group: "Go to", label: i.label, icon: i.icon, run: () => navigate(i.to) }))),
      { id: "start-tech", group: "Practice", label: `Technical interview · ${role}`, icon: Mic, run: () => navigate("/candidate/interview/setup?type=technical") },
      { id: "start-gen", group: "Practice", label: "General behavioural interview", icon: Sparkles, run: () => navigate("/candidate/interview/setup?type=general") },
      { id: "start-role", group: "Practice", label: `Role-specific interview · ${role}`, icon: Mic, run: () => navigate("/candidate/interview/setup?type=role-specific") },
      ...[...(record?.sessions || [])]
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          group: "Recent reports",
          label: `${s.role} · ${s.summary.overall}/100`,
          hint: formatDate(s.completedAt, { month: "short", day: "numeric" }),
          icon: FileText,
          run: () => navigate(`/candidate/report/${s.id}`),
        })),
    ];
  }, [record, navigate]);

  return <Palette items={items} onClose={onClose} placeholder="Search pages, start an interview, open a report…" />;
}
