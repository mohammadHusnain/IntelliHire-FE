import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import IntelliHireLogo from "../../components/shared/IntelliHireLogo";

const HourglassIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="hourglass-breathe"
  >
    <path
      d="M20 10h24M20 54h24M22 10c0 8 10 14 10 22S22 46 22 54M42 10c0 8-10 14-10 22s10 14 10 22"
      stroke="#F04E23"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M26 18c2 2 4 3.5 6 4.5M38 18c-2 2-4 3.5-6 4.5"
      stroke="#F04E23"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="32" cy="32" r="3" fill="#F04E23" opacity="0.4" />
    <path
      d="M27 46c1.5-1 3-1.5 5-1.5s3.5.5 5 1.5"
      stroke="#F04E23"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const EnvelopeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="16" rx="3" stroke="#D97706" strokeWidth="1.8" />
    <path d="M2 8l10 6 10-6" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CompanyPending() {
  const navigate = useNavigate();
  const [cardVisible, setCardVisible] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [messageFade, setMessageFade] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleCheckStatus = () => {
    setCheckLoading(true);
    setStatusMessage("");
    setMessageFade(false);
    setTimeout(() => {
      setCheckLoading(false);
      setStatusMessage("Still under review — we'll email you shortly");
      setTimeout(() => setMessageFade(true), 50);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(0.97); }
        }
        .hourglass-breathe {
          animation: breathe 3s ease-in-out infinite;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-enter {
          animation: fadeSlideIn 350ms ease forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .msg-fade {
          animation: fadeIn 300ms ease forwards;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div
        className={`w-full max-w-[480px] bg-white rounded-[12px] overflow-hidden transition-opacity ${cardVisible ? "card-enter" : "opacity-0"}`}
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
      >
        {/* Main Card Body */}
        <div className="px-12 pt-12 pb-0">
          {/* Wordmark */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <IntelliHireLogo className="w-8 h-8" />
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#0D0D0D", fontFamily: "Inter, sans-serif", letterSpacing: "-0.3px" }}>IntelliHire</span>
          </div>

          {/* Hourglass SVG */}
          <div className="flex justify-center mb-4">
            <HourglassIcon />
          </div>

          {/* Section Tag */}
          <div
            className="text-center mb-3"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "#F04E23",
              textTransform: "uppercase",
            }}
          >
            ● ACCOUNT STATUS
          </div>

          {/* Heading */}
          <h1
            className="text-center mb-4"
            style={{
              fontFamily: "Times New Roman, serif",
              fontSize: "28px",
              color: "#0D0D0D",
              lineHeight: 1.2,
              marginTop: "12px",
            }}
          >
            Your Account is{" "}
            <em style={{ color: "#F04E23", fontStyle: "italic" }}>Under Review</em>
          </h1>

          {/* Body Copy */}
          <p
            className="text-center"
            style={{
              fontSize: "14px",
              color: "#374151",
              lineHeight: 1.7,
            }}
          >
            Thank you for registering{" "}
            <strong style={{ color: "#0D0D0D" }}>Acme Corp</strong>. Our team is reviewing your company
            account — this typically takes up to 24 hours. You'll receive a confirmation email at{" "}
            <strong style={{ color: "#0D0D0D" }}>john@acmecorp.com</strong> once approved.
          </p>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #E5E7EB", margin: "24px 0" }} />

          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <span
              style={{
                background: "#FFFBEB",
                color: "#D97706",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                padding: "6px 16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#D97706",
                  display: "inline-block",
                }}
              />
              Pending Approval
            </span>
          </div>

          {/* Check Status Button */}
          <div className="flex justify-center mb-3">
            <button
              onClick={handleCheckStatus}
              disabled={checkLoading}
              className="flex items-center gap-2 transition-all"
              style={{
                height: "36px",
                padding: "0 24px",
                background: "white",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                cursor: checkLoading ? "not-allowed" : "pointer",
                transition: "border-color 150ms ease, color 150ms ease",
                opacity: checkLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!checkLoading) {
                  e.currentTarget.style.borderColor = "#F04E23";
                  e.currentTarget.style.color = "#F04E23";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.color = "#374151";
              }}
            >
              {checkLoading ? (
                <>
                  <svg
                    className="spinner"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="9" stroke="#F04E23" strokeWidth="2.5" strokeDasharray="30 28" />
                  </svg>
                  Checking…
                </>
              ) : (
                "Check Status"
              )}
            </button>
          </div>

          {/* Inline status message */}
          {statusMessage && (
            <p
              className={messageFade ? "msg-fade" : "opacity-0"}
              style={{
                textAlign: "center",
                fontSize: "13px",
                color: "#9CA3AF",
                marginBottom: "8px",
                transition: "opacity 300ms ease",
              }}
            >
              {statusMessage}
            </p>
          )}

          {/* Log Out Link */}
          <div className="flex justify-center" style={{ marginTop: "16px", paddingBottom: "28px" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                fontSize: "13px",
                color: "#9CA3AF",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
                transition: "color 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#F04E23";
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9CA3AF";
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Notification Strip */}
        <div
          style={{
            background: "#FFFBEB",
            borderTop: "1px solid #FDE68A",
            padding: "12px 16px 10px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <div style={{ flexShrink: 0, marginTop: "1px" }}>
            <EnvelopeIcon />
          </div>
          <p style={{ fontSize: "13px", color: "#92400E", lineHeight: 1.6, margin: 0 }}>
            Didn't receive a verification email? Check your spam folder or contact{" "}
            <a
              href="mailto:support@intellihire.com"
              style={{
                color: "#F04E23",
                fontWeight: 500,
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              support@intellihire.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default CompanyPending;
