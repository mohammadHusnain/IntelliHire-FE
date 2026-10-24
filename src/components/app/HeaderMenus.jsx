import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, LogOut } from "lucide-react";
import useDismiss from "@/hooks/useDismiss";
import { initials, relativeTime } from "@/lib/candidateStats";

export function Avatar({ name, photo, size = 36, className = "", tone = "brand" }) {
  return photo ? (
    <img src={photo} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        tone === "dark" ? "bg-gradient-to-br from-ink to-stone-600" : "bg-gradient-to-br from-brand to-[#FF8A5C]"
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/** list: [{ id, title, body, to, createdAt, read }] */
export function NotificationsPopover({ list, onRead, onReadAll, emptyText = "You are all caught up." }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const navigate = useNavigate();
  const unread = list.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="icon-btn relative flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 hover:text-ink"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" />
          </span>
        )}
      </button>
      {open && (
        <div className="animate-fade-in-up absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_30px_60px_-24px_rgba(13,13,13,0.4)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <p className="text-[14px] font-semibold text-ink">
              Notifications {unread > 0 && <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">{unread} new</span>}
            </p>
            {unread > 0 && onReadAll && (
              <button type="button" onClick={onReadAll} className="inline-flex items-center gap-1 text-[12px] font-semibold text-stone-500 hover:text-brand">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[360px] overflow-y-auto p-1.5">
            {list.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-stone-500">{emptyText}</li>}
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => { onRead?.(n.id); setOpen(false); if (n.to) navigate(n.to); }}
                  className="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-stone-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13.5px] ${n.read ? "text-stone-600" : "font-semibold text-ink"}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-[12.5px] text-stone-500">{n.body}</span>}
                    {n.createdAt && <span className="mt-1 block text-[11.5px] text-stone-400">{relativeTime(n.createdAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** user: { name, email, photo }, links: [{ icon, label, to }] */
export function UserMenu({ user, links = [], onLogout, tone }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const navigate = useNavigate();
  const go = (to) => { setOpen(false); navigate(to); };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-0.5 transition-shadow hover:shadow-[0_0_0_4px_rgba(240,78,35,0.12)] sm:pr-3"
      >
        <Avatar name={user.name} photo={user.photo} size={34} tone={tone} />
        <span className="hidden max-w-[120px] truncate text-[13.5px] font-semibold text-ink sm:block">{user.name.split(" ")[0]}</span>
      </button>
      {open && (
        <div className="animate-fade-in-up absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_30px_60px_-24px_rgba(13,13,13,0.4)]">
          <div className="flex items-center gap-3 border-b border-[var(--line)] p-4">
            <Avatar name={user.name} photo={user.photo} size={40} tone={tone} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[12px] text-stone-500">{user.email}</p>
            </div>
          </div>
          {links.length > 0 && (
            <div className="p-1.5">
              {links.map((l) => (
                <MenuItem key={l.to} icon={l.icon} label={l.label} onClick={() => go(l.to)} />
              ))}
            </div>
          )}
          <div className="border-t border-[var(--line)] p-1.5">
            <MenuItem icon={LogOut} label="Log out" danger onClick={onLogout} />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-stone-700 hover:bg-stone-50 hover:text-ink"
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}
