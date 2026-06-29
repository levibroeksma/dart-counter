import { describe, expect, it, vi } from "vitest";
import { deepClone } from "@lib/shared/utils/deep-clone";

describe("deepClone", () => {
  it("clones plain objects with structuredClone", () => {
    const value = { count: 1, nested: { score: 501 } };
    const cloned = deepClone(value);

    expect(cloned).toEqual(value);
    expect(cloned).not.toBe(value);
    expect(cloned.nested).not.toBe(value.nested);
  });

  it("falls back when structuredClone rejects proxies", () => {
    vi.spyOn(globalThis, "structuredClone").mockImplementation(() => {
      throw new DOMException("Proxy object could not be cloned.");
    });

    const proxied = new Proxy({ remaining: 501 }, {});
    const cloned = deepClone(proxied);

    expect(cloned).toEqual({ remaining: 501 });
  });
});
