import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/** Shows where the app navigated to, so tests can assert redirects. */
export function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

/**
 * Renders `routes` (an object of path -> element) in a memory router starting at `start`.
 * Unlisted paths show their own pathname so a redirect is visible.
 */
export function renderRoutes(routes, start = "/") {
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        {Object.entries(routes).map(([path, element]) => (
          <Route key={path} path={path} element={element} />
        ))}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
