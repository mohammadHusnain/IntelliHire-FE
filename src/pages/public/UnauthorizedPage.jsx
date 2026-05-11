import { Link, useNavigate } from "react-router-dom";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-md">
        <p className="text-[72px] font-extrabold text-[#DC2626] leading-none">403</p>
        <h1 className="mt-4 text-[24px] font-semibold text-[#0D0D0D]">Access Denied</h1>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          You don't have permission to view this page.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-[40px] px-5 rounded-lg border border-[#E5E7EB] text-[14px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
          >
            Go Back
          </button>
          <Link
            to="/"
            className="h-[40px] px-5 rounded-lg bg-[#F04E23] text-white text-[14px] hover:bg-[#D43D14] transition-colors flex items-center"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
