import { afterEach, describe, expect, it, vi } from "vitest";
import { openBlobInTab, saveBlob } from "./download";

afterEach(() => vi.restoreAllMocks());

describe("saveBlob", () => {
  it("clicks a temporary link with the file name and revokes the object URL later", () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    let name;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { name = this.download; });
    saveBlob(new Blob(["a"]), "report.csv");
    expect(name).toBe("report.csv");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
  });
});

describe("openBlobInTab", () => {
  it("opens the blank tab first, then shows the file in it", () => {
    URL.createObjectURL = vi.fn(() => "blob:y");
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab);
    const t = openBlobInTab();
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    t.show(new Blob(["a"]), "cv.pdf");
    expect(tab.location.href).toBe("blob:y");
  });

  it("closes the tab when the download fails", () => {
    const tab = { location: {}, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab);
    openBlobInTab().fail();
    expect(tab.close).toHaveBeenCalled();
  });

  it("falls back to saving the file when the browser blocks the tab", () => {
    URL.createObjectURL = vi.fn(() => "blob:z");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, "open").mockReturnValue(null);
    let name;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { name = this.download; });
    openBlobInTab().show(new Blob(["a"]), "cv.pdf");
    expect(name).toBe("cv.pdf");
    expect(() => openBlobInTab().fail()).not.toThrow();
  });
});
