/**
 * IntelliHire Logo Component
 * Bar-chart style logo used consistently across all pages.
 * Default orange (#F04E23) for portal pages.
 */
function IntelliHireLogo({ className = "", color = "#F04E23" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <rect width="40" height="40" rx="10" fill={color} fillOpacity="0.1" />
      <path d="M12 12h4v16h-4zM18 16h4v12h-4zM24 8h4v20h-4z" fill={color} />
      <circle cx="30" cy="30" r="4" fill={color} />
    </svg>
  );
}

export default IntelliHireLogo;
