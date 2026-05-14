import { Navigate } from "react-router-dom";
import { ROUTES } from "@/config/routes";

export default function AdminManagement() {
  return <Navigate to={ROUTES.ADMIN.USERS} replace />;
}
