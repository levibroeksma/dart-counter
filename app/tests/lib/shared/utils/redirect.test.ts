import { describe, it, expect } from "vitest";
import { sanitizeRedirect } from "@lib/shared/utils/redirect";

describe("sanitizeRedirect", () => {
  it("returns valid same-origin relative paths unchanged", () => {
    expect(sanitizeRedirect("/")).toBe("/");
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirect("/games/123")).toBe("/games/123");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/");
    expect(sanitizeRedirect("//evil.com/path")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeRedirect("https://evil.com")).toBe("/");
    expect(sanitizeRedirect("http://evil.com/path")).toBe("/");
    expect(sanitizeRedirect("javascript:alert(1)")).toBe("/");
  });

  it("returns / for null, undefined, and empty string", () => {
    expect(sanitizeRedirect(null)).toBe("/");
    expect(sanitizeRedirect(undefined)).toBe("/");
    expect(sanitizeRedirect("")).toBe("/");
  });
});
