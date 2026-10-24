export const isNavActive = (pathname, item) => {
  const m = item.match || item.to;
  return (Array.isArray(m) ? m : [m]).some((p) => pathname.startsWith(p));
};
