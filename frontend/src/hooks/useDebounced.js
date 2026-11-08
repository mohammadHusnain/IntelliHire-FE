import { useEffect, useState } from "react";

/** `value`, but only after it has stopped changing for `ms` (for search boxes that call the server). */
export function useDebounced(value, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
