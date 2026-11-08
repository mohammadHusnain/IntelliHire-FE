/** Saves a Blob as a file (an object URL on a temporary link, revoked right after). */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Opens a Blob in a new tab (for a PDF). Pop-up blockers only allow a window that was opened by the click itself,
 * so `open()` first opens a blank tab; call `show(blob)` when the file arrives or `fail()` to close the tab again.
 * When the browser blocks the tab, `show` saves the file instead.
 */
export function openBlobInTab() {
  const tab = window.open("", "_blank");
  return {
    show(blob, filename) {
      if (!tab) return saveBlob(blob, filename);
      const url = URL.createObjectURL(blob);
      tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    fail() {
      tab?.close();
    },
  };
}
