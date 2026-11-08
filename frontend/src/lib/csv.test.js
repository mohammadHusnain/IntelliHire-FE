import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["l1\nl2", ""]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"l1\nl2",');
  });

  it.each(["=SUM(A1)", "@cmd", "-1+1", "+SUM(1)", "\tcmd"])("neutralises the formula %j", (text) => {
    expect(toCsv(["h"], [[text]]).split("\r\n")[1].replace(/^"/, "")).toMatch(/^'/);
  });

  it.each(["+92 300 1234567", "+1 (555) 123-4567", "0300 1234567"])("keeps the phone number %s as it is", (phone) => {
    expect(toCsv(["h"], [[phone]]).split("\r\n")[1]).toBe(phone);
  });

  it("keeps numbers and empty cells", () => {
    expect(toCsv(["h"], [[-5], [null], [undefined]]).split("\r\n").slice(1)).toEqual(["-5", "", ""]);
  });
});
