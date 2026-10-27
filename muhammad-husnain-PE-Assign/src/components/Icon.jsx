// Inline SVG icons (no icon library dependency). All are 20×20, stroke-based,
// and use currentColor so they follow the surrounding text colour.

const PATHS = {
  basic: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="3" />
      <path d="M7 8h2M8 7v2M11 8h2M7 12.5h2M11 11.5l2 2M13 11.5l-2 2" />
    </>
  ),
  scientific: (
    <>
      <path d="M9 4.5c-1.6 0-2 .9-2.3 2.6L5.4 15.5c-.3 1.4-.8 2-2 2" />
      <path d="M4.5 9h5" />
      <path d="M11.5 9.5l4.5 6M16 9.5l-4.5 6" />
    </>
  ),
  loan: (
    <>
      <path d="M3.5 9.2 10 4l6.5 5.2" />
      <path d="M5.5 8v8.5h9V8" />
      <path d="M10 10.2v4.6M11.4 11.1c-.3-.4-.8-.6-1.4-.6-.8 0-1.4.4-1.4 1s.6.8 1.4 1 1.4.4 1.4 1-.6 1-1.4 1c-.6 0-1.1-.2-1.4-.6" />
    </>
  ),
  split: (
    <>
      <path d="M5.5 3.5h9v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" />
      <path d="M8 7.5h4M8 10.5h4" />
    </>
  ),
  minus: <path d="M5 10h10" />,
  plus: <path d="M5 10h10M10 5v10" />,
  chevron: <path d="m6 8 4 4 4-4" />,
  check: <path d="m5 10.5 3.2 3L15 6.5" />,
  alert: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v4.2M10 13.4v.1" />
    </>
  ),
  backspace: (
    <>
      <path d="M7.5 5h8.5v10H7.5L3 10z" />
      <path d="m9.5 8 4 4M13.5 8l-4 4" />
    </>
  ),
};

export function Icon({ name, size = 20, className, strokeWidth = 1.6 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
