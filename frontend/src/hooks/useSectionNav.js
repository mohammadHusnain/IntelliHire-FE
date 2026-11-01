import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_OFFSET = 88;

export function scrollToSection(id, behavior = "smooth") {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top, behavior });
  return true;
}

/** Scrolls to a landing-page section, routing to "/" first when elsewhere. */
export default function useSectionNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (id) => {
      if (pathname === "/") {
        scrollToSection(id);
        window.history.replaceState(null, "", `#${id}`);
      } else {
        navigate(`/#${id}`);
      }
    },
    [navigate, pathname],
  );
}
