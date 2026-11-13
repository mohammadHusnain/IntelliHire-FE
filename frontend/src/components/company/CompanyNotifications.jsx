import { useState } from "react";
import { NotificationsPopover } from "@/components/app/HeaderMenus";

const SAMPLE_NOTIFICATIONS = [
  {
    id: "company-applicant-1",
    title: "New application received",
    body: "A candidate applied for Frontend Developer.",
    createdAt: Date.now() - 18 * 60 * 1000,
    to: "/company/candidates",
    read: false,
  },
  {
    id: "company-interview-1",
    title: "Interview feedback is ready",
    body: "Review the latest candidate interview report.",
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    to: "/company/candidates",
    read: false,
  },
  {
    id: "company-community-1",
    title: "Community activity",
    body: "A candidate responded to a shared opportunity.",
    createdAt: Date.now() - 24 * 60 * 60 * 1000,
    to: "/company/community",
    read: true,
  },
];

export default function CompanyNotifications() {
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);

  const markRead = (id) => {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  };

  const markAllRead = () => {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
  };

  return <NotificationsPopover list={notifications} onRead={markRead} onReadAll={markAllRead} />;
}
